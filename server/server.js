// server.js - VERSION WITH AD IMPROVEMENT WORKING
// This is your original server.js with textBaseline fix only
// ✅ הוסיפי בראש הקובץ (עם שאר ה-imports):
const adminRoutes = require('./routes/admin');
const companyRoutes = require('./routes/company');
const shareRouter = require('./routes/share');

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
// server.js - הוסף את זה


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

// ✅ CORS FIXED - מאשר את כל הבקשות
app.use(cors({
  origin: function (origin, callback) {
    // אם אין origin (בקשות מ-Postman או מהשרת עצמו), אשר
    if (!origin) return callback(null, true);
    
    try {
      const hostname = new URL(origin).hostname;
      
      // בדוק אם ה-origin מאושר
      if (allowedOrigins.includes(origin) || vercelPreviewRegex.test(hostname)) {
        console.log('✅ CORS allowed origin:', origin);
        return callback(null, true);
      }
      
      // אם לא מאושר, בכל זאת אפשר (למטרות פיתוח)
      console.warn('⚠️ CORS origin not in whitelist but allowing:', origin);
      return callback(null, true);
      
    } catch (e) {
      console.error('🚫 CORS origin parse error:', origin, e.message);
      // גם במקרה של שגיאה, אפשר את הבקשה
      return callback(null, true);
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
const adImprovementRouter = require('./routes/adImprovement'); // ✅ MUST HAVE!

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
app.use('/api/ad-improvement', adImprovementRouter); // ✅ CRITICAL!
app.use('/api/admin', adminRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/share', shareRouter);

/* ===== HELPER FUNCTIONS ===== */

// ✅ Gemini with retry
// ✅ Gemini with smart retry and rate limit handling
async function callGeminiWithRetry(prompt, maxRetries = 3, model = 'gemini-2.5-flash') {
  const geminiModels = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',        // fallback מהיר יותר
    'gemini-2.5-flash-lite'    // fallback קל יותר
  ];

  // Dynamic key list
  let geminiKeys = [];
  if (process.env.GEMINI_API_KEYS) {
    geminiKeys = process.env.GEMINI_API_KEYS.split(',').map(k => k.trim()).filter(Boolean);
  } else {
    geminiKeys = [
      process.env.GEMINI_API_KEY,
      process.env.GEMINI_API_KEY_two,
      process.env.GEMINI_API_KEY_three,
      process.env.GEMINI_API_KEY_Four
    ].filter(Boolean);
  }
  
  if (geminiKeys.length === 0) throw new Error('No Gemini API keys configured');

  let lastError;
  
  // ✅ Track which keys hit rate limits (reset every minute)
  const now = Date.now();
  if (!global.geminiKeyStatus) global.geminiKeyStatus = {};
  
  // Clean up old rate limit blocks (older than 60 seconds)
  for (const key in global.geminiKeyStatus) {
    if (now - global.geminiKeyStatus[key].blockedAt > 60000) {
      delete global.geminiKeyStatus[key];
    }
  }

  for (let modelIdx = 0; modelIdx < geminiModels.length; modelIdx++) {
    const modelName = geminiModels[modelIdx];
    
    for (let keyIdx = 0; keyIdx < geminiKeys.length; keyIdx++) {
      const apiKey = geminiKeys[keyIdx];
      const keyHash = apiKey.slice(-8); // Last 8 chars for identification
      
      // ✅ Skip keys that are currently rate limited
      if (global.geminiKeyStatus[keyHash]?.blocked) {
        console.log(`[Gemini] Skipping key #${keyIdx + 1} (rate limited)`);
        continue;
      }
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${apiKey}`,
            { contents: [{ parts: [{ text: prompt }] }] },
            { timeout: 60000 }
          );
          
          console.log(`[Gemini] Success: model ${modelName}, key #${keyIdx + 1}, attempt ${attempt}`);
          return response.data.candidates[0].content.parts[0].text.trim();
          
        } catch (error) {
          const status = error.response?.status;
          const errorMessage = error.response?.data?.error?.message || error.message;
          lastError = error;
          
          console.warn(`[Gemini] Error: model ${modelName}, key #${keyIdx + 1}, attempt ${attempt}: ${status} - ${errorMessage}`);
          
          // ✅ Handle rate limits (429) - mark key as blocked
          if (status === 429) {
            console.log(`[Gemini] Key #${keyIdx + 1} rate limited - marking as blocked for 60s`);
            global.geminiKeyStatus[keyHash] = { blocked: true, blockedAt: Date.now() };
            break; // Try next key
          }
          
          // ✅ Handle quota exceeded (403)
          if (status === 403 && errorMessage.includes('quota')) {
            console.log(`[Gemini] Key #${keyIdx + 1} quota exceeded - trying next key`);
            global.geminiKeyStatus[keyHash] = { blocked: true, blockedAt: Date.now() };
            break; // Try next key
          }
          
          // ✅ Handle overload (503)
          if (status === 503) {
            const waitTime = Math.min(1000 * Math.pow(2, attempt), 10000);
            console.log(`[Gemini] Service overloaded - waiting ${waitTime}ms`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue; // Retry same key
          }
          
          // ✅ Other errors - small delay and retry
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 500 * attempt));
          }
        }
      }
    }
  }
  
  console.error(`[Gemini] All attempts failed`);
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

function wrapText(ctx, text, maxWidth, isRTL = true) {
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
      
      // Check if a single word is too long - if so, we need to break it
      const wordMetrics = ctx.measureText(testWord);
      if (wordMetrics.width > maxWidth) {
        // If current line has content, save it first
        if (currentLine.trim()) {
          const lineText = currentLine.trim();
          lines.push(isRTL ? (lineText + '\u200F') : lineText);
          currentLine = '';
        }
        // Break the long word into characters
        let charLine = '';
        for (let j = 0; j < testWord.length; j++) {
          const testChar = charLine + testWord[j];
          const charMetrics = ctx.measureText(testChar);
          if (charMetrics.width > maxWidth && charLine) {
            lines.push(isRTL ? (charLine + '\u200F') : charLine);
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
          lines.push(isRTL ? (lineText + '\u200F') : lineText);
          currentLine = testWord + ' ';
        } else {
          currentLine = testLine;
        }
      }
    }
    
    if (currentLine.trim()) {
      const lineText = currentLine.trim();
      lines.push(isRTL ? (lineText + '\u200F') : lineText);
    }
  });
  
  return lines;
}

// ✅ Create ad design - WITH textBaseline FIX and language support
async function createAdDesignOnServer(adData) {
  console.log('🎨 Creating ad design...');
  const { businessName, adText, productService, adStyle, imageUrl, agentName, callToAction, language } = adData;
  const canvas = createCanvas(800, 450);
  const ctx = canvas.getContext('2d');
  
  // Determine text direction based on language
  const isRTL = language === 'Hebrew' || language === 'Arabic';
  const textDirection = isRTL ? 'rtl' : 'ltr';
  
  // Set canvas direction for proper text rendering
  // Note: Canvas doesn't support CSS direction, but we handle it via textAlign

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

  // Content box (leave dedicated space for QR code - bottom right)
  const boxPadding = 50;
  const qrZoneWidth = 180; // Increased to ensure QR doesn't overlap
  const qrZoneHeight = 180; // Reserve vertical space for QR
  const boxHeight = 350;
  const boxY = (canvas.height - boxHeight) / 2 - 10;
  // Reserve space for QR on the right side
  const boxWidth = canvas.width - (boxPadding * 2) - qrZoneWidth;
  const boxX = boxPadding;

  ctx.fillStyle = adStyle === 'minimal' ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.4)';
  ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

  const centerX = boxX + boxWidth / 2;
  const titleX = isRTL ? (boxX + boxWidth - 10) : (boxX + 10);
  
  // Title text with proper direction markers - wrap naturally, no truncation
  let titleText = adData.title ? cleanAdText(adData.title).toUpperCase() : (businessName || 'BUSINESS').toUpperCase();
  titleText = titleText + '!';
  
  ctx.font = 'bold 30px Arial';
  const titlePadding = 20;
  const titleMaxWidth = boxWidth - (titlePadding * 2);
  
  // Wrap title into multiple lines if needed
  const titleLines = wrapText(ctx, titleText, titleMaxWidth, isRTL);
  const titleStartX = isRTL ? (boxX + boxWidth - titlePadding) : (boxX + titlePadding);
  const titleLineHeight = 35;
  const titleStartY = boxY + 10; // Raised from 20 to 10 to move headline higher
  
  ctx.fillStyle = adStyle === 'minimal' ? '#222' : selectedStyle.accent;
  ctx.textAlign = isRTL ? 'right' : 'left';
  ctx.textBaseline = 'top';
  
  titleLines.forEach((line, i) => {
    if (i < 2) { // Max 2 lines for title
      ctx.fillText(line, titleStartX, titleStartY + (i * titleLineHeight));
    }
  });

  // Main ad text with proper alignment - calculate after title
  const titleEndY = titleStartY + (Math.min(titleLines.length, 2) * titleLineHeight) + 10;
  
  ctx.textAlign = isRTL ? 'right' : 'left';
  ctx.fillStyle = adStyle === 'minimal' ? '#111' : '#fff';
  ctx.font = 'bold 26px Arial';
  ctx.textBaseline = 'alphabetic';
  const cleanText = cleanAdText(adText);
  
  // Calculate available width with proper padding (more padding to prevent cutoff)
  const textPadding = 30; // Increased padding to prevent edge cutoff
  const availableWidth = boxWidth - (textPadding * 2);
  const lines = wrapText(ctx, cleanText, availableWidth, isRTL);
  
  // Calculate button position first
  const buttonY = boxY + boxHeight - 30;
  const buttonWidth = 320;
  const buttonHeight = 50;
  const buttonX = centerX - buttonWidth / 2;
  
  // Calculate text start position with proper padding
  const textStartX = isRTL ? (boxX + boxWidth - textPadding) : (boxX + textPadding);
  const lineHeight = 28; // Slightly reduced line height to fit more lines
  
  // Calculate available vertical space (after title, before button)
  const textStartY = titleEndY;
  const textEndY = buttonY - 20; // Leave space before button
  const availableHeight = textEndY - textStartY;
  const maxLinesByHeight = Math.floor(availableHeight / lineHeight);
  const finalMaxLines = Math.min(lines.length, maxLinesByHeight);
  
  lines.slice(0, finalMaxLines).forEach((line, i) => {
    const yPos = textStartY + (i * lineHeight);
    // Ensure text doesn't go below the button area
    if (yPos < textEndY) {
      ctx.fillText(line, textStartX, yPos);
    }
  });


 
  // CTA text with proper direction - wrap naturally, no truncation
  let ctaText = callToAction ? cleanAdText(callToAction).toUpperCase() : (isRTL ? 'התחל עכשיו!' : 'GET STARTED NOW!');
  
  ctx.font = 'bold 20px Arial';
  const ctaPadding = 15; // Padding inside button
  const ctaMaxWidth = buttonWidth - (ctaPadding * 2);
  
  // Wrap CTA text if needed
  const ctaLines = wrapText(ctx, ctaText, ctaMaxWidth, isRTL);
  const ctaLineHeight = 22;
  const maxCtaLines = Math.min(ctaLines.length, 2); // Max 2 lines in button
  
  // Adjust button height if CTA wraps to 2 lines
  const adjustedButtonHeight = maxCtaLines > 1 ? buttonHeight + 10 : buttonHeight;
  const adjustedButtonY = boxY + boxHeight - adjustedButtonHeight;
  
  ctx.fillStyle = adStyle === 'minimal' ? '#333' : '#667eea';
  ctx.fillRect(buttonX, adjustedButtonY, buttonWidth, adjustedButtonHeight);

  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Center text vertically in button
  const ctaStartY = adjustedButtonY + (adjustedButtonHeight / 2) - ((maxCtaLines - 1) * ctaLineHeight / 2);
  
  ctaLines.slice(0, maxCtaLines).forEach((line, i) => {
    ctx.fillText(line, centerX, ctaStartY + (i * ctaLineHeight));
  });

  if (agentName) {
    ctx.font = '12px Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.textAlign = 'left'; // Always left for bottom-left corner positioning
    ctx.textBaseline = 'alphabetic';
    const agentText = isRTL ? `נוצר ע"י ${agentName}` : `Created by ${agentName}`;
    // Position agent text in bottom left corner of canvas
    const agentX = boxPadding; // Use boxPadding to align with left edge
    ctx.fillText(agentText, agentX, canvas.height - 20);
  }
  
  // Draw QR placeholder area (visual guide - will be replaced by actual QR if available)
  // This ensures the space is reserved and visible during design
  const qrPlaceholderX = canvas.width - qrZoneWidth - boxPadding;
  const qrPlaceholderY = canvas.height - qrZoneHeight - boxPadding;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.strokeRect(qrPlaceholderX, qrPlaceholderY, qrZoneWidth - 20, qrZoneHeight - 20);
  ctx.setLineDash([]);

  console.log('✅ Ad design created (with QR zone reserved)');
  return canvas.toDataURL('image/png');
}

/* ===== INJECT HELPERS INTO AD IMPROVEMENT ROUTE ===== */
// Export helpers for use in other modules (e.g., ai.js, routes/ai.js)
module.exports.callGeminiWithRetry = callGeminiWithRetry;
adImprovementRouter.injectHelpers({
  createAdDesignOnServer,
  callGeminiWithRetry,
  buildGeminiAdAndImagePrompt,
  searchPexelsImage
});

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

    // 🆔 Generate unique ad identifier (6 characters, readable)
    const adUniqueId = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 chars: A3F2B9
    console.log('🆔 Generated Ad Unique ID:', adUniqueId);

    // Build Gemini prompt
    const geminiPrompt = buildGeminiAdAndImagePrompt({ businessName, productService, keyMessage, tone, language });
    let geminiTextResponse;
    try {
      geminiTextResponse = await callGeminiWithRetry(geminiPrompt, 3, 'gemini-2.5-flash'); 
    } catch (gErr) {
      console.error('❌ Gemini failed completely:', gErr.message || gErr);
      throw new Error('Failed to generate ad text (Gemini)');
    }

    // Parse JSON
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

    // Image search
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

    // Create ad
    let imageData = await createAdDesignOnServer({
      businessName,
      adText: geminiResponseJson.ad_text,
      title: geminiResponseJson.title,
      callToAction: geminiResponseJson.call_to_action,
      productService,
      adStyle,
      imageUrl,
      agentName: agent?.fullName || 'Ads Maker',
      language: language || 'Hebrew'
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
          
          // Position QR code to fit perfectly inside the dashed-line placeholder box
          // The placeholder is at: qrPlaceholderX, qrPlaceholderY with size: qrZoneWidth - 20, qrZoneHeight - 20
          const qrPlaceholderX = metadata.width - 180 - 50; // canvas.width - qrZoneWidth - boxPadding
          const qrPlaceholderY = metadata.height - 180 - 50; // canvas.height - qrZoneHeight - boxPadding
          const qrPlaceholderWidth = 180 - 20; // qrZoneWidth - 20
          const qrPlaceholderHeight = 180 - 20; // qrZoneHeight - 20
          
          // Center QR code within the placeholder box
          const qrCenterX = qrPlaceholderX + (qrPlaceholderWidth / 2);
          const qrCenterY = qrPlaceholderY + (qrPlaceholderHeight / 2);
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

    // Don't save ad to DB yet - wait for user approval
    // Ad data will be saved when user clicks "like"
    console.log('💾 Ad generated (not saved yet - waiting for user approval)');

    return res.status(200).json({
      success: true,
      pendingAdId: null, // Will be set when user approves
      adUniqueId,
      adData: {
        uniqueId: adUniqueId,
        title: geminiResponseJson.title || `${businessName} - מודעה`,
        text: geminiResponseJson.ad_text || '',
        callToAction: geminiResponseJson.call_to_action || '',
        imageUrl: imageData,
        qrCode: qrCodeData ? qrCodeData.imageData : null,
      },
      // Include all data needed to save the ad later
      saveData: {
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
          adUniqueId,
          lastImageUrl: imageUrl
        }
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

/* ===== UNSHARED ADS CHECKER ===== */
const unsharedAdsChecker = require('./services/unsharedAdsChecker');

// Inject helpers
unsharedAdsChecker.injectHelpers({
  createAdDesignOnServer,
  callGeminiWithRetry,
  searchPexelsImage
});

// Start the scheduled checker
unsharedAdsChecker.startScheduledChecker();

/* ===== LOW PERFORMANCE CHECKER ===== */
const lowPerformanceChecker = require('./services/lowPerformanceChecker');

// Inject helpers
lowPerformanceChecker.injectHelpers({
  createAdDesignOnServer,
  callGeminiWithRetry,
  searchPexelsImage
});

// Start the scheduled checker
lowPerformanceChecker.startScheduledChecker();

/* ===== START SERVER ===== */
const { checkOverduePayments } = require('./jobs/paymentReminder');

// הרצה כל שעה
setInterval(checkOverduePayments, 60 * 60 * 1000);

// הרצה ראשונית אחרי 10 שניות
setTimeout(checkOverduePayments, 10000);






const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});