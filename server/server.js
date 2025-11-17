require('dotenv').config();

console.log('🔍 Environment Check:');
console.log('MONGODB_URI:', process.env.MONGODB_URI ? '✅ EXISTS' : '❌ MISSING');
console.log('First 50 chars:', process.env.MONGODB_URI?.substring(0, 50));
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');
const fetch = require('node-fetch');

// Dynamically find the project root and load .env
const projectRoot = path.resolve(__dirname, '..');
const envPath = path.join(projectRoot, '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const app = express();

// --- 🎯 CORS FIX: Added logic for dynamic Vercel domains ---
const allowedOrigins = [
  'https://adsmaker-frontend.vercel.app',
  'https://adsmaker-rho.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'https://adsmaker.onrender.com' // דומיין Render מותר
];

// Regular expression to allow all Vercel subdomains (e.g., adsmaker-q5fn3wxow.vercel.app)
// נניח שכל פרויקט ששמו מתחיל ב-"adsmaker-" ומסתיים ב-"vercel.app" מותר.
const vercelPreviewRegex = /adsmaker-.*\.vercel\.app$/;

app.use(cors({
  origin: function (origin, callback) {
    // 1. Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);

    const url = new URL(origin);
    const hostname = url.hostname;

    // 2. Check if the origin is in the explicit list
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      // 3. Check if the origin is a dynamic Vercel preview URL
    } else if (vercelPreviewRegex.test(hostname)) {
      callback(null, true);
    } else {
      console.error('🚫 CORS blocked origin:', origin); // לוג נוסף
      callback(new Error(`Not allowed by CORS: ${origin}`));
    }
  },
  credentials: true
}));
// --- 🎯 END CORS FIX ---

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// Import models
const Ad = require('./models/Ad');
const Company = require('./models/Company');
const Campaign = require('./models/Campaign');
const User = require('./models/User');
const PendingAd = require('./models/PendingAd');
const AgentRating = require('./models/AgentRating');
const PriceProposal = require('./models/PriceProposal');

// Import routes
const companiesRouter = require('./routes/companies');
const campaignsRouter = require('./routes/campaigns');
const dashboardRouter = require('./routes/dashboard');
const authRouter = require('./routes/auth');
console.log('🔍 Loading pendingAdsRouter...');
const pendingAdsRouter = require('./routes/pendingAds');
console.log('✅ pendingAdsRouter loaded:', typeof pendingAdsRouter);
const agentsRouter = require('./routes/agents');
const requestsRouter = require('./routes/requests');
const usersRouter = require('./routes/users');
const aiRouter = require('./routes/ai');
const priceProposalsRouter = require('./routes/priceProposals');

// ===== 1. API ROUTES =====
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

/**
 * Utility function to call Gemini with an automatic retry mechanism.
 */
async function callGeminiWithRetry(prompt, maxRetries = 3, model = 'gemini-2.5-flash') {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🤖 Attempt ${attempt}/${maxRetries}: Calling Gemini with model ${model}...`);
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        { contents: [{ parts: [{ text: prompt }] }] },
        { timeout: 25000 }
      );
      console.log(`✅ Gemini responded successfully on attempt ${attempt}`);
      return response.data.candidates[0].content.parts[0].text.trim();
    } catch (error) {
      lastError = error;
      if (error.response && error.response.status === 503) {
        console.log(`⚠️ Attempt ${attempt} failed: Model overloaded (503).`);
        if (attempt < maxRetries) {
          const waitTime = 1000 * Math.pow(2, attempt - 1);
          console.log(`⏳ Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      } else {
        console.error('❌ Non-retryable Gemini error:', error.response?.data || error.message);
        throw error;
      }
    }
  }
  console.error(`❌ All ${maxRetries} Gemini attempts failed.`);
  throw lastError;
}

// ==========================================================
// ✅ Server-Side Canvas Drawing Logic
// ==========================================================

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

function wrapText(context, text, maxWidth) {
    const paragraphs = text.split(/\n+/);
    const lines = [];
    paragraphs.forEach(paragraph => {
        const trimmedParagraph = paragraph.trim();
        if (!trimmedParagraph) return;
        const words = trimmedParagraph.split(' ');
        let currentLine = '';
        for (let i = 0; i < words.length; i++) {
            const testLine = currentLine + words[i] + ' ';
            const metrics = context.measureText(testLine);
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

function finishDesign(ctx, canvas, selectedStyle, businessName, adText, adStyle, agentName) {
    const textColor = selectedStyle.textColor || '#ffffff';
    const accentColor = selectedStyle.accent || textColor;
    const isRTL = /[\u0590-\u05FF\u0600-\u06FF]/.test(businessName + adText);
    
    if (isRTL) ctx.direction = 'rtl';

    const boxPadding = 50;
    const boxHeight = 400;
    const boxY = (canvas.height - boxHeight) / 2;

    ctx.fillStyle = adStyle === 'minimal' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.40)';
    ctx.fillRect(boxPadding, boxY, canvas.width - (boxPadding * 2), boxHeight);

    ctx.shadowColor = 'rgba(0, 0, 0, 1)';
    ctx.shadowBlur = 25;
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 4;

    ctx.fillStyle = adStyle === 'minimal' ? '#222222' : accentColor;
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(businessName.toUpperCase(), canvas.width / 2, boxY + 65);

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    const lineColor = adStyle === 'minimal' ? '#333333' : (accentColor === '#ffffff' ? '#667eea' : accentColor);
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2 - 80, boxY + 85);
    ctx.lineTo(canvas.width / 2 + 80, boxY + 85);
    ctx.stroke();

    const cleanText = cleanAdText(adText);
    const maxWidth = canvas.width - (boxPadding * 2) - 80;
    let fontSize = isRTL ? 34 : 30;
    const minFontSize = 18;
    let lines;
    let lineHeight;

    do {
        ctx.font = `bold ${fontSize}px Arial`;
        lineHeight = fontSize * 1.3;
        lines = wrapText(ctx, cleanText, maxWidth);
        const totalTextHeight = lines.length * lineHeight;
        if (totalTextHeight > (boxHeight - 160) && fontSize > minFontSize) {
            fontSize -= 2;
        } else {
            break;
        }
    } while (fontSize >= minFontSize);

    ctx.shadowColor = 'rgba(0, 0, 0, 1)';
    ctx.shadowBlur = 22;
    ctx.fillStyle = adStyle === 'minimal' ? '#111111' : '#ffffff';

    const totalTextHeight = lines.length * lineHeight;
    const textStartY = boxY + 90 + ((boxHeight - 160 - totalTextHeight) / 2) + 15;

    lines.forEach((line, index) => {
        ctx.fillText(line, canvas.width / 2, textStartY + (index * lineHeight));
    });

    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;

    const buttonY = boxY + boxHeight - 75;
    const buttonWidth = 360;
    const ctaButtonHeight = 55;
    const buttonX = canvas.width / 2 - buttonWidth / 2;
    const radius = 27;

    ctx.fillStyle = adStyle === 'minimal' ? '#333333' : (adStyle === 'elegant' ? '#d4af37' : '#667eea');
    ctx.beginPath();
    ctx.moveTo(buttonX + radius, buttonY);
    ctx.lineTo(buttonX + buttonWidth - radius, buttonY);
    ctx.quadraticCurveTo(buttonX + buttonWidth, buttonY, buttonX + buttonWidth, buttonY + radius);
    ctx.lineTo(buttonX + buttonWidth, buttonY + ctaButtonHeight - radius);
    ctx.quadraticCurveTo(buttonX + buttonWidth, buttonY + ctaButtonHeight, buttonX + buttonWidth - radius, buttonY + ctaButtonHeight);
    ctx.lineTo(buttonX + radius, buttonY + ctaButtonHeight);
    ctx.quadraticCurveTo(buttonX, buttonY + ctaButtonHeight, buttonX, buttonY + ctaButtonHeight - radius);
    ctx.lineTo(buttonX, buttonY + radius);
    ctx.quadraticCurveTo(buttonX, buttonY, buttonX + radius, buttonY);
    ctx.closePath();
    ctx.fill();

    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 5;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px Arial';
    const buttonText = isRTL ? `לפרטים נוספים חפשו ${businessName}` : 'GET STARTED NOW!';
    ctx.fillText(buttonText, canvas.width / 2, buttonY + 34);

    if (agentName) {
        ctx.shadowColor = 'transparent';
        ctx.font = '14px Arial';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.textAlign = 'left';
        ctx.fillText(`נוצר ע"י ${agentName}`, 20, canvas.height - 20);
    }
}

async function createAdDesignOnServer(adData) {
    const { businessName, adText, productService, adStyle, imageUrl, agentName } = adData;
    const canvas = createCanvas(800, 450);
    const ctx = canvas.getContext('2d');

    const styles = {
        modern: { overlay: 'rgba(0, 0, 0, 0.5)', accent: '#667eea' },
        minimal: { overlay: 'rgba(255, 255, 255, 0.85)', textColor: '#333333', accent: '#333333' },
        elegant: { overlay: 'rgba(0, 0, 0, 0.6)', accent: '#d4af37' },
        dark: { overlay: 'rgba(0, 0, 0, 0.7)', accent: '#00d4ff' }
    };
    const selectedStyle = styles[adStyle] || styles.modern;

    try {
        const image = await loadImage(imageUrl);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        ctx.fillStyle = selectedStyle.overlay;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    } catch (error) {
        console.warn('⚠️ Could not load image, using fallback gradient.', error.message);
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, '#667eea');
        gradient.addColorStop(1, '#764ba2');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    finishDesign(ctx, canvas, selectedStyle, businessName, adText, adStyle, agentName);

    return canvas.toDataURL('image/png');
}

/**
 * Generates a specific, high-quality search term for an image.
 */
async function generateSmartImageSearchTerm(campaignInfo) {
  const prompt = `
You are an expert at finding stock photos for ad campaigns.

Generate a SPECIFIC English search term (2–4 words) for Pexels
based on the campaign details below:

Campaign Name: ${campaignInfo.campaignName}
Campaign Description: ${campaignInfo.campaignDescription}
Target Audience: ${campaignInfo.targetAudience}
Company: ${campaignInfo.companyName}
Product/Service: ${campaignInfo.product}
Message: ${campaignInfo.message}

IMPORTANT:
- Be visual and descriptive (e.g., "jewelry sale", "young people shopping for gifts")
- Avoid generic terms like "business", "office", "marketing"
- Return ONLY the search term (no quotes, no explanation)
`;

    try {
        const searchTerm = await callGeminiWithRetry(prompt, 2, 'gemini-2.5-flash');
    const cleanedTerm = searchTerm.replace(/['"]/g, '').toLowerCase().trim();
    console.log('🎯 Generated search term:', cleanedTerm);
    return cleanedTerm;
    } catch (error) {
        console.error('❌ Smart image search error:', error.message);
        return getFallbackSearchTerm(campaignInfo.productService, campaignInfo.companyName);
    }
}

/**
 * Searches for an image on Pexels.
 */
async function searchPexelsImage(searchTerm) {
    if (!process.env.PEXELS_API_KEY) {
        console.warn('⚠️ Pexels API key not configured. Skipping image search.');
        return null;
    }
    try {
        console.log(`🔍 Searching Pexels for: "${searchTerm}"`);
        const response = await axios.get('https://api.pexels.com/v1/search', {
            params: { query: searchTerm, per_page: 5, orientation: 'landscape' },
            headers: { Authorization: process.env.PEXELS_API_KEY }
        });
        if (response.data.photos && response.data.photos.length > 0) {
            const imageUrl = response.data.photos[0].src.large2x;
            console.log('✅ Found image on Pexels. URL:', imageUrl);
            return imageUrl;
        }
        console.log('⚠️ No images found on Pexels for this term.');
        return null;
    } catch (error) {
        console.error('❌ Pexels search error:', error.response?.data || error.message);
        return null;
    }
}

/**
 * Provides a fallback search term based on keywords.
 */
function getFallbackSearchTerm(productService, businessName) {
    const combined = `${productService} ${businessName}`.toLowerCase();
    if (combined.includes('שיעור') || combined.includes('לימוד')) return 'student studying teacher';
    if (combined.includes('מיץ') || combined.includes('תפוזינה')) return 'fresh orange juice';
    if (combined.includes('קפה')) return 'coffee shop barista';
    if (combined.includes('כושר') || combined.includes('ספורט')) return 'fitness gym workout';
    console.log('📍 Using default fallback search term.');
    return 'professional modern business';
}

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/generate-ad', upload.single('image'), async (req, res) => {
  console.log('🚀 /api/generate-ad endpoint hit');
  const { businessName, productService, targetAudience, keyMessage, tone, language, adStyle, companyId, campaignId, agentId } = req.body;

  if (!businessName || !productService || !companyId || !campaignId || !agentId) {
    console.error('❌ Validation failed: Missing required fields');
    return res.status(400).json({
      success: false,
      error: 'שדות חובה חסרים'
    });
  }

  try {
    const selectedLanguage = language || 'Hebrew';

    const campaign = await Campaign.findById(campaignId);
    const agent = await User.findById(agentId);
    if (!campaign) {
      console.warn('⚠️ Campaign not found for ID:', campaignId);
    }

    const prompt = `
אתה כותב תוכן שיווקי מקצועי. צור מודעה פרסומית על בסיס המידע הבא:

**פרטי החברה:**
- שם החברה: ${businessName}

**פרטי הקמפיין:**
- שם הקמפיין: ${campaign?.title || 'קמפיין'}
- תיאור: ${campaign?.description || 'אין תיאור'}
- מוצר/שירות: ${productService}
- מסר מרכזי: ${keyMessage}
- סגנון: ${tone}

**דרישות:**
1. כתוב את כל התוכן ב${selectedLanguage}
2. צור כותרת קצרה וקליטה (עד 10 מילים)
3. כתוב טקסט גוף מודעה משכנע (2-3 משפטים)
4. צור קריאה לפעולה (CTA) ברורה ומעוררת לפעולה

**פורמט התשובה חייב להיות JSON בלבד, בפורמט הבא:**
{
  "title": "הכותרת במילים",
  "body_text": "תוכן המודעה",
  "call_to_action": "טקסט כפתור ה-CTA"
}
`;

    const geminiTextResponse = await callGeminiWithRetry(prompt);

    let geminiResponseJson;
    try {
      let jsonString = geminiTextResponse.trim();
      const match = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match) {
        jsonString = match[1];
      }
      geminiResponseJson = JSON.parse(jsonString);

    } catch (parseError) {
      console.error('❌ Failed to parse Gemini JSON response:', geminiTextResponse, parseError);
      throw new Error('Gemini returned invalid JSON.');
    }

    console.log('✅ Gemini returned ad JSON:', geminiResponseJson);

    console.log('📸 Starting smart image search...');
    let imageUrl = null;

    if (req.file) {
        console.log('🖼️ Using user-uploaded image.');
        imageUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    }
    let finalSearchTerm = '';

    try {
      const searchTerm = await generateSmartImageSearchTerm({
        campaignName: campaign?.title || 'Campaign',
        campaignDescription: campaign?.description || '',
        targetAudience: campaign?.targetAudience || '',
        companyName: businessName,
        product: productService,
        message: keyMessage
      });

      finalSearchTerm = searchTerm;
      if (!imageUrl) {
          imageUrl = await searchPexelsImage(searchTerm);
          if (!imageUrl) {
            const fallbackTerm = getFallbackSearchTerm(productService, businessName);
            finalSearchTerm = fallbackTerm;
            imageUrl = await searchPexelsImage(fallbackTerm);
          }
      }
    } catch (imageError) {
      console.error("⚠️ Error during image search:", imageError.message);
    }

    console.log('🎨 Generating ad image on server...');
    let imageData;
    try {
        imageData = await createAdDesignOnServer({
            businessName,
            adText: geminiResponseJson.body_text,
            productService,
            adStyle,
            imageUrl,
            agentName: agent?.fullName || 'Ads Maker'
        });
        console.log('✅ Image generated successfully, length:', imageData?.length);
    } catch (imageError) {
        console.error('❌ Failed to generate image:', imageError);
        // ✅ Create a simple fallback image
        const canvas = createCanvas(800, 450);
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 800, 450);
        gradient.addColorStop(0, '#667eea');
        gradient.addColorStop(1, '#764ba2');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 800, 450);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(businessName, 400, 200);
        
        ctx.font = 'bold 24px Arial';
        ctx.fillText(productService, 400, 250);
        
        imageData = canvas.toDataURL('image/png');
        console.log('✅ Generated fallback image');
    }

    const pendingAd = new PendingAd({
      title: geminiResponseJson.title || `מודעה עבור ${businessName}`,
      text: geminiResponseJson.body_text || "מודעה מעולה!",
      callToAction: geminiResponseJson.call_to_action || "למידע נוסף",
      imageData,
      companyId,
      campaignId,
      agentId,
      metadata: {
        businessName,
        productService,
        targetAudience,
        keyMessage,
        tone,
        adStyle
      }
    });

    await pendingAd.save();
    console.log('💾 Saved PendingAd to DB:', pendingAd._id, 'with image:', !!pendingAd.imageData);

    return res.json({
      success: true,
      ad: pendingAd
    });

  } catch (error) {
    console.error('❌ Error in /generate-ad:', error.message);
    if (error.response && error.response.data) {
      console.error('API Error:', error.response.data);
    }
    return res.status(500).json({ 
      success: false, 
      error: 'שגיאה ביצירת המודעה' 
    });
  }
});

app.get('/api/image-proxy', async (req, res) => {
  const externalUrl = req.query.url;

  if (!externalUrl) {
    return res.status(400).send('Image URL is required');
  }

  try {
    const response = await fetch(externalUrl);

    if (!response.ok) {
        console.warn(`Failed to fetch image from external URL: ${externalUrl}`);
        return res.status(response.status).send('External image not found or failed to load.');
    }

    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Content-Type', response.headers.get('content-type'));
    response.body.pipe(res);
  } catch (error) {
    console.error('❌ Image proxy error:', error.message);
    res.status(500).send('Failed to fetch image');
  }
});

const buildPath = path.join(__dirname, '../client', 'build');

if (fs.existsSync(buildPath)) {
  console.log('✅ Serving React build files from:', buildPath);
  app.use(express.static(buildPath));

  app.get('*', (req, res) => {
    if (!req.url.startsWith('/api')) {
      res.sendFile(path.join(buildPath, 'index.html'));
    }
  });
} else {
  console.warn('⚠️ React build directory not found. Server is running in API-only or development mode.');
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`✅ Using Gemini 2.5 Flash model with retry logic`);
  console.log(`🔍 Smart image search: ${process.env.PEXELS_API_KEY ? 'ENABLED' : 'DISABLED (PEXELS_API_KEY not set)'}`);
  console.log(`🔐 Authentication system ready!`);
  console.log(`📊 Pending ads management enabled!`);
  console.log(`⭐ Agent rating system enabled!`);
});