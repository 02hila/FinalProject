/**
 * Canvas Service -- Server-Side Ad Image Renderer
 *
 * Generates ad banner images as PNG data-URIs using node-canvas (or @napi-rs/canvas
 * as a fallback). Each banner is composed of a background image (or gradient fallback),
 * a semi-transparent text box with title, body text, and CTA button, and an optional
 * right-hand QR code placeholder zone when a website URL is provided.
 *
 * Key exports:
 *  - createAdDesignOnServer -- main entry point; accepts ad data, returns a base64 PNG data-URI
 *  - cleanAdText            -- strips markdown and formatting artifacts from Gemini output
 *  - wrapText               -- word-wraps text to fit a given pixel width, with RTL support
 *  - createCanvas / loadImage -- re-exported from the underlying canvas library
 *
 * Called by:
 *  - Ad generation routes (when creating a new ad)
 *  - lowPerformanceChecker and unsharedAdsChecker (when generating alternative ads)
 *
 * Depends on:
 *  - 'canvas' npm package (preferred) or '@napi-rs/canvas' as a platform fallback
 *  - Image URLs served by pexelsService for background photos
 */

// Attempt to load the 'canvas' package; fall back to '@napi-rs/canvas' for environments
// where native canvas bindings are unavailable (e.g., certain Linux builds).
let createCanvas, loadImage;
try {
  const canvas = require('canvas');
  createCanvas = canvas.createCanvas;
  loadImage = canvas.loadImage;
} catch (err) {
  const canvas = require('@napi-rs/canvas');
  createCanvas = canvas.createCanvas;
  loadImage = canvas.loadImage;
}

/**
 * Strips markdown formatting artifacts (bold, headers, list markers, etc.)
 * that Gemini may include in generated ad text, plus trailing punctuation clusters.
 *
 * @param {string} text - Raw text potentially containing markdown syntax.
 * @returns {string} Cleaned plain text suitable for rendering on canvas.
 */
function cleanAdText(text) {
  if (!text) return '';
  let cleaned = text
    .replace(/\*\*Option \d+.*?\*\*/gi, '')
    .replace(/Option \d+.*?:/gi, '')
    .replace(/\*\*\d+\.\s*/gi, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/#{1,6}\s+/g, '')
    .replace(/`{1,3}/g, '')
    .replace(/^[\-\*\•]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/ +/g, ' ')
    .trim();

  // Remove trailing punctuation clusters that look like leftover formatting
  cleaned = cleaned.replace(/[\!\?\.\,\;\:"]+$/, '').trim();

  return cleaned;
}

/**
 * Word-wraps text to fit within a given pixel width on a canvas context.
 * Supports right-to-left (RTL) text by wrapping each line with Unicode
 * directional embedding characters (RLE / PDF).
 *
 * If a single word exceeds maxWidth, it is broken character-by-character.
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context (used for measureText).
 * @param {string} text - The text to wrap.
 * @param {number} maxWidth - Maximum line width in pixels.
 * @param {boolean} [isRTL=true] - Whether to apply RTL directional embeddings.
 * @returns {string[]} Array of wrapped lines ready for rendering.
 */
function wrapText(ctx, text, maxWidth, isRTL = true) {
  if (!text) return [];
  const paragraphs = text.split(/\n+/);
  const lines = [];

  // Unicode bidi control characters for right-to-left embedding
  const RLE = '\u202B';
  const PDF = '\u202C';

  paragraphs.forEach(paragraph => {
    const trimmedParagraph = paragraph.trim();
    if (!trimmedParagraph) return;

    const words = trimmedParagraph.split(' ');
    let currentLine = '';

    for (let i = 0; i < words.length; i++) {
      const testWord = words[i];

      const wordMetrics = ctx.measureText(testWord);
      if (wordMetrics.width > maxWidth) {
        // Word is wider than the available space -- flush current line first
        if (currentLine.trim()) {
          const lineText = currentLine.trim();
          lines.push(isRTL ? (RLE + lineText + PDF) : lineText);
          currentLine = '';
        }

        // Break the oversized word character-by-character
        let charLine = '';
        for (let j = 0; j < testWord.length; j++) {
          const testChar = charLine + testWord[j];
          const charMetrics = ctx.measureText(testChar);
          if (charMetrics.width > maxWidth && charLine) {
            lines.push(isRTL ? (RLE + charLine + PDF) : charLine);
            charLine = testWord[j];
          } else {
            charLine = testChar;
          }
        }
        if (charLine) {
          currentLine = charLine + ' ';
        }
      } else {
        let testLine = currentLine + testWord + ' ';
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;

        if (testWidth > maxWidth && i > 0) {
          const lineText = currentLine.trim();
          lines.push(isRTL ? (RLE + lineText + PDF) : lineText);
          currentLine = testWord + ' ';
        } else {
          currentLine = testLine;
        }
      }
    }

    if (currentLine.trim()) {
      const lineText = currentLine.trim();
      lines.push(isRTL ? (RLE + lineText + PDF) : lineText);
    }
  });

  return lines;
}

/** Visual style presets controlling overlay, accent color, and QR background. */
const STYLE_CONFIGS = {
  modern: { overlay: 'rgba(0, 0, 0, 0.5)', accent: '#667eea', qrBg: 'rgba(255, 255, 255, 0.95)' },
  minimal: { overlay: 'rgba(255, 255, 255, 0.85)', textColor: '#333', accent: '#333', qrBg: 'rgba(240, 240, 240, 0.95)' },
  elegant: { overlay: 'rgba(0, 0, 0, 0.6)', accent: '#d4af37', qrBg: 'rgba(255, 255, 255, 0.95)' },
  dark: { overlay: 'rgba(0, 0, 0, 0.7)', accent: '#00d4ff', qrBg: 'rgba(255, 255, 255, 0.9)' }
};

/**
 * Renders a complete ad banner image on a server-side canvas and returns it as
 * a base64 PNG data-URI.
 *
 * Layout overview (left to right):
 *  - Text section (750 px or 900 px if no QR): background image with dark overlay,
 *    containing a semi-transparent box with title, body text, CTA button, and agent credit.
 *  - QR section (300 px, only when websiteUrl is provided): light background with a
 *    dashed placeholder square and "Scan Me" label -- the actual QR code is composited
 *    later on the client side.
 *
 * @param {Object} adData - All data needed to render the ad.
 * @param {string} adData.businessName - Business name (fallback for title).
 * @param {string} adData.adText - Marketing body text.
 * @param {string} [adData.title] - Ad headline; derived from businessName if absent.
 * @param {string} [adData.callToAction] - CTA button text.
 * @param {string} [adData.productService] - Product/service description (unused in render but part of adData).
 * @param {string} [adData.adStyle='modern'] - Visual style key (modern|minimal|elegant|dark).
 * @param {string} [adData.imageUrl] - Background photo URL (falls back to gradient).
 * @param {string} [adData.agentName] - Name of the creating agent, shown as a small credit.
 * @param {string} [adData.language] - 'Hebrew' or 'Arabic' triggers RTL layout.
 * @param {string} [adData.websiteUrl] - If present, a QR placeholder zone is added on the right.
 * @returns {Promise<string>} Base64 data-URI of the rendered PNG image.
 */
async function createAdDesignOnServer(adData) {
  const { businessName, adText, productService, adStyle, imageUrl, agentName, callToAction, language, websiteUrl } = adData;

  const hasWebsiteUrl = websiteUrl && websiteUrl.trim() !== '';

  // Canvas dimensions: the right QR zone is only allocated when a URL is present
  const canvasHeight = 450;
  const qrSectionWidth = hasWebsiteUrl ? 300 : 0;
  const textSectionWidth = hasWebsiteUrl ? 750 : 900;
  const canvasWidth = textSectionWidth + qrSectionWidth;

  console.log(`Creating ad design (${hasWebsiteUrl ? 'with QR zone' : 'no QR - full width'})...`);

  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');

  const isRTL = language === 'Hebrew' || language === 'Arabic';
  const selectedStyle = STYLE_CONFIGS[adStyle] || STYLE_CONFIGS.modern;

  // --- Draw the background for the text section ---
  if (imageUrl) {
    try {
      const image = await loadImage(imageUrl);
      // Clip the background image to the text section area only
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, textSectionWidth, canvasHeight);
      ctx.clip();
      ctx.drawImage(image, 0, 0, textSectionWidth, canvasHeight);
      // Apply a semi-transparent overlay so text is readable on top of the photo
      ctx.fillStyle = selectedStyle.overlay;
      ctx.fillRect(0, 0, textSectionWidth, canvasHeight);
      ctx.restore();
    } catch (err) {
      // Image load failed -- fall back to a gradient background
      console.log('Using gradient fallback for text section');
      const gradient = ctx.createLinearGradient(0, 0, textSectionWidth, canvasHeight);
      gradient.addColorStop(0, '#667eea');
      gradient.addColorStop(1, '#764ba2');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, textSectionWidth, canvasHeight);
    }
  } else {
    // No image URL provided -- use a default gradient
    const gradient = ctx.createLinearGradient(0, 0, textSectionWidth, canvasHeight);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, textSectionWidth, canvasHeight);
  }

  // --- Draw the QR section background and separator line ---
  if (hasWebsiteUrl) {
    ctx.fillStyle = selectedStyle.qrBg;
    ctx.fillRect(textSectionWidth, 0, qrSectionWidth, canvasHeight);

    // Thin vertical separator between text and QR zones
    ctx.strokeStyle = 'rgba(102, 126, 234, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(textSectionWidth, 20);
    ctx.lineTo(textSectionWidth, canvasHeight - 20);
    ctx.stroke();
  }

  // --- Draw the semi-transparent text box ---
  const boxPadding = 40;
  const boxHeight = 370;
  const boxY = (canvasHeight - boxHeight) / 2;
  const boxWidth = textSectionWidth - (boxPadding * 2);
  const boxX = boxPadding;

  ctx.fillStyle = adStyle === 'minimal' ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.4)';
  ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

  const centerX = boxX + boxWidth / 2;

  // --- Render the title (up to 2 wrapped lines) ---
  let titleText = adData.title ? cleanAdText(adData.title).toUpperCase() : (businessName || 'BUSINESS').toUpperCase();
  titleText = titleText + '!';

  ctx.font = 'bold 32px Arial';
  const titlePadding = 25;
  const titleMaxWidth = boxWidth - (titlePadding * 2);

  const titleLines = wrapText(ctx, titleText, titleMaxWidth, isRTL);
  const titleStartX = isRTL ? (boxX + boxWidth - titlePadding) : (boxX + titlePadding);
  const titleLineHeight = 38;
  const titleStartY = boxY + 15;

  ctx.fillStyle = adStyle === 'minimal' ? '#222' : selectedStyle.accent;
  ctx.textAlign = isRTL ? 'right' : 'left';
  ctx.textBaseline = 'top';

  titleLines.forEach((line, i) => {
    if (i < 2) {
      ctx.fillText(line, titleStartX, titleStartY + (i * titleLineHeight));
    }
  });

  const titleEndY = titleStartY + (Math.min(titleLines.length, 2) * titleLineHeight) + 15;

  // --- Render the body text (adaptive line count based on available height) ---
  ctx.textAlign = isRTL ? 'right' : 'left';
  ctx.fillStyle = adStyle === 'minimal' ? '#111' : '#fff';
  ctx.font = 'bold 24px Arial';
  ctx.textBaseline = 'alphabetic';
  const cleanText = cleanAdText(adText);

  const textPadding = 30;
  const availableWidth = boxWidth - (textPadding * 2);
  const lines = wrapText(ctx, cleanText, availableWidth, isRTL);

  // Pre-calculate the CTA button position to know where body text must stop
  const buttonWidth = 300;
  const buttonHeight = 50;
  const buttonX = centerX - buttonWidth / 2;

  const textStartX = isRTL ? (boxX + boxWidth - textPadding) : (boxX + textPadding);
  const lineHeight = 30;

  const textStartY = titleEndY + 10;
  const buttonY = boxY + boxHeight - buttonHeight - 15;
  const textEndY = buttonY - 15;
  const availableHeight = textEndY - textStartY;
  const maxLinesByHeight = Math.floor(availableHeight / lineHeight);
  const finalMaxLines = Math.min(lines.length, maxLinesByHeight);

  lines.slice(0, finalMaxLines).forEach((line, i) => {
    const yPos = textStartY + (i * lineHeight);
    if (yPos < textEndY) {
      ctx.fillText(line, textStartX, yPos);
    }
  });

  // --- Render the CTA button (supports up to 2 wrapped lines) ---
  let ctaText = callToAction ? cleanAdText(callToAction).toUpperCase() : (isRTL ? 'התחל עכשיו!' : 'GET STARTED NOW!');

  ctx.font = 'bold 18px Arial';
  const ctaPadding = 15;
  const ctaMaxWidth = buttonWidth - (ctaPadding * 2);

  const ctaLines = wrapText(ctx, ctaText, ctaMaxWidth, isRTL);
  const ctaLineHeight = 22;
  const maxCtaLines = Math.min(ctaLines.length, 2);

  // Grow the button slightly if the CTA needs two lines
  const adjustedButtonHeight = maxCtaLines > 1 ? buttonHeight + 10 : buttonHeight;
  const adjustedButtonY = boxY + boxHeight - adjustedButtonHeight - 10;

  ctx.fillStyle = adStyle === 'minimal' ? '#333' : '#667eea';
  ctx.fillRect(buttonX, adjustedButtonY, buttonWidth, adjustedButtonHeight);

  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const ctaStartY = adjustedButtonY + (adjustedButtonHeight / 2) - ((maxCtaLines - 1) * ctaLineHeight / 2);

  ctaLines.slice(0, maxCtaLines).forEach((line, i) => {
    ctx.fillText(line, centerX, ctaStartY + (i * ctaLineHeight));
  });

  // --- Render agent credit watermark (bottom-left) ---
  if (agentName) {
    ctx.font = '11px Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const agentText = isRTL ? `נוצר ע"י ${agentName}` : `Created by ${agentName}`;
    ctx.fillText(agentText, 15, canvasHeight - 12);
  }

  // --- Draw the QR placeholder zone (dashed box + "Scan Me" label) ---
  if (hasWebsiteUrl) {
    const qrSize = 200;
    const qrCenterX = textSectionWidth + (qrSectionWidth / 2);
    const qrCenterY = canvasHeight / 2;
    const qrX = qrCenterX - (qrSize / 2);
    const qrY = qrCenterY - (qrSize / 2);

    // Dashed border indicating where the actual QR code will be composited
    ctx.strokeStyle = 'rgba(102, 126, 234, 0.4)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.strokeRect(qrX, qrY, qrSize, qrSize);
    ctx.setLineDash([]);

    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = '#667eea';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const scanText = isRTL ? 'סרקו אותי!' : 'SCAN ME!';
    ctx.fillText(scanText, qrCenterX, qrY - 15);

    // Placeholder phone emoji in the center of the QR zone
    ctx.font = '48px Arial';
    ctx.fillStyle = 'rgba(102, 126, 234, 0.3)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('📱', qrCenterX, qrCenterY);
  }

  console.log(`Ad design created (${canvasWidth}x${canvasHeight}${hasWebsiteUrl ? ', QR zone centered on right' : ', no QR section'})`);
  return canvas.toDataURL('image/png');
}

module.exports = {
  createCanvas,
  loadImage,
  cleanAdText,
  wrapText,
  createAdDesignOnServer
};
