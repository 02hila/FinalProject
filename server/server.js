// server.js (מתוקן עם QR code משופר) ==========================================

/* ===== LOAD ENV ===== */
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
const { createCanvas, loadImage } = require('canvas');
const fetch = require('node-fetch');
const sharp = require('sharp');
const multer = require('multer');
const upload = multer();
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
app.use('/api/ai', aiRouter);
app.use('/api/price-proposals', priceProposalsRouter);
app.use('/api/ads', adsRouter);
app.use('/api/qr', qrRouter);
app.use('/r', redirectRouter);
app.use('/api/analytics', analyticsRouter);

/* ===== HELPER FUNCTIONS ===== */
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

async function searchPexelsImage(searchTerm) {
  console.log('🖼️ Searching Pexels for:', searchTerm);
  if (!process.env.PEXELS_API_KEY) {
    console.log('⚠️ No Pexels API key');
    return null;
  }
  try {
    const response = await axios.get('https://api.pexels.com/v1/search', {
      params: { query: searchTerm, per_page: 5, orientation: 'landscape' },
      headers: { Authorization: process.env.PEXELS_API_KEY }
    });
    console.log('✅ Pexels image found');
    return response.data.photos?.[0]?.src?.large2x || null;
  } catch (err) {
    console.error('❌ Pexels error:', err.message);
    return null;
  }
}

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

  try {
    if (imageUrl) {
      const image = await loadImage(imageUrl);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      ctx.fillStyle = selectedStyle.overlay;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      throw new Error('No imageUrl provided');
    }
  } catch (err) {
    // fallback gradient
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // ===== שינוי: תיבת תוכן שמשאירה מקום ל-QR =====
  const boxPadding = 50;
  const qrZoneWidth = 160; // רוחב האזור של ה-QR (120 + padding)
  const boxHeight = 380; // הקטנת הגובה מ-400 ל-380
  const boxY = (canvas.height - boxHeight) / 2 - 10; // הזזה מעט למעלה
  
  // רוחב התיבה מותאם - משאיר מקום ל-QR בצד שמאל
  const boxWidth = canvas.width - (boxPadding * 2) - qrZoneWidth;
  const boxX = boxPadding + qrZoneWidth; // מתחיל אחרי אזור ה-QR

  ctx.fillStyle = adStyle === 'minimal' ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.4)';
  ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

  // ===== כותרת =====
  ctx.fillStyle = adStyle === 'minimal' ? '#222' : selectedStyle.accent;
  ctx.font = 'bold 44px Arial'; // הקטנת הפונט מעט
  ctx.textAlign = 'center';
  const centerX = boxX + boxWidth / 2;
  ctx.fillText((businessName || 'BUSINESS').toUpperCase(), centerX, boxY + 60);

  // ===== טקסט גוף =====
  ctx.fillStyle = adStyle === 'minimal' ? '#111' : '#fff';
  ctx.font = 'bold 26px Arial'; // הקטנת הפונט לשורות נוספות
  const lines = wrapText(ctx, adText || '', boxWidth - 40);
  lines.slice(0, 6).forEach((line, i) => {
    ctx.fillText(line, centerX, boxY + 110 + (i * 36));
  });

  // ===== כפתור CTA =====
  const buttonY = boxY + boxHeight - 70;
  const buttonWidth = 320;
  const buttonHeight = 50;
  const buttonX = centerX - buttonWidth / 2;

  ctx.fillStyle = adStyle === 'minimal' ? '#333' : '#667eea';
  ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px Arial';
  ctx.fillText('GET STARTED NOW!', centerX, buttonY + 32);

  // ===== חתימת סוכן (בפינה ימנית למטה - לא מפריע ל-QR) =====
  if (agentName) {
    ctx.font = '12px Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.textAlign = 'right';
    ctx.fillText(`נוצר ע"י ${agentName}`, canvas.width - 20, canvas.height - 20);
  }

  console.log('✅ Ad design created (with QR zone reserved)');
  return canvas.toDataURL('image/png');
}

function wrapText(ctx, text, maxWidth) {
  if (!text) return [];
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  for (let word of words) {
    const testLine = currentLine + word + ' ';
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine.trim());
      currentLine = word + ' ';
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine.trim());
  return lines;
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

    // ===== Gemini call =====
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

    // ===== Image: uploaded file or Pexels =====
    let imageUrl = req.file
      ? `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`
      : await searchPexelsImage(productService);

    // יצירת המודעה
    let imageData = await createAdDesignOnServer({
      businessName,
      adText: geminiResponseJson.body_text,
      productService,
      adStyle,
      imageUrl,
      agentName: agent?.fullName || 'Ads Maker'
    });

    let adBuffer = Buffer.from(imageData.replace(/^data:image\/\w+;base64,/, ''), 'base64');

    // ===== QR Code Generation & Embedding =====
    const websiteUrl = campaign?.websiteUrl || reqWebsiteUrl;
    let qrCodeData = null;

    if (websiteUrl && websiteUrl.trim() !== '') {
      console.log('🔲 Generating QR code...');
      try {
        const uniqueId = crypto.randomBytes(6).toString('base64url');
        const targetUrl = new URL(websiteUrl);
        targetUrl.searchParams.set('utm_source', `agent_${agentId}`);
        targetUrl.searchParams.set('utm_medium', 'qr');
        targetUrl.searchParams.set('utm_campaign', campaignId);

        const shortUrl = `${process.env.BASE_URL || 'https://adsmaker.onrender.com'}/r/${uniqueId}`;
        
        // יצירת QR code עם גודל קבוע ונוח לסריקה
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

        console.log('✅ QR code generated, now embedding...');

        // ===== הטמעת QR code במודעה עם עיצוב מקצועי =====
        try {
          const qrBuffer = Buffer.from(qrDataUrl.replace(/^data:image\/\w+;base64,/, ''), 'base64');
          const metadata = await sharp(adBuffer).metadata();

          // הגדרות לעיצוב QR
          const qrSize = 110; // גודל מעט יותר קטן
          const padding = 20;
          const borderSize = 8;
          const textHeight = 25; // גובה לטקסט
          
          // יצירת QR עם מסגרת לבנה
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
          
          // יצירת רקע עם טקסט "סרוק אותי"
          const totalHeight = qrWithBorder.height + textHeight;
          const totalWidth = qrWithBorder.width;
          
          // יצירת canvas לטקסט
          const textCanvas = createCanvas(totalWidth, textHeight);
          const textCtx = textCanvas.getContext('2d');
          
          // רקע לבן לטקסט
          textCtx.fillStyle = '#FFFFFF';
          textCtx.fillRect(0, 0, totalWidth, textHeight);
          
          // טקסט "סרוק אותי"
          textCtx.fillStyle = '#333333';
          textCtx.font = 'bold 14px Arial';
          textCtx.textAlign = 'center';
          textCtx.fillText('↑ סרוק אותי', totalWidth / 2, 17);
          
          const textBuffer = textCanvas.toBuffer('image/png');
          
          // שילוב QR + טקסט
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
          
          // מיקום: פינה שמאלית תחתונה
          const left = padding;
          const top = metadata.height - totalHeight - padding;

          // הוספת צל רך מאחורי ה-QR
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

          // הטמעת ה-QR במודעה
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
          console.log('ℹ️ Using original image without QR');
        }

        // שמירת QR ב-DB
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
        // אם נכשל - המשך עם המודעה ללא QR
      }
    } else {
      console.log('ℹ️ No website URL - skipping QR code generation');
    }

    // ===== שמירת המודעה ב-DB =====
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

/* ===== START SERVER ===== */
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));