// server.js - FINAL VERSION
// ✅ Full coverage box + Multi-line title + All fixes

/* ===== LOAD ENV ===== */
require('dotenv').config();
const path = require('path');
const fs = require('fs');

const projectRoot = path.resolve(__dirname, '..');
const envPath = path.join(projectRoot, '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

console.log('🔍 Environment Check:');
console.log('MONGODB_URI:', process.env.MONGODB_URI ? '✅ EXISTS' : '❌ MISSING');
console.log('First 50 chars:', process.env.MONGODB_URI?.substring(0, 50));

/* ===== MODULES ===== */
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');

// ✅ Try both canvas libraries (for compatibility)
let createCanvas, loadImage;
try {
  const canvas = require('canvas');
  createCanvas = canvas.createCanvas;
  loadImage = canvas.loadImage;
  console.log('✅ Using "canvas" library');
} catch (err) {
  const canvas = require('@napi-rs/canvas');
  createCanvas = canvas.createCanvas;
  loadImage = canvas.loadImage;
  console.log('✅ Using "@napi-rs/canvas" library');
}

const fetch = require('node-fetch');
const sharp = require('sharp');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const QRCode = require('qrcode');
const crypto = require('crypto');

/* ===== APP INIT ===== */
const app = express();

/* ===== CORS CONFIG ===== */
const allowedOrigins = [
  'https://adsmaker-frontend.vercel.app',
  'https://adsmaker-rho.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'https://adsmaker.onrender.com'
];
const vercelPreviewRegex = /adsmaker-.*\.vercel\.app$/;

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    try {
      const hostname = new URL(origin).hostname;
      if (allowedOrigins.includes(origin) || vercelPreviewRegex.test(hostname)) {
        callback(null, true);
      } else {
        console.error('🚫 CORS blocked origin:', origin);
        callback(new Error(`Not allowed by CORS: ${origin}`));
      }
    } catch (e) {
      console.error('🚫 CORS origin parse error:', origin, e.message);
      callback(new Error(`Not allowed by CORS: ${origin}`));
    }
  },
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/* ===== MONGODB ===== */
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

/* ===== MODELS ===== */
const Company = require('./models/Company');
const Campaign = require('./models/Campaign');
const User = require('./models/User');
const PendingAd = require('./models/PendingAd');
const QRScan = require('./models/QRScan');

/* ===== ROUTES ===== */
const companiesRouter = require('./routes/companies');
const campaignsRouter = require('./routes/campaigns');
const dashboardRouter = require('./routes/dashboard');
const authRouter = require('./routes/auth');
const pendingAdsRouter = require('./routes/pendingAds');
const agentsRouter = require('./routes/agents');
const requestsRouter = require('./routes/requests');
const usersRouter = require('./routes/users');
const aiRouter = require('./routes/ai');
const priceProposalsRouter = require('./routes/priceProposals');
const adsRouter = require('./routes/ads');
const qrRouter = require('./routes/qr');
const redirectRouter = require('./routes/redirect');
const analyticsRouter = require('./routes/analytics');

/* ===== REGISTER ROUTES ===== */
app.use('/api/auth', authRouter);
app.use('/api/companies', companiesRouter);
app.use('/api/campaigns', campaignsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/pending-ads', pendingAdsRouter);
app.use('/api/agents', agentsRouter);
app.use('/api/requests', requestsRouter);
app.use('/api/users', usersRouter);
app.use('/api', aiRouter);
app.use('/api/price-proposals', priceProposalsRouter);
app.use('/api/ads', adsRouter);
app.use('/api/qr', qrRouter);
app.use('/r', redirectRouter);
app.use('/api/analytics', analyticsRouter);

/* ===== HELPER FUNCTIONS ===== */

// ✅ Gemini with retry
async function callGeminiWithRetry(prompt, maxRetries = 3, model = 'gemini-2.5-flash') {
  console.log('📞 Calling Gemini API...');
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        { contents: [{ parts: [{ text: prompt }] }] },
        { timeout: 60000 }
      );
      console.log('✅ Gemini responded');
      return response.data.candidates[0].content.parts[0].text.trim();
    } catch (error) {
      console.error('❌ Gemini error:', error.message);
      lastError = error;
      if (error.response?.status === 503 && attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
      } else {
        break;
      }
    }
  }
  throw lastError;
}

// ✅ Helper: build prompt that asks for ad + image keyword
function buildGeminiAdAndImagePrompt({ businessName, productService, keyMessage, tone, language }) {
  return `
You are an expert marketing copywriter and a stock-photo search specialist.
You will receive a business name and a short description of product/service and tone.
Produce a STRICT JSON object ONLY with these fields:

{
  "title": "short ad title (max 10 words, in the same language as input)",
  "ad_text": "marketing body text (2-3 sentences, same language as input)",
  "call_to_action": "short CTA (3-5 words)",
  "image_keyword": "2-4 English words ONLY, visual nouns suitable for stock-photo search (photographable). No marketing adjectives. Use nouns or noun + descriptor",
  "image_style": "one word describing image style or context (spa, clinic, workshop, food, salon, outdoor, studio) - in English"
}

RULES:
- image_keyword MUST be in English, 2-4 words maximum (e.g. "shiatsu massage therapy", "laser hair removal clinic", "bakery bread").
- image_keyword must be VISUAL and PHOTOGRAPHABLE. No words like "best", "top", "affordable".
- image_style is optional but helpful (single English word).
- Title, ad_text and CTA should be in the same language as user input (if input is Hebrew, return those 3 fields in Hebrew).
- Output EXACTLY one JSON object and nothing else. Do not add explanation, markdown, or code fences.

INPUT:
Business name: "${businessName || ''}"
Product/service: "${productService || ''}"
Message/key points: "${keyMessage || ''}"
Tone: "${tone || 'professional'}"
Language preference: "${language || 'he'}"
`.trim();
}

// ✅ searchPexelsImage
async function searchPexelsImage(searchTerm, imageStyle = null) {
  console.log('🖼️ Pexels search for:', searchTerm, 'style:', imageStyle);

  if (!process.env.PEXELS_API_KEY) {
    console.log('⚠️ No Pexels API key - skipping search');
    return null;
  }

  if (!searchTerm || typeof searchTerm !== 'string' || searchTerm.trim().length === 0) {
    console.log('⚠️ Empty search term provided');
    return null;
  }

  const queries = [searchTerm.trim()];
  if (imageStyle && imageStyle.length <= 12) {
    queries.push(`${searchTerm.trim()} ${imageStyle}`);
  }
  const firstWord = searchTerm.trim().split(' ')[0];
  if (firstWord && firstWord.length > 2 && firstWord.toLowerCase() !== searchTerm.toLowerCase()) {
    queries.push(firstWord);
  }

  const uniqueQueries = [...new Set(queries)].slice(0, 4);

  for (let i = 0; i < uniqueQueries.length; i++) {
    const term = uniqueQueries[i];
    console.log(`🔍 Pexels attempt ${i + 1}: "${term}"`);
    try {
      const response = await axios.get('https://api.pexels.com/v1/search', {
        params: {
          query: term,
          per_page: 8,
          orientation: 'landscape'
        },
        headers: { Authorization: process.env.PEXELS_API_KEY },
        timeout: 6000
      });

      const photos = response.data.photos;
      if (photos && photos.length > 0) {
        const selectedPhoto = photos[0];
        const imageUrl = selectedPhoto.src.large2x || selectedPhoto.src.large || selectedPhoto.src.original;
        console.log(`✅ Found ${photos.length} images. Selected top result for term: "${term}"`);
        console.log(`📸 Image URL: ${imageUrl.substring(0, 120)}...`);
        return imageUrl;
      } else {
        console.log(`⚠️ No results for: "${term}"`);
      }
    } catch (err) {
      console.warn(`❌ Pexels search failed for "${term}":`, err.message);
    }

    if (i < uniqueQueries.length - 1) await new Promise(resolve => setTimeout(resolve, 250));
  }

  console.log('❌ All Pexels searches failed - will use gradient fallback');
  return null;
}

// ✅ Canvas helper functions
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

function wrapText(ctx, text, maxWidth) {
  if (!text) return [];
  const paragraphs = text.split(/\n+/);
  const lines = [];
  
  paragraphs.forEach(paragraph => {
    const trimmedParagraph = paragraph.trim();
    if (!trimmedParagraph) return;
    
    const words = trimmedParagraph.split(' ');
    let currentLine = '';
    
    for (let i = 0; i < words.length; i++) {
      const testWord = words[i];
      let testLine = currentLine + testWord + ' ';
      
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      
      if (testWidth > maxWidth && i > 0) {
        lines.push(currentLine.trim() + '\u200F');
        currentLine = testWord + ' ';
      } else {
        currentLine = testLine;
      }
    }
    
    if (currentLine.trim()) {
      lines.push(currentLine.trim() + '\u200F');
    }
  });
  
  return lines;
}

// ✅ FINAL: Full coverage box + Multi-line title
async function createAdDesignOnServer(adData) {
  console.log('🎨 Creating ad design...');
  const { businessName, adText, productService, adStyle, imageUrl, agentName, callToAction } = adData;
  const canvas = createCanvas(800, 450);
  const ctx = canvas.getContext('2d');

  const styles = {
    modern: { overlay: 'rgba(0, 0, 0, 0.5)', accent: '#667eea' },
    minimal: { overlay: 'rgba(255, 255, 255, 0.85)', textColor: '#333', accent: '#333' },
    elegant: { overlay: 'rgba(0, 0, 0, 0.6)', accent: '#d4af37' },
    dark: { overlay: 'rgba(0, 0, 0, 0.7)', accent: '#00d4ff' }
  };
  const selectedStyle = styles[adStyle] || styles.modern;

  // Load image or use gradient
  if (imageUrl) {
    try {
      console.log('🖼️ Loading background image...');
      const image = await loadImage(imageUrl);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      ctx.fillStyle = selectedStyle.overlay;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } catch (err) {
      console.log('🎨 Using gradient fallback');
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, '#667eea');
      gradient.addColorStop(1, '#764ba2');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  } else {
    console.log('⚠️ No imageUrl - using gradient');
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // ✅ FULL COVERAGE BOX - covers everything except QR zone
  const qrZoneWidth = 150;
  const boxX = qrZoneWidth;
  const boxY = 0;
  const boxWidth = canvas.width - qrZoneWidth;
  const boxHeight = canvas.height;

  ctx.fillStyle = adStyle === 'minimal' ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.5)';
  ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

  // ✅ TITLE - Multi-line support!
  const rawTitle = adData.title ? cleanAdText(adData.title).toUpperCase() : (businessName || 'BUSINESS').toUpperCase();
  const titleText = '\u202E' + rawTitle + '!';
  const titleX = boxX + boxWidth - 20;
  const titleY = 20;
  
  ctx.fillStyle = adStyle === 'minimal' ? '#222' : selectedStyle.accent;
  ctx.font = 'bold 30px Arial';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  
  // Wrap title if too long
  const titleLines = wrapText(ctx, titleText, boxWidth - 40);
  const titleLineHeight = 38;
  titleLines.slice(0, 2).forEach((line, i) => {
    ctx.fillText(line, titleX, titleY + (i * titleLineHeight));
  });
  
  const titleEndY = titleY + (Math.min(titleLines.length, 2) * titleLineHeight);

  // ✅ BODY TEXT
  const centerX = boxX + boxWidth / 2;
  ctx.fillStyle = adStyle === 'minimal' ? '#111' : '#fff';
  ctx.font = 'bold 23px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  
  const cleanText = cleanAdText(adText);
  const lines = wrapText(ctx, cleanText, boxWidth - 50);
  const textStartY = titleEndY + 25;
  
  lines.slice(0, 10).forEach((line, i) => {
    ctx.fillText(line, centerX, textStartY + (i * 29));
  });

  // ✅ CTA BUTTON
  const buttonY = canvas.height - 70;
  const buttonWidth = 360;
  const buttonHeight = 55;
  const buttonX = centerX - buttonWidth / 2;
  const ctaText = '\u202E' + (callToAction ? cleanAdText(callToAction).toUpperCase() : 'הירשמו עכשיו!');

  ctx.fillStyle = adStyle === 'minimal' ? '#333' : '#667eea';
  ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(ctaText, centerX, buttonY + 35);

  if (agentName) {
    ctx.font = '11px Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.textAlign = 'right';
    ctx.fillText(`נוצר ע"י ${agentName}`, canvas.width - 20, canvas.height - 15);
  }

  console.log('✅ Ad design created (FULL BOX + MULTI-LINE TITLE!)');
  return canvas.toDataURL('image/png');
}

/* ===== HEALTH CHECK ===== */
app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

/* ===== /api/generate-ad ===== */
app.post('/api/generate-ad', upload.single('image'), async (req, res) => {
  console.log('🚀 /api/generate-ad endpoint hit');

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

    console.log('📋 Request data:', { businessName, productService, campaignId, agentId, language });

    if (!businessName || !productService || !companyId || !campaignId || !agentId) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ success: false, error: 'שדות חובה חסרים' });
    }

    console.log('🔍 Loading campaign and agent...');
    const campaign = await Campaign.findById(campaignId);
    const agent = await User.findById(agentId);
    console.log('✅ Campaign and agent loaded');

    const adUniqueId = crypto.randomBytes(3).toString('hex').toUpperCase();
    console.log('🆔 Generated Ad Unique ID:', adUniqueId);

    const geminiPrompt = buildGeminiAdAndImagePrompt({ businessName, productService, keyMessage, tone, language });
    let geminiTextResponse;
    try {
      geminiTextResponse = await callGeminiWithRetry(geminiPrompt, 3, 'gemini-2.5-flash'); 
    } catch (gErr) {
      console.error('❌ Gemini failed completely:', gErr.message || gErr);
      throw new Error('Failed to generate ad text (Gemini)');
    }

    let geminiResponseJson;
    try {
      let jsonString = (geminiTextResponse || '').trim();
      const fencedMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (fencedMatch) {
        jsonString = fencedMatch[1];
      } else {
        const braceMatch = jsonString.match(/\{[\s\S]*\}/);
        if (braceMatch) jsonString = braceMatch[0];
      }
      geminiResponseJson = JSON.parse(jsonString);
      console.log('✅ Gemini response parsed:', geminiResponseJson);
    } catch (parseErr) {
      console.error('❌ JSON parsing failed:', parseErr.message);
      console.log('🔎 Raw Gemini response was:', geminiTextResponse);
      throw new Error("JSON from Gemini invalid");
    }

    let imageUrl = null;
    if (req.file) {
      imageUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
      console.log('✅ Using uploaded file for image background');
    } else {
      const keyword = (geminiResponseJson && geminiResponseJson.image_keyword) ? geminiResponseJson.image_keyword : `${businessName} ${productService}`;
      const style = geminiResponseJson && geminiResponseJson.image_style ? geminiResponseJson.image_style : adStyle;
      
      console.log(`🔎 Searching Pexels with: Keyword="${keyword}", Style="${style}"`);
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
      agentName: agent?.fullName || 'Ads Maker'
    });

    let adBuffer = Buffer.from(imageData.replace(/^data:image\/\w+;base64,/, ''), 'base64');

    const websiteUrl = campaign?.websiteUrl || reqWebsiteUrl;
    let qrCodeData = null;

    console.log('🔍 QR Check - websiteUrl:', websiteUrl);

    if (websiteUrl && websiteUrl.trim() !== '') {
      console.log('🔲 Generating QR code...');
      try {
        const uniqueId = crypto.randomBytes(6).toString('base64url');
        
        let targetUrl;
        try {
          targetUrl = new URL(websiteUrl);
        } catch (urlErr) {
          console.error('❌ Invalid URL:', websiteUrl);
          throw new Error('Invalid website URL');
        }
        
        targetUrl.searchParams.set('utm_source', `agent_${agentId}`);
        targetUrl.searchParams.set('utm_medium', 'qr');
        targetUrl.searchParams.set('utm_campaign', campaignId);

        const baseUrl = process.env.BASE_URL || 'https://adsmaker.onrender.com';
        const shortUrl = `${baseUrl}/r/${uniqueId}`;
        
        console.log('📝 QR Details:');
        console.log('   - Unique ID:', uniqueId);
        console.log('   - Short URL:', shortUrl);
        console.log('   - Target URL:', targetUrl.toString());
        
        const qrDataUrl = await QRCode.toDataURL(shortUrl, { 
          width: 200, 
          margin: 1,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });

        qrCodeData = {
          enabled: true,
          uniqueId,
          imageData: qrDataUrl,
          shortUrl,
          targetUrl: targetUrl.toString(),
          scans: 0
        };

        console.log('✅ QR code generated successfully');

        try {
          const qrBuffer = Buffer.from(qrDataUrl.replace(/^data:image\/\w+;base64,/, ''), 'base64');
          const metadata = await sharp(adBuffer).metadata();

          const qrSize = 110;
          const padding = 20;
          const borderSize = 7;
          const textHeight = 24;
          
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
          
          textCtx.fillStyle = '#333333';
          textCtx.font = 'bold 14px Arial';
          textCtx.textAlign = 'center';
          textCtx.fillText('↑ סרוק אותי', totalWidth / 2, 16);
          
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
          
          const left = padding;
          const top = metadata.height - totalHeight - padding;

          const shadowSize = 3;
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
              top: top - shadowSize, 
              left: left - shadowSize 
            }])
            .png()
            .toBuffer();

          imageData = `data:image/png;base64,${finalImage.toString('base64')}`;
          adBuffer = finalImage;

          console.log('✅ QR with label embedded successfully');
        } catch (embedErr) {
          console.error('⚠️ QR embed failed:', embedErr.message);
        }

        try {
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
              adTitle: geminiResponseJson.title || `${businessName} - מודעה`,
              businessName,
              productService
            }
          });
          await qrEntry.save();
          console.log('✅ QR scan entry saved to database with adUniqueId:', adUniqueId);
        } catch (dbErr) {
          console.error('⚠️ QR DB save failed:', dbErr.message);
        }

      } catch (qrError) {
        console.warn('⚠️ QR generation failed:', qrError.message);
      }
    } else {
      console.log('ℹ️ No website URL - skipping QR code generation');
    }

    console.log('💾 Saving ad to database...');
    const pendingAd = new PendingAd({
      uniqueId: adUniqueId,
      title: geminiResponseJson.title || `${businessName} - מודעה`,
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
        imageKeyword: geminiResponseJson.image_keyword,
        imageStyle: geminiResponseJson.image_style,
        adUniqueId
      }
    });

    await pendingAd.save();
    console.log('✅ Ad saved with ID:', adUniqueId, '(MongoDB:', pendingAd._id + ')', 'QR:', qrCodeData ? '✅' : '❌');

    return res.status(200).json({
      success: true,
      pendingAdId: pendingAd._id,
      adUniqueId,
      adData: {
        uniqueId: adUniqueId,
        title: pendingAd.title,
        text: pendingAd.text,
        callToAction: pendingAd.callToAction,
        imageUrl: pendingAd.imageData,
        qrCode: pendingAd.qrCode ? pendingAd.qrCode.imageData : null,
      }
    });

  } catch (error) {
    console.error('FATAL ERROR in /api/generate-ad:', error.message, error.stack);
    res.status(500).json({ 
      success: false, 
      error: 'שגיאה פנימית בשרת, נסה שוב מאוחר יותר.'
    });
  }
});

/* ===== START SERVER ===== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});