const GeminiRateLimit = require('../models/GeminiRateLimit');

const DAILY_LIMIT = 15;
const MIN_DELAY_MS = 60 * 1000;

const DAILY_LIMIT_MESSAGE = 'The daily advertisement creation limit has been reached. Please try again tomorrow.';
const DELAY_MESSAGE_PREFIX = 'Please wait';

function getTodayString() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

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
    console.log(`[RateLimiter] New day detected. Resetting counter (was: ${doc.dailyCount})`);
    doc.currentDate = today;
    doc.dailyCount = 0;
    doc.generations = [];
    await doc.save();
  }

  return doc;
}

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
    console.error('[RateLimiter] Error checking rate limit:', error.message);
    return { allowed: true, remaining: DAILY_LIMIT };
  }
}

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

async function waitUntilAllowed(maxWaitMs = 5 * 60 * 1000) {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const check = await canGenerateAd();

    if (check.allowed) {
      return { allowed: true };
    }

    if (check.errorCode === 'DAILY_LIMIT_REACHED') {
      return { allowed: false, error: check.error };
    }

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
