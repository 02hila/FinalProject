// server/services/geminiRateLimiter.js
// Global rate limiting for Gemini API ad generation

const GeminiRateLimit = require('../models/GeminiRateLimit');

// Configuration
const DAILY_LIMIT = 15;                    // Maximum ads per day
const MIN_DELAY_MS = 60 * 1000;            // 1 minute between generations

// Error messages
const DAILY_LIMIT_MESSAGE = 'The daily advertisement creation limit has been reached. Please try again tomorrow.';
const DELAY_MESSAGE_PREFIX = 'Please wait';

/**
 * Get today's date as YYYY-MM-DD string
 */
function getTodayString() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

/**
 * Get or create the rate limit document
 */
async function getRateLimitDoc() {
  const today = getTodayString();

  let doc = await GeminiRateLimit.findOne({ key: 'global' });

  if (!doc) {
    // Create new document
    doc = new GeminiRateLimit({
      key: 'global',
      currentDate: today,
      dailyCount: 0,
      lastGenerationAt: null,
      generations: []
    });
    await doc.save();
    console.log('📊 [RateLimiter] Created new rate limit document');
  } else if (doc.currentDate !== today) {
    // New day - reset counter
    console.log(`📊 [RateLimiter] New day detected. Resetting counter (was: ${doc.dailyCount})`);
    doc.currentDate = today;
    doc.dailyCount = 0;
    doc.generations = [];
    await doc.save();
  }

  return doc;
}

/**
 * Check if we can generate a new ad
 * Returns { allowed: boolean, error?: string, waitTime?: number }
 */
async function canGenerateAd() {
  try {
    const doc = await getRateLimitDoc();

    // Check daily limit
    if (doc.dailyCount >= DAILY_LIMIT) {
      console.log(`⛔ [RateLimiter] Daily limit reached: ${doc.dailyCount}/${DAILY_LIMIT}`);
      return {
        allowed: false,
        error: DAILY_LIMIT_MESSAGE,
        errorCode: 'DAILY_LIMIT_REACHED',
        remaining: 0
      };
    }

    // Check delay between generations
    if (doc.lastGenerationAt) {
      const timeSinceLast = Date.now() - new Date(doc.lastGenerationAt).getTime();
      if (timeSinceLast < MIN_DELAY_MS) {
        const waitTime = Math.ceil((MIN_DELAY_MS - timeSinceLast) / 1000);
        console.log(`⏳ [RateLimiter] Must wait ${waitTime}s before next generation`);
        return {
          allowed: false,
          error: `${DELAY_MESSAGE_PREFIX} ${waitTime} seconds before generating another advertisement.`,
          errorCode: 'DELAY_REQUIRED',
          waitTime,
          remaining: DAILY_LIMIT - doc.dailyCount
        };
      }
    }

    // Allowed
    return {
      allowed: true,
      remaining: DAILY_LIMIT - doc.dailyCount
    };

  } catch (error) {
    console.error('❌ [RateLimiter] Error checking rate limit:', error.message);
    // On error, allow the generation (fail open to not break functionality)
    return { allowed: true, remaining: DAILY_LIMIT };
  }
}

/**
 * Record a successful ad generation
 * @param {string} source - Source of generation: 'manual', 'improvement', 'unshared', 'low_performance'
 * @param {string} adId - The ID of the generated ad (optional)
 */
async function recordGeneration(source = 'manual', adId = null) {
  try {
    const doc = await getRateLimitDoc();

    doc.dailyCount += 1;
    doc.lastGenerationAt = new Date();

    // Add to history (keep last 50 entries)
    doc.generations.push({
      timestamp: new Date(),
      source,
      adId
    });
    if (doc.generations.length > 50) {
      doc.generations = doc.generations.slice(-50);
    }

    await doc.save();

    console.log(`📊 [RateLimiter] Recorded generation. Count: ${doc.dailyCount}/${DAILY_LIMIT} | Source: ${source}`);

    return {
      dailyCount: doc.dailyCount,
      remaining: DAILY_LIMIT - doc.dailyCount
    };

  } catch (error) {
    console.error('❌ [RateLimiter] Error recording generation:', error.message);
    // Don't throw - recording is secondary to actual generation
  }
}

/**
 * Get current rate limit status
 */
async function getStatus() {
  try {
    const doc = await getRateLimitDoc();

    let timeUntilNextAllowed = 0;
    if (doc.lastGenerationAt) {
      const timeSinceLast = Date.now() - new Date(doc.lastGenerationAt).getTime();
      if (timeSinceLast < MIN_DELAY_MS) {
        timeUntilNextAllowed = Math.ceil((MIN_DELAY_MS - timeSinceLast) / 1000);
      }
    }

    return {
      dailyCount: doc.dailyCount,
      dailyLimit: DAILY_LIMIT,
      remaining: DAILY_LIMIT - doc.dailyCount,
      lastGenerationAt: doc.lastGenerationAt,
      timeUntilNextAllowed,
      canGenerateNow: doc.dailyCount < DAILY_LIMIT && timeUntilNextAllowed === 0
    };

  } catch (error) {
    console.error('❌ [RateLimiter] Error getting status:', error.message);
    return {
      dailyCount: 0,
      dailyLimit: DAILY_LIMIT,
      remaining: DAILY_LIMIT,
      canGenerateNow: true
    };
  }
}

/**
 * Wait until generation is allowed (for background services)
 * Returns when either allowed or timeout
 * @param {number} maxWaitMs - Maximum time to wait (default 5 minutes)
 */
async function waitUntilAllowed(maxWaitMs = 5 * 60 * 1000) {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const check = await canGenerateAd();

    if (check.allowed) {
      return { allowed: true };
    }

    if (check.errorCode === 'DAILY_LIMIT_REACHED') {
      // Daily limit - no point waiting
      return { allowed: false, error: check.error };
    }

    // Wait and retry
    const waitTime = Math.min(check.waitTime * 1000 + 1000, maxWaitMs - (Date.now() - startTime));
    if (waitTime > 0) {
      console.log(`⏳ [RateLimiter] Waiting ${Math.ceil(waitTime/1000)}s before next attempt...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  return { allowed: false, error: 'Timeout waiting for rate limit' };
}

module.exports = {
  canGenerateAd,
  recordGeneration,
  getStatus,
  waitUntilAllowed,
  DAILY_LIMIT,
  MIN_DELAY_MS
};
