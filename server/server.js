// server.js - IMPROVED VERSION WITH BETTER AD DESIGN
// ✅ Uses imageDescription from user
// ✅ Better text layout (no overlapping text)
// ✅ Professional QR placement
// ✅ Clean design without extra text

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

/* ===== MODULES ===== */
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');

// Canvas library
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
async function callGeminiWithRetry(prompt, maxRetries = 3, model = 'gemini-2.0-flash-exp') {
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

// ✅ Improved translation function - uses user's imageDescription if provided
async function translateToEnglishForImageSearch(hebrewText) {
  console.log('🌐 Translating to English for image search:', hebrewText);
  
  const prompt = `You are a translation expert for stock photo searches. 
Translate the following Hebrew text to simple, visual English keywords suitable for Pexels image search.

Hebrew text: "${hebrewText}"

CRITICAL RULES:
1. Output 2-6 simple English words ONLY
2. Focus on VISUAL, CONCRETE objects that can be photographed
3. Remove marketing language - focus ONLY on the visual subject
4. Use ONLY nouns and descriptive adjectives
5. Think about what would make a good stock photo search

Examples:
- "משפחה שמחה אוכלת ארוחה ביחד" → "happy family eating dinner"
- "טכנולוגיה מתקדמת במשרד מודרני" → "modern office technology"
- "תפוזינה משקה חדש" → "orange juice fresh"
- "שוקולינה עוגיות" → "chocolate cookies"
- "יוגה בפארק" → "yoga outdoor park"
- "מספרה מקצועית" → "professional barber salon"

Output ONLY 2-6 English keywords, nothing else.`;

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
    if (words.length > 8) {
      console.warn('⚠️ Translation too long, extracting key terms...');
      englishTerm = words.slice(0, 6).join(' ');
    }
    if (words.length === 0) {
      console.warn('⚠️ Empty translation, using fallback');
      englishTerm = 'business professional';
    }
    
    console.log(`✅ Translated: "${hebrewText}" → "${englishTerm}"`);
    return englishTerm;
  } catch (error) {
    console.warn('⚠️ Translation failed:', error.message);
    const englishWords = hebrewText.match(/[a-zA-Z]+/g);
    if (englishWords && englishWords.length > 0) {
      return englishWords.join(' ').toLowerCase();
    }
    return 'business professional';
  }
}

// ✅ SIMPLIFIED Pexels search - no translation, just direct search
async function searchPexelsImage(searchTerm, userImageDescription = null) {
  console.log('🖼️ Starting Pexels search...');
  
  if (!process.env.PEXELS_API_KEY) {
    console.log('⚠️ No Pexels API key - skipping search');
    return null;
  }
  
  // Use user description if provided, otherwise use search term
  let query = userImageDescription && userImageDescription.trim() 
    ? userImageDescription.trim() 
    : searchTerm;
  
  // If Hebrew, use simple fallback
  const hasHebrew = /[\u0590-\u05FF]/.test(query);
  if (hasHebrew) {
    query = 'business professional modern';
  }
  
  console.log(`🔍 Searching Pexels for: "${query}"`);
  
  try {
    const response = await axios.get('https://api.pexels.com/v1/search', {
      params: { 
        query, 
        per_page: 10,
        orientation: 'landscape'
      },
      headers: { Authorization: process.env.PEXELS_API_KEY },
      timeout: 8000
    });
    
    const photos = response.data.photos;
    
    if (photos && photos.length > 0) {
      const selectedPhoto = photos[0];
      const imageUrl = selectedPhoto.src.large2x || selectedPhoto.src.large;
      
      console.log(`✅ Found ${photos.length} images`);
      console.log(`📸 URL: ${imageUrl.substring(0, 60)}...`);
      
      return imageUrl;
    } else {
      console.log(`⚠️ No results`);
      return null;
    }
    
  } catch (err) {
    console.warn(`❌ Pexels search failed:`, err.message);
    return null;
  }
}

// ✅ Minimal text cleaning - keep the AI text as is, just remove markdown
function cleanAdText(text) {
  if (!text) return '';
  return text
    .replace(/\*\*/g, '') // Remove bold markers
    .replace(/#{1,6}\s+/g, '') // Remove headers
    .replace(/`{1,3}/g, '') // Remove code markers
    .trim();
}

// ✅ Improved text wrapping
function wrapText(ctx, text, maxWidth) {
  if (!text) return [];
  const words = text.split(' ');
  const lines = [];
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
  
  return lines;
}

// ✅ IMPROVED AD DESIGN - Clean, professional, no overlapping text
async function createAdDesignOnServer(adData) {
  console.log('🎨 Creating improved ad design...');
  const { businessName, adText, productService, adStyle, imageUrl } = adData;
  
  // Canvas setup
  const canvas = createCanvas(800, 450);
  const ctx = canvas.getContext('2d');

  // Style definitions
  const styles = {
    modern: { 
      overlay: 'rgba(102, 126, 234, 0.85)',
      textColor: '#ffffff',
      accent: '#FFD700'
    },
    minimal: { 
      overlay: 'rgba(255, 255, 255, 0.92)',
      textColor: '#2c3e50',
      accent: '#667eea'
    },
    elegant: { 
      overlay: 'rgba(0, 0, 0, 0.75)',
      textColor: '#ffffff',
      accent: '#d4af37'
    },
    dark: { 
      overlay: 'rgba(20, 20, 40, 0.85)',
      textColor: '#ffffff',
      accent: '#00d4ff'
    }
  };
  
  const selectedStyle = styles[adStyle] || styles.modern;

  // ✅ Step 1: Load background image
  if (imageUrl) {
    try {
      console.log('🖼️ Loading background image...');
      const image = await loadImage(imageUrl);
      
      // Draw image covering entire canvas
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      
      // Apply overlay
      ctx.fillStyle = selectedStyle.overlay;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      console.log('✅ Background image loaded successfully');
    } catch (err) {
      console.log('⚠️ Failed to load image, using gradient:', err.message);
      // Gradient fallback
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, '#667eea');
      gradient.addColorStop(1, '#764ba2');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  } else {
    console.log('ℹ️ No image URL - using gradient');
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // ✅ Step 2: Define content area (leaving space for QR on the left)
  const qrSpace = 150; // Space for QR code on the left
  const contentX = qrSpace + 40; // Start content after QR space
  const contentWidth = canvas.width - contentX - 40; // Width for content
  const contentCenterX = contentX + (contentWidth / 2);

  // ✅ Step 3: Draw business name at top
  ctx.fillStyle = selectedStyle.accent;
  ctx.font = 'bold 48px Arial';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  
  ctx.fillText((businessName || 'BUSINESS').toUpperCase(), contentCenterX, 80);
  
  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // ✅ Step 4: Draw main ad text (body) - CLEAN, NO EXTRA TEXT
  ctx.fillStyle = selectedStyle.textColor;
  ctx.font = 'bold 26px Arial';
  ctx.textAlign = 'center';
  
  const cleanText = cleanAdText(adText);
  const lines = wrapText(ctx, cleanText, contentWidth - 60);
  
  // Draw full AI-generated text (up to 8 lines)
  const maxLines = 8;
  const startY = 160;
  const lineHeight = 38;
  
  lines.slice(0, maxLines).forEach((line, i) => {
    ctx.fillText(line, contentCenterX, startY + (i * lineHeight));
  });

  // ✅ Step 5: Call-to-action button
  const buttonY = canvas.height - 90;
  const buttonWidth = 280;
  const buttonHeight = 50;
  const buttonX = contentCenterX - (buttonWidth / 2);

  // Button shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 4;
  
  // Button background
  ctx.fillStyle = selectedStyle.accent;
  ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);
  
  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Button text
  ctx.fillStyle = adStyle === 'minimal' ? '#ffffff' : '#000000';
  ctx.font = 'bold 22px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('לפרטים נוספים!', contentCenterX, buttonY + 32);

  // ✅ Agent signature at bottom right
  if (adData.agentName) {
    ctx.font = '14px Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.textAlign = 'right';
    ctx.fillText(`נוצר ע"י ${adData.agentName}`, canvas.width - 20, canvas.height - 15);
  }

  console.log('✅ Clean ad design created (QR space reserved on left)');
  return canvas.toDataURL('image/png');
}

/* ===== HEALTH CHECK ===== */
app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

/* ===== /api/generate-ad - IMPROVED ===== */
app.post('/api/generate-ad', upload.single('image'), async (req, res) => {
  console.log('🚀 /api/generate-ad endpoint hit (IMPROVED VERSION)');

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
      websiteUrl: reqWebsiteUrl,
      imageDescription // ✅ NEW: User's image description
    } = req.body;

    console.log('📋 Request data:', { 
      businessName, 
      productService, 
      campaignId, 
      agentId,
      imageDescription: imageDescription ? '✅ PROVIDED' : '❌ MISSING'
    });

    if (!businessName || !productService || !companyId || !campaignId || !agentId) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ success: false, error: 'שדות חובה חסרים' });
    }

    console.log('🔍 Loading campaign and agent...');
    const campaign = await Campaign.findById(campaignId);
    const agent = await User.findById(agentId);
    console.log('✅ Campaign and agent loaded');

    // ✅ Generate ad text with Gemini
    const prompt = `
אתה כותב תוכן שיווקי מקצועי. צור מודעה קצרה וממוקדת.

שם החברה: ${businessName}
מוצר/שירות: ${productService}
מסר: ${keyMessage}
סגנון: ${tone}

חשוב: הטקסט צריך להיות קצר (2-3 משפטים מקסימום) וממוקד.

תשובה בפורמט JSON בלבד:
{
  "title": "כותרת קצרה ומושכת",
  "body_text": "2-3 משפטים קצרים על היתרונות",
  "call_to_action": "קריאה לפעולה"
}
`;

    let geminiTextResponse;
    try {
      geminiTextResponse = await callGeminiWithRetry(prompt);
    } catch (gErr) {
      console.error('❌ Gemini failed:', gErr.message);
      throw new Error('Failed to generate ad text');
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
      console.log('✅ Gemini response parsed');
    } catch (parseErr) {
      console.error('❌ JSON parsing failed:', parseErr.message);
      throw new Error("JSON from Gemini invalid");
    }

    // ✅ Image search - prioritize user's imageDescription
    let imageUrl;
    
    if (req.file) {
      // User uploaded an image
      console.log('📤 User uploaded image - using it');
      imageUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    } else {
      // Search for image using Pexels
      console.log('🔍 Searching for image...');
      const searchQuery = imageDescription && imageDescription.trim() 
        ? imageDescription.trim()
        : `${businessName} ${productService}`;
      
      console.log('🔎 Search query:', searchQuery);
      imageUrl = await searchPexelsImage(searchQuery, imageDescription);
    }

    // ✅ Create ad design
    let imageData = await createAdDesignOnServer({
      businessName,
      adText: geminiResponseJson.body_text,
      productService,
      adStyle,
      imageUrl,
      agentName: agent?.fullName || 'Ads Maker' // ✅ Pass agent name
    });

    let adBuffer = Buffer.from(imageData.replace(/^data:image\/\w+;base64,/, ''), 'base64');

    // ✅ QR Code Generation
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
        console.log('   - Short URL:', shortUrl);
        
        const qrDataUrl = await QRCode.toDataURL(shortUrl, { 
          width: 220, 
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

        console.log('✅ QR code generated');

        // ✅ Embed QR in ad - IMPROVED POSITIONING (LEFT SIDE, CENTERED VERTICALLY)
        try {
          const qrBuffer = Buffer.from(qrDataUrl.replace(/^data:image\/\w+;base64,/, ''), 'base64');
          const metadata = await sharp(adBuffer).metadata();

          const qrSize = 120;
          const padding = 20;
          const borderSize = 10;
          const textHeight = 28;
          
          // Style QR with white border
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
          
          // Create text label "סרוק אותי ↑"
          const totalHeight = qrWithBorder.height + textHeight;
          const totalWidth = qrWithBorder.width;
          
          const textCanvas = createCanvas(totalWidth, textHeight);
          const textCtx = textCanvas.getContext('2d');
          
          textCtx.fillStyle = '#FFFFFF';
          textCtx.fillRect(0, 0, totalWidth, textHeight);
          
          textCtx.fillStyle = '#333333';
          textCtx.font = 'bold 16px Arial';
          textCtx.textAlign = 'center';
          textCtx.fillText('↑ סרוק אותי', totalWidth / 2, 19);
          
          const textBuffer = textCanvas.toBuffer('image/png');
          
          // Combine QR + text
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
          
          // Position: LEFT SIDE, CENTERED VERTICALLY
          const left = padding;
          const top = (metadata.height - totalHeight) / 2;

          // Add shadow
          const shadowSize = 5;
          const qrWithShadow = await sharp({
            create: {
              width: totalWidth + shadowSize * 2,
              height: totalHeight + shadowSize * 2,
              channels: 4,
              background: { r: 0, g: 0, b: 0, alpha: 0.3 }
            }
          })
          .composite([
            { input: qrWithText, top: shadowSize, left: shadowSize }
          ])
          .blur(2)
          .png()
          .toBuffer();

          // Composite final image
          const finalImage = await sharp(adBuffer)
            .composite([{ 
              input: qrWithShadow, 
              top: Math.round(top - shadowSize), 
              left: left - shadowSize 
            }])
            .png()
            .toBuffer();

          imageData = `data:image/png;base64,${finalImage.toString('base64')}`;
          adBuffer = finalImage;

          console.log('✅ QR embedded successfully on LEFT SIDE');
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
          console.log('✅ QR saved to database');
        } catch (dbErr) {
          console.error('⚠️ QR DB save failed:', dbErr.message);
        }

      } catch (qrError) {
        console.warn('⚠️ QR generation failed:', qrError.message);
      }
    } else {
      console.log('ℹ️ No website URL - skipping QR');
    }

    // ✅ Save ad to database
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
      metadata: { 
        businessName, 
        productService, 
        targetAudience, 
        keyMessage, 
        tone, 
        adStyle,
        imageDescription: imageDescription || null
      }
    });

    await pendingAd.save();
    console.log('✅ Ad saved:', pendingAd._id);
    console.log('   - Image: ✅');
    console.log('   - QR:', qrCodeData ? '✅' : '❌');
    console.log('   - User image desc:', imageDescription ? '✅' : '❌');

    return res.json({ 
      success: true, 
      ad: pendingAd, 
      qrGenerated: !!qrCodeData,
      imageSearchUsed: imageDescription ? 'user_description' : 'auto'
    });

  } catch (error) {
    console.error('💥 Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || "שגיאה ביצירת מודעה" 
    });
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
  console.log(`🌐 Smart Translation: ENABLED`);
  console.log(`🎯 User Image Description: ENABLED`);
});