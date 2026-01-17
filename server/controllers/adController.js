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

    const adUniqueId = crypto.randomBytes(3).toString('hex').toUpperCase();
    console.log('Generated Ad Unique ID:', adUniqueId);

    const geminiPrompt = buildGeminiAdAndImagePrompt({ businessName, productService, keyMessage, tone, language });
    let geminiTextResponse;
    try {
      geminiTextResponse = await callGeminiWithRetry(geminiPrompt, 3, 'gemini-2.5-flash');
    } catch (gErr) {
      console.error('Gemini failed completely:', gErr.message || gErr);
      throw new Error('Failed to generate ad text (Gemini)');
    }

    let geminiResponseJson;
    try {
      geminiResponseJson = parseGeminiJsonResponse(geminiTextResponse);
      console.log('Gemini response parsed:', geminiResponseJson);
    } catch (parseErr) {
      console.error('JSON parsing failed:', parseErr.message);
      throw new Error('JSON from Gemini invalid');
    }

    const websiteUrl = campaign?.websiteUrl || reqWebsiteUrl;
    console.log('Website URL:', websiteUrl || 'None - no QR code will be generated');

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

    let adBuffer = Buffer.from(imageData.replace(/^data:image\/\w+;base64,/, ''), 'base64');

    let qrCodeData = null;

    if (websiteUrl && websiteUrl.trim() !== '') {
      console.log('Generating QR code...');
      try {
        const uniqueId = crypto.randomBytes(6).toString('base64url');

        let targetUrl;
        try {
          targetUrl = new URL(websiteUrl);
        } catch (urlErr) {
          console.error('Invalid URL:', websiteUrl);
          throw new Error('Invalid website URL');
        }

        targetUrl.searchParams.set('utm_source', `agent_${agentId}`);
        targetUrl.searchParams.set('utm_medium', 'qr');
        targetUrl.searchParams.set('utm_campaign', campaignId);

        const baseUrl = process.env.BASE_URL || 'https://adsmaker.onrender.com';
        const shortUrl = `${baseUrl}/r/${uniqueId}`;

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

        try {
          const result = await embedQrInAd(adBuffer, qrDataUrl, language);
          imageData = result.imageData;
          adBuffer = result.adBuffer;
          console.log('QR with label embedded successfully');
        } catch (embedErr) {
          console.error('QR embed failed:', embedErr.message);
        }

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

async function embedQrInAd(adBuffer, qrDataUrl, language) {
  const qrBuffer = Buffer.from(qrDataUrl.replace(/^data:image\/\w+;base64,/, ''), 'base64');

  const qrSize = 160;
  const borderSize = 10;
  const textHeight = 30;

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

  const textSectionWidth = 750;
  const qrSectionWidth = 300;
  const canvasHeight = 450;

  const qrCenterX = textSectionWidth + (qrSectionWidth / 2);
  const qrCenterY = canvasHeight / 2;

  const left = qrCenterX - (totalWidth / 2);
  const top = qrCenterY - (totalHeight / 2);

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
  getRateLimitStatus
};
