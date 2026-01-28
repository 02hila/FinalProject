/**
 * server.js -- Application Entry Point
 *
 * Purpose:
 *   Bootstraps the Express application, connects to the database, registers
 *   all middleware and API route handlers, injects shared helper functions into
 *   services that need them, and starts background scheduled jobs.
 *
 * Main logic:
 *   1. Loads environment variables (local .env at project root).
 *   2. Creates the Express app with CORS, JSON body parsing, and multer for
 *      multipart file uploads.
 *   3. Mounts every route module under its respective API prefix.
 *   4. Injects helper functions (Gemini AI, Pexels image search, canvas
 *      rendering) into the ad-improvement and background-checker services.
 *   5. Kicks off recurring background jobs: unshared-ad checker,
 *      low-performance checker, and overdue-payment reminder.
 *
 * Key exports:
 *   - callGeminiWithRetry (re-exported from geminiService for use by ai.js).
 *
 * Connections:
 *   - Routes: auth, companies, campaigns, dashboard, ads, QR, analytics, etc.
 *   - Services: geminiService, pexelsService, canvasService.
 *   - Background jobs: unsharedAdsChecker, lowPerformanceChecker, paymentReminder.
 *   - Controllers: adController (generateAd, getRateLimitStatus).
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');

// Resolve project root and load .env from there if it exists,
// so the server works regardless of the working directory.
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

// --- Route modules ---
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

// --- Controller and service imports used for direct route binding ---
const { generateAd, getRateLimitStatus } = require('./controllers/adController');
const { callGeminiWithRetry, buildGeminiAdAndImagePrompt } = require('./services/geminiService');
const { searchPexelsImage } = require('./services/pexelsService');
const { createAdDesignOnServer } = require('./services/canvasService');

const app = express();

// Multer configured with in-memory storage so uploaded files are available
// as Buffer objects on req.file.buffer (used by the ad generation endpoint).
const upload = multer({ storage: multer.memoryStorage() });

// Establish the MongoDB connection before handling any requests.
connectDatabase();

// --- Global middleware ---
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// --- API route mounting ---
// Routes are organized by domain: authentication, entities, operations, and
// special-purpose endpoints. The order here does not affect matching because
// each router uses a distinct prefix, except for the catch-all health checks
// at the bottom.
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
// Short-URL redirect handler sits outside /api so QR links stay brief.
app.use('/r', redirectRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/ad-improvement', adImprovementRouter);
app.use('/api/admin', adminRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/share', shareRouter);
app.use('/api/contact', contactRouter);

// Direct route registrations that need multer middleware for file upload.
app.post('/api/generate-ad', upload.single('image'), generateAd);
app.get('/api/rate-limit/status', getRateLimitStatus);

/** Health-check endpoint -- confirms the server process is responsive. */
app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// --- Dependency injection ---
// Several services and route modules rely on shared helper functions but do
// not import them directly to avoid circular dependencies. We bundle the
// helpers and inject them after all modules are loaded.
const helpers = {
  createAdDesignOnServer,
  callGeminiWithRetry,
  buildGeminiAdAndImagePrompt,
  searchPexelsImage
};

adImprovementRouter.injectHelpers(helpers);

// --- Background scheduled services ---
// Each checker monitors ad data on a recurring schedule and regenerates or
// flags ads automatically when certain conditions are met.
const unsharedAdsChecker = require('./services/unsharedAdsChecker');
unsharedAdsChecker.injectHelpers(helpers);
unsharedAdsChecker.startScheduledChecker();

const lowPerformanceChecker = require('./services/lowPerformanceChecker');
lowPerformanceChecker.injectHelpers(helpers);
lowPerformanceChecker.startScheduledChecker();

// Payment-reminder job runs once on startup (after a short delay) and then
// repeats every hour to catch newly overdue payments.
const { checkOverduePayments } = require('./jobs/paymentReminder');
setInterval(checkOverduePayments, 60 * 60 * 1000);
setTimeout(checkOverduePayments, 10000);

// Re-export callGeminiWithRetry so that ai.js can import it via server.js
// without pulling in the full geminiService module directly.
module.exports.callGeminiWithRetry = callGeminiWithRetry;

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
