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

  cleaned = cleaned.replace(/[\!\?\.\,\;\:"]+$/, '').trim();

  return cleaned;
}

function wrapText(ctx, text, maxWidth, isRTL = true) {
  if (!text) return [];
  const paragraphs = text.split(/\n+/);
  const lines = [];

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
        if (currentLine.trim()) {
          const lineText = currentLine.trim();
          lines.push(isRTL ? (RLE + lineText + PDF) : lineText);
          currentLine = '';
        }

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

const STYLE_CONFIGS = {
  modern: { overlay: 'rgba(0, 0, 0, 0.5)', accent: '#667eea', qrBg: 'rgba(255, 255, 255, 0.95)' },
  minimal: { overlay: 'rgba(255, 255, 255, 0.85)', textColor: '#333', accent: '#333', qrBg: 'rgba(240, 240, 240, 0.95)' },
  elegant: { overlay: 'rgba(0, 0, 0, 0.6)', accent: '#d4af37', qrBg: 'rgba(255, 255, 255, 0.95)' },
  dark: { overlay: 'rgba(0, 0, 0, 0.7)', accent: '#00d4ff', qrBg: 'rgba(255, 255, 255, 0.9)' }
};

async function createAdDesignOnServer(adData) {
  const { businessName, adText, productService, adStyle, imageUrl, agentName, callToAction, language, websiteUrl } = adData;

  const hasWebsiteUrl = websiteUrl && websiteUrl.trim() !== '';

  const canvasHeight = 450;
  const qrSectionWidth = hasWebsiteUrl ? 300 : 0;
  const textSectionWidth = hasWebsiteUrl ? 750 : 900;
  const canvasWidth = textSectionWidth + qrSectionWidth;

  console.log(`Creating ad design (${hasWebsiteUrl ? 'with QR zone' : 'no QR - full width'})...`);

  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');

  const isRTL = language === 'Hebrew' || language === 'Arabic';
  const selectedStyle = STYLE_CONFIGS[adStyle] || STYLE_CONFIGS.modern;

  if (imageUrl) {
    try {
      const image = await loadImage(imageUrl);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, textSectionWidth, canvasHeight);
      ctx.clip();
      ctx.drawImage(image, 0, 0, textSectionWidth, canvasHeight);
      ctx.fillStyle = selectedStyle.overlay;
      ctx.fillRect(0, 0, textSectionWidth, canvasHeight);
      ctx.restore();
    } catch (err) {
      console.log('Using gradient fallback for text section');
      const gradient = ctx.createLinearGradient(0, 0, textSectionWidth, canvasHeight);
      gradient.addColorStop(0, '#667eea');
      gradient.addColorStop(1, '#764ba2');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, textSectionWidth, canvasHeight);
    }
  } else {
    const gradient = ctx.createLinearGradient(0, 0, textSectionWidth, canvasHeight);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, textSectionWidth, canvasHeight);
  }

  if (hasWebsiteUrl) {
    ctx.fillStyle = selectedStyle.qrBg;
    ctx.fillRect(textSectionWidth, 0, qrSectionWidth, canvasHeight);

    ctx.strokeStyle = 'rgba(102, 126, 234, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(textSectionWidth, 20);
    ctx.lineTo(textSectionWidth, canvasHeight - 20);
    ctx.stroke();
  }

  const boxPadding = 40;
  const boxHeight = 370;
  const boxY = (canvasHeight - boxHeight) / 2;
  const boxWidth = textSectionWidth - (boxPadding * 2);
  const boxX = boxPadding;

  ctx.fillStyle = adStyle === 'minimal' ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.4)';
  ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

  const centerX = boxX + boxWidth / 2;

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

  ctx.textAlign = isRTL ? 'right' : 'left';
  ctx.fillStyle = adStyle === 'minimal' ? '#111' : '#fff';
  ctx.font = 'bold 24px Arial';
  ctx.textBaseline = 'alphabetic';
  const cleanText = cleanAdText(adText);

  const textPadding = 30;
  const availableWidth = boxWidth - (textPadding * 2);
  const lines = wrapText(ctx, cleanText, availableWidth, isRTL);

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

  let ctaText = callToAction ? cleanAdText(callToAction).toUpperCase() : (isRTL ? 'התחל עכשיו!' : 'GET STARTED NOW!');

  ctx.font = 'bold 18px Arial';
  const ctaPadding = 15;
  const ctaMaxWidth = buttonWidth - (ctaPadding * 2);

  const ctaLines = wrapText(ctx, ctaText, ctaMaxWidth, isRTL);
  const ctaLineHeight = 22;
  const maxCtaLines = Math.min(ctaLines.length, 2);

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

  if (agentName) {
    ctx.font = '11px Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const agentText = isRTL ? `נוצר ע"י ${agentName}` : `Created by ${agentName}`;
    ctx.fillText(agentText, 15, canvasHeight - 12);
  }

  if (hasWebsiteUrl) {
    const qrSize = 200;
    const qrCenterX = textSectionWidth + (qrSectionWidth / 2);
    const qrCenterY = canvasHeight / 2;
    const qrX = qrCenterX - (qrSize / 2);
    const qrY = qrCenterY - (qrSize / 2);

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
