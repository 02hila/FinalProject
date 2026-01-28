/**
 * ai.js -- AI-Powered Helper Routes
 *
 * Purpose:
 *   Provides Express routes that leverage the Gemini LLM and the Pexels stock
 *   photo API to assist users during ad creation. These endpoints are consumed
 *   by the front-end ad builder to generate smart image search keywords, fetch
 *   stock images, and produce marketing copy on demand.
 *
 * Main logic:
 *   - /smart-image-search: Sends business context to Gemini and receives
 *     concrete, photography-friendly English keywords for stock-image search.
 *   - /search-images: Proxies a search request to the Pexels API and returns
 *     landscape-oriented photos.
 *   - /generate-text: Asks Gemini to write a short marketing slogan in the
 *     requested language.
 *
 * Key exports:
 *   - The Express Router instance (mounted at /api in server.js).
 *
 * Connections:
 *   - Imports callGeminiWithRetry from server.js (which re-exports it from
 *     geminiService) to call the Gemini LLM with automatic retry logic.
 *   - Calls the Pexels REST API directly via axios.
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const { callGeminiWithRetry } = require('./server');

/**
 * POST /smart-image-search
 *
 * @description Uses Gemini to translate business context into 2-3 concrete,
 *   visual English keywords suitable for stock-photo searches. If the Gemini
 *   call fails, falls back to a generic keyword set so the client can still
 *   display results.
 *
 * @param {Object} req.body
 * @param {string} req.body.productService - The product or service being advertised.
 * @param {string} req.body.businessName   - Name of the business.
 * @param {string} [req.body.adText]       - Optional ad copy for additional context.
 *
 * @returns {{ success: boolean, searchQuery: string }}
 */
router.post('/smart-image-search', async (req, res) => {
  try {
    const { productService, businessName, adText } = req.body;

    // The prompt instructs Gemini to think visually -- only concrete, photographable
    // subjects -- and includes worked examples to steer output quality.
    const prompt = `You are an image search expert. Given the following information about an advertisement, suggest 2-3 simple, visual, concrete English keywords that will find relevant stock photos on Pexels or Unsplash.

Business Name: ${businessName}
Product/Service: ${productService}
Ad Text: ${adText || 'N/A'}

IMPORTANT RULES:
1. Use only CONCRETE, VISUAL things that can be photographed (people, objects, places, actions)
2. Avoid abstract concepts like "education", "success", "quality"
3. For services, think about WHO does it or WHERE it happens
4. Keep it simple - 2-3 words maximum
5. Use common English words that stock photo sites will have
6. Think about the VISUAL SCENE, not the concept

Examples:
- "שיעורים פרטיים במתמטיקה" → "teacher student notebook"
- "ייעוץ עסקי" → "business meeting professionals"
- "שירותי ניקיון" → "cleaning service home"
- "קורס בישול" → "chef cooking kitchen"
- "יוגה בפארק" → "yoga outdoor nature"
- "עיצוב פנים" → "interior design modern"
- "מוסך רכב" → "mechanic car garage"
- "מספרה" → "barber haircut salon"
- "פיצה משלוחים" → "pizza delivery food"

Return ONLY 2-3 search keywords in English, nothing else. No explanation, no punctuation, just the keywords separated by spaces.`;

    let searchQuery;
    try {
      const geminiText = await callGeminiWithRetry(prompt, 3);
      // Strip markdown artifacts and meta-labels that Gemini sometimes includes.
      searchQuery = (geminiText || '').replace(/[*"'`\n]/g, '').replace(/Keywords?:/gi, '').trim();
      console.log('🔍 Gemini suggested search query:', searchQuery);
      res.json({ success: true, searchQuery });
    } catch (err) {
      console.error('Gemini API error:', err.message);
      // Fallback to safe generic keywords so the UI still shows images.
      res.json({ success: false, searchQuery: 'business professional modern' });
    }

  } catch (error) {
    console.error('Smart image search error:', error.response?.data || error.message);
    res.json({
      success: false,
      searchQuery: 'business professional modern'
    });
  }
});

/**
 * POST /search-images
 *
 * @description Proxies a keyword search to the Pexels API and returns up to
 *   15 landscape-oriented stock photos. The Pexels API key is read from the
 *   PEXELS_API_KEY environment variable.
 *
 * @param {Object} req.body
 * @param {string} req.body.query - The search keywords to send to Pexels.
 *
 * @returns {{ success: boolean, images: Object[] }}
 */
router.post('/search-images', async (req, res) => {
  try {
    const { query } = req.body;

    const response = await axios.get('https://api.pexels.com/v1/search', {
      params: {
        query: query,
        per_page: 15,
        orientation: 'landscape'
      },
      headers: {
        Authorization: process.env.PEXELS_API_KEY
      }
    });

    res.json({ success: true, images: response.data.photos });
  } catch (error) {
    console.error('Error searching images:', error.response?.data || error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /generate-text
 *
 * @description Generates a short marketing slogan (max 6 words) via Gemini in
 *   the specified language. The response is sanitized to remove markdown
 *   formatting and "Option N:" prefixes that the model sometimes emits.
 *
 * @param {Object} req.body
 * @param {string} req.body.businessName    - Name of the business.
 * @param {string} req.body.productService  - Product or service description.
 * @param {string} [req.body.targetAudience] - Intended audience (informational).
 * @param {string} [req.body.keyMessage]    - Core message to convey.
 * @param {string} [req.body.tone]          - Desired tone (e.g. professional, playful).
 * @param {string} [req.body.language]      - Language for the slogan (default: English).
 *
 * @returns {{ success: boolean, text?: string, error?: string }}
 */
router.post('/generate-text', async (req, res) => {
  try {
    const { businessName, productService, targetAudience, keyMessage, tone, language } = req.body;
    const selectedLanguage = language || 'English';

    const prompt = `Write a short marketing slogan in ${selectedLanguage} for:
Business: ${businessName}
Product: ${productService}
Message: ${keyMessage}

STRICT RULES:
- Maximum 6 words only
- Write in ${selectedLanguage}
- Do NOT write "Option 1" or "Option 2"
- Just write the slogan directly`;

    let generatedText;
    try {
      const geminiText = await callGeminiWithRetry(prompt, 3);
      // Clean up common Gemini output quirks: bold markers, numbered option
      // labels, and extra newlines. Only the first line is kept.
      generatedText = (geminiText || '')
        .replace(/\*\*/g, '')
        .replace(/Option \d+.*?:/gi, '')
        .replace(/\*\*Option \d+.*?\*\*/gi, '')
        .split('\n')[0]
        .trim();
      res.json({ success: true, text: generatedText });
    } catch (err) {
      console.error('Gemini API error:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  } catch (error) {
    console.error('Error generating text:', error.response?.data || error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
