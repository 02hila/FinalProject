// server.js - FINAL UNIFIED VERSION
// Combines: QR Code + Smart Translation + All Routes

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

// ✅ Translation function
async function translateToEnglishForImageSearch(hebrewText) {
  console.log('🌐 Translating to English for image search:', hebrewText);
  
  const prompt = `You are a translation expert for stock photo searches. 
Translate the following Hebrew business/product term to simple, visual English keywords suitable for Pexels image search.

Hebrew text: "${hebrewText}"

CRITICAL RULES:
1. Output 2-4 simple English words ONLY
2. Focus on VISUAL, CONCRETE objects that can be photographed
3. IGNORE marketing language, adjectives, and story - focus ONLY on the PRODUCT/SERVICE
4. If you see a brand name that hints at the product, USE IT:
   - "תפוזינה" (sounds like "Tapuz" = Orange) → "orange juice"
   - "שוקולינה" (sounds like "Shokolad" = Chocolate) → "chocolate"
5. Remove words like: "new", "amazing", "revolutionary"
6. Use ONLY nouns and maybe one descriptor

Examples:
- "תפוזינה משקה חדש מיוחד" → "orange juice"
- "שוקולינה עוגיות" → "chocolate cookies"
- "שיעורים פרטיים" → "tutoring student"
- "ייעוץ עסקי" → "business consultant"
- "קורס בישול" → "cooking class"
- "מספרה" → "barber salon"
- "יוגה בפארק" → "yoga outdoor"

Output ONLY 2-4 English keywords, nothing else.`;

  try {
    const response = await callGeminiWithRetry(prompt, 2, 'gemini-2.0-flash-exp');
    let englishTerm = response
      .replace(/[*"'`\n]/g, '')
      .replace(/Keywords?:/gi, '')
      .replace(/English:/gi, '')
      .trim()
      .toLowerCase();
    
    // Validation
    const words = englishTerm.split(' ').filter(w => w.length > 0);
    if (words.length > 6) {
      console.warn('⚠️ Translation too long, extracting key terms...');
      englishTerm = words.slice(0, 4).join(' ');
    }
    if (words.length === 0) {
      console.warn('⚠️ Empty translation, using fallback');
      englishTerm = 'business product';
    }
    
    console.log(`✅ Translated: "${hebrewText}" → "${englishTerm}"`);
    return englishTerm;
  } catch (error) {
    console.warn('⚠️ Translation failed:', error.message);
    const englishWords = hebrewText.match(/[a-zA-Z]+/g);
    if (englishWords && englishWords.length > 0) {
      return englishWords.join(' ').toLowerCase();
    }
    return 'business product';
  }
}

// ✅ Pexels search with translation
async function searchPexelsImage(searchTerm) {
  console.log('🖼️ Starting Pexels search for:', searchTerm);
  
  if (!process.env.PEXELS_API_KEY) {
    console.log('⚠️ No Pexels API key - skipping search');
    return null;
  }
  
  // Auto-translate Hebrew
  let translatedTerm = searchTerm;
  const hasHebrew = /[\u0590-\u05FF]/.test(searchTerm);
  
  if (hasHebrew) {
    console.log('🔤 Detected Hebrew text - translating...');
    try {
      translatedTerm = await translateToEnglishForImageSearch(searchTerm);
    } catch (err) {
      console.warn('⚠️ Translation failed, will try with original');
      translatedTerm = searchTerm;
    }
  }
  
  // Clean stop words
  const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for'];
  const keywords = translatedTerm
    .split(' ')
    .filter(word => word.length > 2 && !stopWords.includes(word))
    .join(' ');
  
  // Search terms - specific to generic
  const searchTerms = [
    keywords,
    translatedTerm,
    `${keywords} professional`,
    `${keywords.split(' ')[0]}`,
    'business professional modern',
    'office workplace'
  ].filter(term => term && term.length > 2);
  
  // Try each search term
  for (let i = 0; i < Math.min(searchTerms.length, 6); i++) {
    const term = searchTerms[i];
    console.log(`🔍 Attempt ${i + 1}/6: "${term}"`);
    
    try {
      const response = await axios.get('https://api.pexels.com/v1/search', {
        params: { 
          query: term, 
          per_page: 10,
          orientation: 'landscape',
          size: 'large'
        },
        headers: { Authorization: process.env.PEXELS_API_KEY },
        timeout: 5000
      });
      
      const photos = response.data.photos;
      
      if (photos && photos.length > 0) {
        // Random selection from top 3
        const randomIndex = Math.floor(Math.random() * Math.min(3, photos.length));
        const selectedPhoto = photos[randomIndex];
        const imageUrl = selectedPhoto.src.large2x || selectedPhoto.src.large;
        
        console.log(`✅ Success! Found ${photos.length} images with term: "${term}"`);
        console.log(`🎲 Selected image #${randomIndex + 1} randomly`);
        console.log(`📸 Image URL: ${imageUrl.substring(0, 60)}...`);
        
        return imageUrl;
      } else {
        console.log(`⚠️ No results for: "${term}"`);
      }
      
    } catch (err) {
      console.warn(`❌ Search failed for "${term}":`, err.message);
    }
    
    if (i < searchTerms.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
  
  console.log('❌ All Pexels searches failed - will use gradient fallback');
  return null;
}

// ✅ Canvas helper functions
function cleanAdText(text) {
  if (!text) return '';
  return text
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
      const testLine = currentLine + words[i] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      
      if (testWidth > maxWidth && i > 0) {
        lines.push(currentLine.trim());
        currentLine = words[i] + ' ';
      } else {
        currentLine = testLine;
      }
    }
    
    if (currentLine.trim()) {
      lines.push(currentLine.trim());
    }
  });
  
  return lines;
}

// ✅ Create ad design
async function createAdDesignOnServer(adData) {
  console.log('🎨 Creating ad design...');
  const { businessName, adText, productService, adStyle, imageUrl, agentName } = adData;
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

  // Content box (leave space for QR)
  const boxPadding = 50;
  const qrZoneWidth = 160;
  const boxHeight = 380;
  const boxY = (canvas.height - boxHeight) / 2 - 10;
  const boxWidth = canvas.width - (boxPadding * 2) - qrZoneWidth;
  const boxX = boxPadding + qrZoneWidth;

  ctx.fillStyle = adStyle === 'minimal' ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.4)';
  ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

  // Title
  ctx.fillStyle = adStyle === 'minimal' ? '#222' : selectedStyle.accent;
  ctx.font = 'bold 44px Arial';
  ctx.textAlign = 'center';
  const centerX = boxX + boxWidth / 2;
  ctx.fillText((businessName || 'BUSINESS').toUpperCase(), centerX, boxY + 60);

  // Body text
  ctx.fillStyle = adStyle === 'minimal' ? '#111' : '#fff';
  ctx.font = 'bold 26px Arial';
  const cleanText = cleanAdText(adText);
  const lines = wrapText(ctx, cleanText, boxWidth - 40);
  lines.slice(0, 6).forEach((line, i) => {
    ctx.fillText(line, centerX, boxY + 110 + (i * 36));
  });

  // CTA Button
  const buttonY = boxY + boxHeight - 70;
  const buttonWidth = 320;
  const buttonHeight = 50;
  const buttonX = centerX - buttonWidth / 2;

  ctx.fillStyle = adStyle === 'minimal' ? '#333' : '#667eea';
  ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px Arial';
  ctx.fillText('GET STARTED NOW!', centerX, buttonY + 32);

  // Agent signature
  if (agentName) {
    ctx.font = '12px Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.textAlign = 'right';
    ctx.fillText(`נוצר ע"י ${agentName}`, canvas.width - 20, canvas.height - 20);
  }

  console.log('✅ Ad design created (with QR zone reserved)');
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

    console.log('📋 Request data:', { businessName, productService, campaignId, agentId });

    if (!businessName || !productService || !companyId || !campaignId || !agentId) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ success: false, error: 'שדות חובה חסרים' });
    }

    console.log('🔍 Loading campaign and agent...');
    const campaign = await Campaign.findById(campaignId);
    const agent = await User.findById(agentId);
    console.log('✅ Campaign and agent loaded');

    const prompt = `
אתה כותב תוכן שיווקי מקצועי. צור מודעה על בסיס:

שם החברה: ${businessName}
מוצר/שירות: ${productService}
מסר: ${keyMessage}
סגנון: ${tone}

תשובה בפורמט JSON בלבד:
{
  "title": "",
  "body_text": "",
  "call_to_action": ""
}
`;

    // Gemini call
    let geminiTextResponse;
    try {
      geminiTextResponse = await callGeminiWithRetry(prompt);
    } catch (gErr) {
      console.error('❌ Gemini failed completely:', gErr.message || gErr);
      throw new Error('Failed to generate ad text (Gemini)');
    }

    let geminiResponseJson;
    console.log('📝 Parsing Gemini response...');
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

    // Image search
    let imageUrl = req.file
      ? `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`
      : await searchPexelsImage(`${businessName} ${productService}`);

    // Create ad
    let imageData = await createAdDesignOnServer({
      businessName,
      adText: geminiResponseJson.body_text,
      productService,
      adStyle,
      imageUrl,
      agentName: agent?.fullName || 'Ads Maker'
    });

    let adBuffer = Buffer.from(imageData.replace(/^data:image\/\w+;base64,/, ''), 'base64');

    // QR Code Generation
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

        // Embed QR in ad
        try {
          const qrBuffer = Buffer.from(qrDataUrl.replace(/^data:image\/\w+;base64,/, ''), 'base64');
          const metadata = await sharp(adBuffer).metadata();

          const qrSize = 110;
          const padding = 20;
          const borderSize = 8;
          const textHeight = 25;
          
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
          textCtx.fillText('↑ סרוק אותי', totalWidth / 2, 17);
          
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

        // Save QR to DB
        try {
          const qrEntry = new QRScan({
            uniqueId,
            campaignId,
            agentId,
            companyId,
            fullUrl: shortUrl,
            targetUrl: targetUrl.toString(),
            qrImageData: qrDataUrl
          });
          await qrEntry.save();
          console.log('✅ QR scan entry saved to database');
        } catch (dbErr) {
          console.error('⚠️ QR DB save failed:', dbErr.message);
        }

      } catch (qrError) {
        console.warn('⚠️ QR generation failed:', qrError.message);
      }
    } else {
      console.log('ℹ️ No website URL - skipping QR code generation');
    }

    // Save ad to DB
    console.log('💾 Saving ad to database...');
    const pendingAd = new PendingAd({
      title: geminiResponseJson.title || `${businessName} - מודעה`,
      text: geminiResponseJson.body_text || '',
      callToAction: geminiResponseJson.call_to_action || '',
      imageData,
      companyId,
      campaignId,
      agentId,
      qrCode: qrCodeData,
      websiteUrl: websiteUrl || '',
      metadata: { businessName, productService, targetAudience, keyMessage, tone, adStyle }
    });

    await pendingAd.save();
    console.log('✅ Ad saved:', pendingAd._id, 'QR:', qrCodeData ? '✅' : '❌');

    return res.json({ success: true, ad: pendingAd, qrGenerated: !!qrCodeData });

  } catch (error) {
    console.error('💥 Error:', error);
    return res.status(500).json({ success: false, error: "שגיאה ביצירת מודעה" });
  }
});

/* ===== Image Proxy ===== */
app.get('/api/image-proxy', async (req, res) => {
  const externalUrl = req.query.url;
  if (!externalUrl) {
    return res.status(400).send('Image URL is required');
  }
  try {
    const response = await fetch(externalUrl);
    if (!response.ok) {
      return res.status(response.status).send('External image not found');
    }
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', response.headers.get('content-type'));
    response.body.pipe(res);
  } catch (error) {
    console.error('❌ Image proxy error:', error.message);
    res.status(500).send('Failed to fetch image');
  }
});

/* ===== Serve React Build ===== */
const buildPath = path.join(__dirname, '../client', 'build');
if (fs.existsSync(buildPath)) {
  console.log('✅ Serving React build files from:', buildPath);
  app.use(express.static(buildPath));
  app.get('*', (req, res) => {
    if (!req.url.startsWith('/api')) {
      res.sendFile(path.join(buildPath, 'index.html'));
    }
  });
}

/* ===== START SERVER ===== */
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🎨 Canvas library: ${createCanvas.name ? 'canvas' : '@napi-rs/canvas'}`);
  console.log(`🖼️ Pexels API: ${process.env.PEXELS_API_KEY ? 'ENABLED' : 'DISABLED'}`);
  console.log(`🔲 QR Code: ENABLED`);
  console.log(`📊 Analytics: ENABLED`);
  console.log(`🌐 Translation: ENABLED`);
});