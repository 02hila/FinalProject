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
const QRCode = require('qrcode');
const crypto = require('crypto');
const sharp = require('sharp');
const multer = require('multer');
const upload = multer();


// Dynamically find the project root and load .env
const projectRoot = path.resolve(__dirname, '..');
const envPath = path.join(projectRoot, '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const app = express();


// --- 🎯 CORS FIX ---
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

    const url = new URL(origin);
    const hostname = url.hostname;

    if (allowedOrigins.includes(origin) || vercelPreviewRegex.test(hostname)) {
      callback(null, true);
    } else {
      console.error('🚫 CORS blocked origin:', origin);
      callback(new Error(`Not allowed by CORS: ${origin}`));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
// --- END CORS FIX ---


app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));


// ===== MongoDB =====
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));


// ===== MODELS =====
const Company = require('./models/Company');
const Campaign = require('./models/Campaign');
const User = require('./models/User');
const PendingAd = require('./models/PendingAd');
const QRScan = require('./models/QRScan');


// ===== ROUTES =====
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


// ===== REGISTER ROUTES =====
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


// ======================================================
//  🆕  *** REPLACED ENDPOINT: /api/generate-ad ***
// ======================================================
app.post('/api/generate-ad', upload.single('image'), async (req, res) => {
  console.log('🚀 /api/generate-ad endpoint hit');

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
    agentId
  } = req.body;

  if (!businessName || !productService || !companyId || !campaignId || !agentId) {
    return res.status(400).json({ success: false, error: 'שדות חובה חסרים' });
  }

  try {
    const selectedLanguage = language || 'Hebrew';

    const campaign = await Campaign.findById(campaignId);
    const agent = await User.findById(agentId);

    // === PROMPT ===
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

    // === Gemini ===
    const geminiTextResponse = await callGeminiWithRetry(prompt);

    let geminiResponseJson;
    try {
      let jsonString = geminiTextResponse.trim();
      const match = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match) jsonString = match[1];
      geminiResponseJson = JSON.parse(jsonString);
    } catch (e) {
      throw new Error("JSON from Gemini invalid");
    }

    // === IMAGE SEARCH / USER IMAGE ===
    let imageUrl = null;

    if (req.file) {
      imageUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    }

    if (!imageUrl) {
      imageUrl = await searchPexelsImage(productService);
    }

    // === SERVER DESIGN ===
    let imageData = await createAdDesignOnServer({
      businessName,
      adText: geminiResponseJson.body_text,
      productService,
      adStyle,
      imageUrl,
      agentName: agent?.fullName || 'Ads Maker'
    });


    // ==========================================================
    //   🆕          QR GENERATION + EMBEDDING
    // ==========================================================
    let qrCodeData = null;
    const websiteUrl = campaign?.websiteUrl || req.body.websiteUrl;

    if (websiteUrl) {
      try {
        const uniqueId = crypto.randomBytes(6).toString('base64url');

        const targetUrl = new URL(websiteUrl);
        targetUrl.searchParams.set('utm_source', `agent_${agentId}`);
        targetUrl.searchParams.set('utm_medium', 'qr');
        targetUrl.searchParams.set('utm_campaign', campaignId);

        const shortUrl = `${process.env.BASE_URL || 'https://adsmaker.onrender.com'}/r/${uniqueId}`;

        const qrDataUrl = await QRCode.toDataURL(shortUrl, {
          width: 300,
          margin: 2,
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

        // Embed QR inside image
        try {
          const adBuffer = Buffer.from(imageData.replace(/^data:image\/\w+;base64,/, ''), 'base64');
          const qrBuffer = Buffer.from(qrDataUrl.replace(/^data:image\/\w+;base64,/, ''), 'base64');

          const adImg = sharp(adBuffer);
          const metadata = await adImg.metadata();

          const qrSize = 150;
          const padding = 20;
          const left = metadata.width - qrSize - padding;
          const top = metadata.height - qrSize - padding;

          const resizedQR = await sharp(qrBuffer)
            .resize(qrSize, qrSize)
            .extend({ top:10, bottom:10, left:10, right:10, background: { r:255,g:255,b:255,a:1 }})
            .png()
            .toBuffer();

          const finalImage = await adImg
            .composite([{ input: resizedQR, top, left }])
            .png()
            .toBuffer();

          imageData = `data:image/png;base64,${finalImage.toString('base64')}`;
        } catch {}

        // Save QR scan tracking
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

      } catch {}
    }


    // === Save PendingAd ===
    const pendingAd = new PendingAd({
      title: geminiResponseJson.title,
      text: geminiResponseJson.body_text,
      callToAction: geminiResponseJson.call_to_action,
      imageData,
      companyId,
      campaignId,
      agentId,
      websiteUrl: websiteUrl || '',
      qrCode: qrCodeData,
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

    return res.json({ success: true, ad: pendingAd, qrGenerated: !!qrCodeData });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: "שגיאה ביצירת מודעה" });
  }
});


// ===== START SERVER =====
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
