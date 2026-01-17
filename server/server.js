require('dotenv').config();
const path = require('path');
const fs = require('fs');

const projectRoot = path.resolve(__dirname, '..');
const envPath = path.join(projectRoot, '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const express = require('express');
const cors = require('cors');
const multer = require('multer');

const { connectDatabase } = require('./config/database');
const { corsOptions } = require('./config/cors');

const adminRoutes = require('./routes/admin');
const companyRoutes = require('./routes/company');
const shareRouter = require('./routes/share');
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
const adImprovementRouter = require('./routes/adImprovement');
const contactRouter = require('./routes/contact');

const { generateAd, getRateLimitStatus } = require('./controllers/adController');
const { callGeminiWithRetry, buildGeminiAdAndImagePrompt } = require('./services/geminiService');
const { searchPexelsImage } = require('./services/pexelsService');
const { createAdDesignOnServer } = require('./services/canvasService');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

connectDatabase();

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
app.use('/api/ad-improvement', adImprovementRouter);
app.use('/api/admin', adminRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/share', shareRouter);
app.use('/api/contact', contactRouter);

app.post('/api/generate-ad', upload.single('image'), generateAd);
app.get('/api/rate-limit/status', getRateLimitStatus);

app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

const helpers = {
  createAdDesignOnServer,
  callGeminiWithRetry,
  buildGeminiAdAndImagePrompt,
  searchPexelsImage
};

adImprovementRouter.injectHelpers(helpers);

const unsharedAdsChecker = require('./services/unsharedAdsChecker');
unsharedAdsChecker.injectHelpers(helpers);
unsharedAdsChecker.startScheduledChecker();

const lowPerformanceChecker = require('./services/lowPerformanceChecker');
lowPerformanceChecker.injectHelpers(helpers);
lowPerformanceChecker.startScheduledChecker();

const { checkOverduePayments } = require('./jobs/paymentReminder');
setInterval(checkOverduePayments, 60 * 60 * 1000);
setTimeout(checkOverduePayments, 10000);

module.exports.callGeminiWithRetry = callGeminiWithRetry;

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
