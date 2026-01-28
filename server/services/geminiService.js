/**
 * Gemini AI Service
 *
 * Provides an interface to Google's Gemini generative AI API for ad copywriting.
 * Handles multi-key rotation, automatic model fallback, and retry logic with
 * exponential backoff to maximize reliability under rate limits.
 *
 * Key exports:
 *  - callGeminiWithRetry  -- sends a prompt to Gemini, cycling through keys/models on failure
 *  - buildGeminiAdAndImagePrompt -- constructs the structured prompt for ad + image generation
 *  - parseGeminiJsonResponse -- safely extracts JSON from Gemini's sometimes-fenced output
 *
 * Called by:
 *  - Ad generation routes (server/routes) for on-demand ad creation
 *  - lowPerformanceChecker and unsharedAdsChecker for automated alternative ad creation
 *
 * Depends on:
 *  - Environment variables: GEMINI_API_KEYS (comma-separated) or individual GEMINI_API_KEY_* vars
 *  - axios for HTTP requests
 */
const axios = require('axios');

/** Ordered list of Gemini models to try, from preferred to fallback. */
const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.5-flash-lite'
];

/**
 * Retrieves all configured Gemini API keys.
 * Supports a single comma-separated env var (GEMINI_API_KEYS) or individual
 * named vars (GEMINI_API_KEY, GEMINI_API_KEY_two, etc.).
 *
 * @returns {string[]} Array of non-empty API key strings.
 */
function getGeminiKeys() {
  if (process.env.GEMINI_API_KEYS) {
    return process.env.GEMINI_API_KEYS.split(',').map(k => k.trim()).filter(Boolean);
  }
  return [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_two,
    process.env.GEMINI_API_KEY_three,
    process.env.GEMINI_API_KEY_Four
  ].filter(Boolean);
}

// Global registry that tracks temporarily blocked API keys (rate-limited or quota-exceeded).
// Keyed by the last 8 characters of each API key for safe logging.
if (!global.geminiKeyStatus) {
  global.geminiKeyStatus = {};
}

/**
 * Removes key-block entries older than 60 seconds so that previously
 * rate-limited keys can be retried.
 */
function cleanupExpiredKeyBlocks() {
  const now = Date.now();
  for (const key in global.geminiKeyStatus) {
    if (now - global.geminiKeyStatus[key].blockedAt > 60000) {
      delete global.geminiKeyStatus[key];
    }
  }
}

/**
 * Sends a text prompt to the Gemini API with full retry, key-rotation, and model-fallback logic.
 *
 * The retry strategy is a three-level nested loop:
 *   1. Outer: iterate over GEMINI_MODELS (model fallback)
 *   2. Middle: iterate over available API keys (key rotation)
 *   3. Inner: retry each key up to maxRetries times (transient error recovery)
 *
 * Special error handling:
 *   - 429 (rate limited): block the key for 60 s and move to the next key
 *   - 403 + quota message: same as 429
 *   - 503 (overloaded): exponential backoff (capped at 10 s) then retry same key
 *   - Other errors: linear backoff before next attempt
 *
 * @param {string} prompt - The full text prompt to send.
 * @param {number} [maxRetries=3] - Maximum retry attempts per key per model.
 * @param {string} [model='gemini-2.5-flash'] - Preferred model (overridden by the fallback loop).
 * @returns {Promise<string>} The trimmed text content from Gemini's response.
 * @throws {Error} The last encountered error if all attempts across all models and keys fail.
 */
async function callGeminiWithRetry(prompt, maxRetries = 3, model = 'gemini-2.5-flash') {
  const geminiKeys = getGeminiKeys();
  if (geminiKeys.length === 0) {
    throw new Error('No Gemini API keys configured');
  }

  cleanupExpiredKeyBlocks();

  let lastError;

  // Model fallback loop
  for (let modelIdx = 0; modelIdx < GEMINI_MODELS.length; modelIdx++) {
    const modelName = GEMINI_MODELS[modelIdx];

    // Key rotation loop
    for (let keyIdx = 0; keyIdx < geminiKeys.length; keyIdx++) {
      const apiKey = geminiKeys[keyIdx];
      const keyHash = apiKey.slice(-8);

      // Skip keys that are temporarily blocked due to rate limits
      if (global.geminiKeyStatus[keyHash]?.blocked) {
        console.log(`[Gemini] Skipping key #${keyIdx + 1} (rate limited)`);
        continue;
      }

      // Retry loop for transient failures on this key + model combination
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

          if (status === 429) {
            // Rate limit hit -- block this key for 60 s and try the next one
            console.log(`[Gemini] Key #${keyIdx + 1} rate limited - marking as blocked for 60s`);
            global.geminiKeyStatus[keyHash] = { blocked: true, blockedAt: Date.now() };
            break;
          }

          if (status === 403 && errorMessage.includes('quota')) {
            // Quota exhausted -- treat identically to rate limit
            console.log(`[Gemini] Key #${keyIdx + 1} quota exceeded - trying next key`);
            global.geminiKeyStatus[keyHash] = { blocked: true, blockedAt: Date.now() };
            break;
          }

          if (status === 503) {
            // Service overloaded -- exponential backoff capped at 10 s
            const waitTime = Math.min(1000 * Math.pow(2, attempt), 10000);
            console.log(`[Gemini] Service overloaded - waiting ${waitTime}ms`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }

          // Generic transient error -- short linear backoff before retrying
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 500 * attempt));
          }
        }
      }
    }
  }

  console.error('[Gemini] All attempts failed');
  throw lastError;
}

/**
 * Builds a structured prompt that instructs Gemini to produce ad copy and an image
 * search keyword in strict JSON format.
 *
 * The prompt enforces language requirements (Hebrew, Arabic, or any other language)
 * and constrains the image_keyword field to English visual nouns suitable for
 * stock-photo searches via the Pexels API.
 *
 * @param {Object} params
 * @param {string} params.businessName - Name of the business being advertised.
 * @param {string} params.productService - Description of the product or service.
 * @param {string} params.keyMessage - Key selling points or message.
 * @param {string} params.tone - Desired tone (e.g., "professional", "playful").
 * @param {string} [params.language='Hebrew'] - Target language for the ad copy.
 * @returns {string} The fully constructed prompt string.
 */
function buildGeminiAdAndImagePrompt({ businessName, productService, keyMessage, tone, language }) {
  const targetLanguage = language || 'Hebrew';

  // Build the language-specific instruction block for the prompt
  let languageInstruction;
  if (targetLanguage === 'Hebrew') {
    languageInstruction = 'Write title, ad_text, and call_to_action in HEBREW (עברית). Use Hebrew characters.';
  } else if (targetLanguage === 'Arabic') {
    languageInstruction = 'Write title, ad_text, and call_to_action in ARABIC (العربية). Use Arabic characters.';
  } else {
    languageInstruction = `Write title, ad_text, and call_to_action in ${targetLanguage.toUpperCase()}. Use ${targetLanguage} language only.`;
  }

  return `
You are an expert marketing copywriter and a stock-photo search specialist.
You will receive a business name and a short description of product/service and tone.
Produce a STRICT JSON object ONLY with these fields:

{
  "title": "short ad title (max 10 words)",
  "ad_text": "marketing body text (2-3 sentences)",
  "call_to_action": "short CTA (3-5 words)",
  "image_keyword": "2-4 English words ONLY, visual nouns suitable for stock-photo search (photographable). No marketing adjectives. Use nouns or noun + descriptor",
  "image_style": "one word describing image style or context (spa, clinic, workshop, food, salon, outdoor, studio) - in English"
}

CRITICAL LANGUAGE REQUIREMENT:
${languageInstruction}
The target language is: ${targetLanguage}

RULES:
- image_keyword MUST be in English, 2-4 words maximum (e.g. "shiatsu massage therapy", "laser hair removal clinic", "bakery bread").
- image_keyword must be VISUAL and PHOTOGRAPHABLE. No words like "best", "top", "affordable".
- image_style is optional but helpful (single English word).
- IMPORTANT: title, ad_text, and call_to_action MUST be written in ${targetLanguage}, regardless of the input language.
- Output EXACTLY one JSON object and nothing else. Do not add explanation, markdown, or code fences.

INPUT:
Business name: "${businessName || ''}"
Product/service: "${productService || ''}"
Message/key points: "${keyMessage || ''}"
Tone: "${tone || 'professional'}"
Target language: ${targetLanguage}
`.trim();
}

/**
 * Parses a JSON object from Gemini's text response, which may be wrapped in
 * markdown code fences or contain surrounding prose.
 *
 * Extraction priority:
 *   1. Content inside ```json ... ``` or ``` ... ``` fences.
 *   2. First {...} block found via regex.
 *
 * @param {string} responseText - Raw text response from Gemini.
 * @returns {Object} The parsed JSON object.
 * @throws {SyntaxError} If the extracted string is not valid JSON.
 */
function parseGeminiJsonResponse(responseText) {
  let jsonString = (responseText || '').trim();

  // Try to extract JSON from markdown code fences first
  const fencedMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch) {
    jsonString = fencedMatch[1];
  } else {
    // Fall back to finding the first brace-delimited block
    const braceMatch = jsonString.match(/\{[\s\S]*\}/);
    if (braceMatch) jsonString = braceMatch[0];
  }
  return JSON.parse(jsonString);
}

module.exports = {
  callGeminiWithRetry,
  buildGeminiAdAndImagePrompt,
  parseGeminiJsonResponse
};
