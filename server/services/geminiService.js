const axios = require('axios');

const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.5-flash-lite'
];

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

if (!global.geminiKeyStatus) {
  global.geminiKeyStatus = {};
}

function cleanupExpiredKeyBlocks() {
  const now = Date.now();
  for (const key in global.geminiKeyStatus) {
    if (now - global.geminiKeyStatus[key].blockedAt > 60000) {
      delete global.geminiKeyStatus[key];
    }
  }
}

async function callGeminiWithRetry(prompt, maxRetries = 3, model = 'gemini-2.5-flash') {
  const geminiKeys = getGeminiKeys();
  if (geminiKeys.length === 0) {
    throw new Error('No Gemini API keys configured');
  }

  cleanupExpiredKeyBlocks();

  let lastError;

  for (let modelIdx = 0; modelIdx < GEMINI_MODELS.length; modelIdx++) {
    const modelName = GEMINI_MODELS[modelIdx];

    for (let keyIdx = 0; keyIdx < geminiKeys.length; keyIdx++) {
      const apiKey = geminiKeys[keyIdx];
      const keyHash = apiKey.slice(-8);

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

          if (status === 429) {
            console.log(`[Gemini] Key #${keyIdx + 1} rate limited - marking as blocked for 60s`);
            global.geminiKeyStatus[keyHash] = { blocked: true, blockedAt: Date.now() };
            break;
          }

          if (status === 403 && errorMessage.includes('quota')) {
            console.log(`[Gemini] Key #${keyIdx + 1} quota exceeded - trying next key`);
            global.geminiKeyStatus[keyHash] = { blocked: true, blockedAt: Date.now() };
            break;
          }

          if (status === 503) {
            const waitTime = Math.min(1000 * Math.pow(2, attempt), 10000);
            console.log(`[Gemini] Service overloaded - waiting ${waitTime}ms`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }

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

function buildGeminiAdAndImagePrompt({ businessName, productService, keyMessage, tone, language }) {
  const targetLanguage = language || 'Hebrew';

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

function parseGeminiJsonResponse(responseText) {
  let jsonString = (responseText || '').trim();
  const fencedMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch) {
    jsonString = fencedMatch[1];
  } else {
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
