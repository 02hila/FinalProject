/**
 * adController.js -- Ad Generation Controller
 *
 * Purpose:
 *   Orchestrates end-to-end advertisement generation. Receives creative
 *   parameters from the client, calls the Gemini LLM to produce ad copy and
 *   image keywords, fetches or accepts a background image, renders the final
 *   ad graphic on a server-side canvas, optionally generates and embeds a QR
 *   code linking to the advertiser's website, and returns the composed result
 *   along with all metadata needed to persist the ad.
 *
 * Main logic:
 *   1. Validate required fields and check the Gemini rate limiter.
 *   2. Call Gemini to generate structured ad copy (title, body, CTA, image keyword).
 *   3. Resolve the background image (uploaded file or Pexels search).
 *   4. Render the ad design via the canvas service.
 *   5. If a website URL is available, generate a QR code with UTM tracking,
 *      embed it into the ad image, and persist a QRScan record.
 *   6. Record the generation event against the rate limiter and respond.
 *
 * Key exports:
 *   - generateAd        -- POST handler for /api/generate-ad.
 *   - getRateLimitStatus -- GET handler for /api/rate-limit/status.
 *
 * Connections:
 *   - geminiService: LLM prompt building, calling with retry, JSON parsing.
 *   - pexelsService: stock image search when no image is uploaded.
 *   - canvasService: server-side ad rendering (createAdDesignOnServer, createCanvas).
 *   - geminiRateLimiter: daily quota enforcement for Gemini API calls.
 *   - Models: Campaign, User, QRScan.
 */

const crypto = require('crypto');
const sharp = require('sharp');
const QRCode = require('qrcode');

const Campaign = require('../models/Campaign');
const User = require('../models/User');
const QRScan = require('../models/QRScan');

const { callGeminiWithRetry, buildGeminiAdAndImagePrompt, parseGeminiJsonResponse } = require('../services/geminiService');
const { searchPexelsImage } = require('../services/pexelsService');
const { createAdDesignOnServer, createCanvas } = require('../services/canvasService');
const geminiRateLimiter = require('../services/geminiRateLimiter');

/**
 * Generates a complete advertisement image with AI-written copy.
 *
 * @description Accepts creative brief fields and an optional uploaded image,
 *   orchestrates Gemini text generation, background image resolution, canvas
 *   rendering, and optional QR code embedding. Returns the finished ad as a
 *   base64-encoded PNG together with structured save data for database storage.
 *
 * @param {import('express').Request} req - Express request. Expected body fields:
 *   businessName, productService, targetAudience, keyMessage, tone, language,
 *   adStyle, companyId, campaignId, agentId, websiteUrl. An optional file may
 *   be attached under the "image" field (handled by multer).
 * @param {import('express').Response} res - Express response.
 *
 * @returns {void} Sends a JSON response with { success, adUniqueId, adData, saveData }
 *   on success, or an error payload (400 / 429 / 500) on failure.
 */
async function generateAd(req, res) {
  console.log('/api/generate-ad endpoint hit');

  try {
    const {
      businessName,
      productService,
      targetAudience,
      keyMessage,
      tone,
      language,
      adStyle,
      companyId,
      campaignId,
      agentId,
      websiteUrl: reqWebsiteUrl
    } = req.body;

    console.log('Request data:', { businessName, productService, campaignId, agentId, language });

    if (!businessName || !productService || !companyId || !campaignId || !agentId) {
      console.log('Missing required fields');
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // --- Rate limiter gate ---
    // Checks the daily Gemini quota before making any expensive calls.
    const rateLimitCheck = await geminiRateLimiter.canGenerateAd();
    if (!rateLimitCheck.allowed) {
      console.log(`Rate limit blocked: ${rateLimitCheck.errorCode}`);
      return res.status(429).json({
        success: false,
        error: rateLimitCheck.error,
        errorCode: rateLimitCheck.errorCode,
        remaining: rateLimitCheck.remaining || 0,
        waitTime: rateLimitCheck.waitTime || null
      });
    }
    console.log(`Rate limit OK. Remaining: ${rateLimitCheck.remaining}/${geminiRateLimiter.DAILY_LIMIT}`);

    const campaign = await Campaign.findById(campaignId);
    const agent = await User.findById(agentId);

    // Short random hex string used as a human-friendly ad identifier.
    const adUniqueId = crypto.randomBytes(3).toString('hex').toUpperCase();
    console.log('Generated Ad Unique ID:', adUniqueId);

    // --- Gemini AI call ---
    // Build a structured prompt and call Gemini to produce ad copy, a CTA,
    // and suggested image search terms in a single JSON response.
    const geminiPrompt = buildGeminiAdAndImagePrompt({ businessName, productService, keyMessage, tone, language });
    let geminiTextResponse;
    try {
      geminiTextResponse = await callGeminiWithRetry(geminiPrompt, 3, 'gemini-2.5-flash');
    } catch (gErr) {
      console.error('Gemini failed completely:', gErr.message || gErr);
      throw new Error('Failed to generate ad text (Gemini)');
    }

    // Parse the raw Gemini output into a structured JSON object.
    let geminiResponseJson;
    try {
      geminiResponseJson = parseGeminiJsonResponse(geminiTextResponse);
      console.log('Gemini response parsed:', geminiResponseJson);
    } catch (parseErr) {
      console.error('JSON parsing failed:', parseErr.message);
      throw new Error('JSON from Gemini invalid');
    }

    // Prefer the campaign-level URL; fall back to the one sent in the request.
    const websiteUrl = campaign?.websiteUrl || reqWebsiteUrl;
    console.log('Website URL:', websiteUrl || 'None - no QR code will be generated');

    // --- Background image resolution ---
    // If the user uploaded a file it is used directly as a base64 data URL;
    // otherwise, the Gemini-suggested keyword is fed into Pexels image search.
    let imageUrl = null;
    if (req.file) {
      imageUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
      console.log('Using uploaded file for image background');
    } else {
      const keyword = geminiResponseJson?.image_keyword || `${businessName} ${productService}`;
      const style = geminiResponseJson?.image_style || adStyle;
      console.log(`Searching Pexels with: Keyword="${keyword}", Style="${style}"`);
      imageUrl = await searchPexelsImage(keyword, style);
    }

    // --- Canvas rendering ---
    // Compose the final ad image on a server-side canvas, layering the
    // background, text overlays, and branding elements.
    let imageData = await createAdDesignOnServer({
      businessName,
      adText: geminiResponseJson.ad_text,
      title: geminiResponseJson.title,
      callToAction: geminiResponseJson.call_to_action,
      productService,
      adStyle,
      imageUrl,
      agentName: agent?.fullName || 'Ads Maker',
      language: language || 'Hebrew',
      websiteUrl
    });

    // Convert the base64 data URL to a raw Buffer for further compositing.
    let adBuffer = Buffer.from(imageData.replace(/^data:image\/\w+;base64,/, ''), 'base64');

    // --- QR code generation and embedding ---
    let qrCodeData = null;

    if (websiteUrl && websiteUrl.trim() !== '') {
      console.log('Generating QR code...');
      try {
        // Create a unique short-URL identifier for scan tracking.
        const uniqueId = crypto.randomBytes(6).toString('base64url');

        let targetUrl;
        try {
          targetUrl = new URL(websiteUrl);
        } catch (urlErr) {
          console.error('Invalid URL:', websiteUrl);
          throw new Error('Invalid website URL');
        }

        // Append UTM parameters so the advertiser can track QR-driven traffic.
        targetUrl.searchParams.set('utm_source', `agent_${agentId}`);
        targetUrl.searchParams.set('utm_medium', 'qr');
        targetUrl.searchParams.set('utm_campaign', campaignId);

        const baseUrl = process.env.BASE_URL || 'https://adsmaker.onrender.com';
        const shortUrl = `${baseUrl}/r/${uniqueId}`;

        // Render the QR code as a data-URL PNG at 200x200 pixels.
        const qrDataUrl = await QRCode.toDataURL(shortUrl, {
          width: 200,
          margin: 1,
          color: { dark: '#000000', light: '#FFFFFF' }
        });

        qrCodeData = {
          enabled: true,
          uniqueId,
          imageData: qrDataUrl,
          shortUrl,
          targetUrl: targetUrl.toString(),
          scans: 0
        };

        console.log('QR code generated successfully');

        // Composite the QR code (with a "Scan me!" label) onto the ad image.
        try {
          const result = await embedQrInAd(adBuffer, qrDataUrl, language);
          imageData = result.imageData;
          adBuffer = result.adBuffer;
          console.log('QR with label embedded successfully');
        } catch (embedErr) {
          console.error('QR embed failed:', embedErr.message);
        }

        // Persist a QRScan document so that redirects can be tracked later.
        try {
          const isRTL = language === 'Hebrew' || language === 'Arabic';
          const qrEntry = new QRScan({
            uniqueId,
            campaignId,
            agentId,
            companyId,
            adUniqueId,
            fullUrl: shortUrl,
            targetUrl: targetUrl.toString(),
            qrImageData: qrDataUrl,
            metadata: {
              adTitle: geminiResponseJson.title || `${businessName} - ${isRTL ? 'מודעה' : 'Ad'}`,
              businessName,
              productService
            }
          });
          await qrEntry.save();
          console.log('QR scan entry saved to database with adUniqueId:', adUniqueId);
        } catch (dbErr) {
          console.error('QR DB save failed:', dbErr.message);
        }

      } catch (qrError) {
        console.warn('QR generation failed:', qrError.message);
      }
    } else {
      console.log('No website URL - skipping QR code generation');
    }

    // Record the successful generation against the daily rate limiter.
    await geminiRateLimiter.recordGeneration('manual', adUniqueId);

    const isRTL = language === 'Hebrew' || language === 'Arabic';

    return res.status(200).json({
      success: true,
      pendingAdId: null,
      adUniqueId,
      adData: {
        uniqueId: adUniqueId,
        title: geminiResponseJson.title || `${businessName} - ${isRTL ? 'מודעה' : 'Ad'}`,
        text: geminiResponseJson.ad_text || '',
        callToAction: geminiResponseJson.call_to_action || '',
        imageUrl: imageData,
        qrCode: qrCodeData ? qrCodeData.imageData : null,
      },
      saveData: {
        uniqueId: adUniqueId,
        title: geminiResponseJson.title || `${businessName} - ${isRTL ? 'מודעה' : 'Ad'}`,
        text: geminiResponseJson.ad_text || '',
        callToAction: geminiResponseJson.call_to_action || '',
        imageData,
        companyId,
        campaignId,
        agentId,
        qrCode: qrCodeData,
        websiteUrl: websiteUrl || '',
        metadata: {
          businessName,
          productService,
          targetAudience,
          keyMessage,
          tone,
          adStyle,
          language: language || 'Hebrew',
          imageKeyword: geminiResponseJson.image_keyword,
          imageStyle: geminiResponseJson.image_style,
          adUniqueId,
          lastImageUrl: imageUrl
        }
      }
    });

  } catch (error) {
    console.error('FATAL ERROR in /api/generate-ad:', error.message, error.stack);
    res.status(500).json({
      success: false,
      error: 'Internal server error. Please try again later.'
    });
  }
}

/**
 * Embeds a QR code with a localized "Scan me!" label onto the right-hand
 * section of an ad image.
 *
 * @description Uses Sharp to resize the QR code, add a white border, render
 *   a text label via a canvas, apply a drop shadow, and composite the result
 *   onto the ad buffer at a calculated center position within the QR column.
 *
 * @param {Buffer} adBuffer     - Raw PNG buffer of the base ad image.
 * @param {string} qrDataUrl    - Base64 data URL of the QR code image.
 * @param {string} language      - Language code; determines RTL label text.
 *
 * @returns {Promise<{ imageData: string, adBuffer: Buffer }>}
 *   imageData is a base64 data URL; adBuffer is the raw PNG buffer.
 */
async function embedQrInAd(adBuffer, qrDataUrl, language) {
  // Decode the QR data URL into a raw image buffer.
  const qrBuffer = Buffer.from(qrDataUrl.replace(/^data:image\/\w+;base64,/, ''), 'base64');

  const qrSize = 160;
  const borderSize = 10;
  const textHeight = 30;

  // Resize QR to a fixed dimension and add a white border around it.
  const styledQR = await sharp(qrBuffer)
    .resize(qrSize, qrSize)
    .extend({
      top: borderSize,
      bottom: borderSize,
      left: borderSize,
      right: borderSize,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    })
    .png()
    .toBuffer();

  const qrWithBorder = await sharp(styledQR).metadata();

  const totalHeight = qrWithBorder.height + textHeight;
  const totalWidth = qrWithBorder.width;

  // Render the "Scan me!" label using the node-canvas API.
  const textCanvas = createCanvas(totalWidth, textHeight);
  const textCtx = textCanvas.getContext('2d');

  textCtx.fillStyle = '#FFFFFF';
  textCtx.fillRect(0, 0, totalWidth, textHeight);

  textCtx.fillStyle = '#667eea';
  textCtx.font = 'bold 16px Arial';
  textCtx.textAlign = 'center';
  const isRTL = language === 'Hebrew' || language === 'Arabic';
  const qrLabel = isRTL ? '↑ סרקו אותי!' : '↑ Scan me!';
  textCtx.fillText(qrLabel, totalWidth / 2, 20);

  const textBuffer = textCanvas.toBuffer('image/png');

  // Stack the QR image on top and the label underneath.
  const qrWithText = await sharp({
    create: {
      width: totalWidth,
      height: totalHeight,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  })
    .composite([
      { input: styledQR, top: 0, left: 0 },
      { input: textBuffer, top: qrWithBorder.height, left: 0 }
    ])
    .png()
    .toBuffer();

  // Ad layout constants: the ad canvas is split into a text section (left)
  // and a QR section (right). The QR block is centered within the right column.
  const textSectionWidth = 750;
  const qrSectionWidth = 300;
  const canvasHeight = 450;

  const qrCenterX = textSectionWidth + (qrSectionWidth / 2);
  const qrCenterY = canvasHeight / 2;

  const left = qrCenterX - (totalWidth / 2);
  const top = qrCenterY - (totalHeight / 2);

  // Create a subtle drop shadow behind the QR block for visual separation.
  const shadowSize = 4;
  const qrWithShadow = await sharp({
    create: {
      width: totalWidth + shadowSize * 2,
      height: totalHeight + shadowSize * 2,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0.25 }
    }
  })
    .composite([
      { input: qrWithText, top: shadowSize, left: shadowSize }
    ])
    .png()
    .toBuffer();

  // Final compositing: overlay the QR+shadow block onto the ad image.
  const finalImage = await sharp(adBuffer)
    .composite([{
      input: qrWithShadow,
      top: Math.max(0, Math.round(top - shadowSize)),
      left: Math.max(0, Math.round(left - shadowSize))
    }])
    .png()
    .toBuffer();

  return {
    imageData: `data:image/png;base64,${finalImage.toString('base64')}`,
    adBuffer: finalImage
  };
}

/**
 * Returns the current Gemini rate-limiter status.
 *
 * @description Responds with the number of remaining generations, the daily
 *   limit, and any applicable cooldown information.
 *
 * @param {import('express').Request} req - Express request (no params needed).
 * @param {import('express').Response} res - Express response.
 *
 * @returns {void} Sends JSON with { success, remaining, limit, ... }.
 */
async function getRateLimitStatus(req, res) {
  try {
    const status = await geminiRateLimiter.getStatus();
    res.json({ success: true, ...status });
  } catch (error) {
    console.error('Error getting rate limit status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  generateAd,
  getRateLimitStatus,
  embedQrInAd
};
