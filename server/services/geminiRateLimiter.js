/**
 * Gemini Rate Limiter Service
 *
 * Manages API rate limiting for Gemini ad generation to prevent abuse and control costs.
 * Implements a daily limit (15 ads/day) and minimum delay (60 seconds between requests).
 * Uses MongoDB to persist rate limit state across server restarts.
 *
 * Key exports:
 *  - canGenerateAd   -- checks whether a new generation is currently allowed
 *  - recordGeneration -- increments the daily counter after a successful generation
 *  - getStatus        -- returns a full snapshot of daily usage and cooldown timers
 *  - waitUntilAllowed -- blocking poll used by automated checkers that can afford to wait
 *  - DAILY_LIMIT / MIN_DELAY_MS -- tunable constants
 *
 * Called by:
 *  - Ad generation routes (to gate manual ad creation)
 *  - lowPerformanceChecker and unsharedAdsChecker (automated alternative ad creation)
 *
 * Depends on:
 *  - GeminiRateLimit Mongoose model (server/models/GeminiRateLimit)
 */
const GeminiRateLimit = require('../models/GeminiRateLimit');

// Maximum ads that can be generated per day
const DAILY_LIMIT = 15;

// Minimum time (ms) between consecutive ad generations
const MIN_DELAY_MS = 60 * 1000;

const DAILY_LIMIT_MESSAGE = 'The daily advertisement creation limit has been reached. Please try again tomorrow.';
const DELAY_MESSAGE_PREFIX = 'Please wait';

/**
 * Returns current date as a YYYY-MM-DD string for daily reset tracking.
 * @returns {string} Today's date in ISO date format.
 */
function getTodayString() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

/**
 * Retrieves or creates the global rate limit document.
 * Automatically resets counters when a new day is detected.
 *
 * @returns {Promise<Object>} The Mongoose document tracking rate limit state.
 */
async function getRateLimitDoc() {
  const today = getTodayString();

  let doc = await GeminiRateLimit.findOne({ key: 'global' });

  if (!doc) {
    doc = new GeminiRateLimit({
      key: 'global',
      currentDate: today,
      dailyCount: 0,
      lastGenerationAt: null,
      generations: []
    });
    await doc.save();
    console.log('[RateLimiter] Created new rate limit document');
  } else if (doc.currentDate !== today) {
    // Day rollover: reset counters for the new calendar day
    console.log(`[RateLimiter] New day detected. Resetting counter (was: ${doc.dailyCount})`);
    doc.currentDate = today;
    doc.dailyCount = 0;
    doc.generations = [];
    await doc.save();
  }

  return doc;
}

/**
 * Checks if a new ad generation is allowed based on current rate limits.
 * Two conditions are evaluated: daily cap and minimum inter-request delay.
 *
 * @returns {Promise<Object>} Result with `allowed` boolean, and on rejection: `error`,
 *   `errorCode` ('DAILY_LIMIT_REACHED' | 'DELAY_REQUIRED'), `waitTime`, and `remaining`.
 */
async function canGenerateAd() {
  try {
    const doc = await getRateLimitDoc();

    if (doc.dailyCount >= DAILY_LIMIT) {
      console.log(`[RateLimiter] Daily limit reached: ${doc.dailyCount}/${DAILY_LIMIT}`);
      return {
        allowed: false,
        error: DAILY_LIMIT_MESSAGE,
        errorCode: 'DAILY_LIMIT_REACHED',
        remaining: 0
      };
    }

    if (doc.lastGenerationAt) {
      const timeSinceLast = Date.now() - new Date(doc.lastGenerationAt).getTime();
      if (timeSinceLast < MIN_DELAY_MS) {
        const waitTime = Math.ceil((MIN_DELAY_MS - timeSinceLast) / 1000);
        console.log(`[RateLimiter] Must wait ${waitTime}s before next generation`);
        return {
          allowed: false,
          error: `${DELAY_MESSAGE_PREFIX} ${waitTime} seconds before generating another advertisement.`,
          errorCode: 'DELAY_REQUIRED',
          waitTime,
          remaining: DAILY_LIMIT - doc.dailyCount
        };
      }
    }

    return {
      allowed: true,
      remaining: DAILY_LIMIT - doc.dailyCount
    };

  } catch (error) {
    // On DB errors, fail open so ads can still be created
    console.error('[RateLimiter] Error checking rate limit:', error.message);
    return { allowed: true, remaining: DAILY_LIMIT };
  }
}

/**
 * Records a successful ad generation, incrementing the daily counter.
 * Stores generation metadata including source and ad ID for auditing.
 * Caps the stored generation history at 50 entries to bound document size.
 *
 * @param {string} [source='manual'] - Origin of the generation (e.g. 'manual', 'low_performance', 'unshared').
 * @param {string|null} [adId=null] - The Mongo ObjectId of the created ad, if available.
 * @returns {Promise<{dailyCount: number, remaining: number}|undefined>} Updated counters, or undefined on error.
 */
async function recordGeneration(source = 'manual', adId = null) {
  try {
    const doc = await getRateLimitDoc();

    doc.dailyCount += 1;
    doc.lastGenerationAt = new Date();

    doc.generations.push({
      timestamp: new Date(),
      source,
      adId
    });
    // Keep only the 50 most recent entries to prevent unbounded document growth
    if (doc.generations.length > 50) {
      doc.generations = doc.generations.slice(-50);
    }

    await doc.save();

    console.log(`[RateLimiter] Recorded generation. Count: ${doc.dailyCount}/${DAILY_LIMIT} | Source: ${source}`);

    return {
      dailyCount: doc.dailyCount,
      remaining: DAILY_LIMIT - doc.dailyCount
    };

  } catch (error) {
    console.error('[RateLimiter] Error recording generation:', error.message);
  }
}

/**
 * Returns current rate limit status including daily count, remaining quota,
 * and seconds until the next generation is allowed.
 *
 * @returns {Promise<Object>} Status object with dailyCount, dailyLimit, remaining,
 *   lastGenerationAt, timeUntilNextAllowed (seconds), and canGenerateNow (boolean).
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
    console.error('[RateLimiter] Error getting status:', error.message);
    return {
      dailyCount: 0,
      dailyLimit: DAILY_LIMIT,
      remaining: DAILY_LIMIT,
      canGenerateNow: true
    };
  }
}

/**
 * Waits until rate limit allows ad generation, polling periodically.
 * Used by automated processes (lowPerformanceChecker, unsharedAdsChecker)
 * that can afford to wait rather than fail immediately.
 *
 * Returns immediately if the daily cap has been reached (no point waiting).
 *
 * @param {number} [maxWaitMs=300000] - Maximum time in milliseconds to wait before giving up (default 5 min).
 * @returns {Promise<{allowed: boolean, error?: string}>} Whether generation is now allowed.
 */
async function waitUntilAllowed(maxWaitMs = 5 * 60 * 1000) {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const check = await canGenerateAd();

    if (check.allowed) {
      return { allowed: true };
    }

    // Daily cap reached -- waiting more won't help
    if (check.errorCode === 'DAILY_LIMIT_REACHED') {
      return { allowed: false, error: check.error };
    }

    // Delay required -- sleep for the remaining cooldown plus a small buffer
    const waitTime = Math.min(check.waitTime * 1000 + 1000, maxWaitMs - (Date.now() - startTime));
    if (waitTime > 0) {
      console.log(`[RateLimiter] Waiting ${Math.ceil(waitTime / 1000)}s before next attempt...`);
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
