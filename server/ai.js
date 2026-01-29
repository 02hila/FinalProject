/**
 * AI Routes Module
 *
 * This module provides AI-powered helper endpoints for ad creation assistance.
 * It leverages the Gemini LLM and Pexels stock photo API to generate smart image
 * search keywords, fetch stock images, and produce marketing copy on demand.
 * These endpoints are consumed by the front-end ad builder.
 *
 * @module routes/ai
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const { callGeminiWithRetry } = require('./server');

/**
 * Generate Smart Image Search Keywords
 *
 * Uses Gemini LLM to translate business context into 2-3 concrete, visual English
 * keywords suitable for stock-photo searches. The AI is prompted to think visually
 * and provide photographable subjects rather than abstract concepts.
 *
 * @route POST /api/ai/smart-image-search
 * @param {Object} req.body - Request body
 * @param {string} req.body.productService - The product or service being advertised
 * @param {string} req.body.businessName - Name of the business
 * @param {string} [req.body.adText] - Optional ad copy for additional context
 * @returns {Object} JSON response with success status and search query
 * @property {boolean} success - Whether the operation was successful
 * @property {string} searchQuery - Generated search keywords (2-3 words)
 * @throws {500} If there's an error processing the request (fallback keywords provided)
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
 * Search Stock Images via Pexels API
 *
 * Proxies a keyword search request to the Pexels stock photo API and returns
 * up to 15 landscape-oriented photos. The search is performed using the provided
 * query keywords and filtered for landscape orientation.
 *
 * @route POST /api/ai/search-images
 * @param {Object} req.body - Request body
 * @param {string} req.body.query - The search keywords to send to Pexels API
 * @returns {Object} JSON response with success status and image array
 * @property {boolean} success - Whether the search was successful
 * @property {Array} images - Array of Pexels photo objects (up to 15)
 * @throws {500} If there's an error with the Pexels API call
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
 * Generate Marketing Text/Slogan
 *
 * Generates a short marketing slogan (maximum 6 words) using Gemini LLM in the
 * specified language. The AI creates compelling copy based on business information
 * and desired tone. The response is sanitized to remove markdown formatting and
 * unwanted prefixes that the model sometimes emits.
 *
 * @route POST /api/ai/generate-text
 * @param {Object} req.body - Request body
 * @param {string} req.body.businessName - Name of the business
 * @param {string} req.body.productService - Product or service description
 * @param {string} [req.body.targetAudience] - Intended audience (informational)
 * @param {string} [req.body.keyMessage] - Core message to convey
 * @param {string} [req.body.tone] - Desired tone (e.g., professional, playful)
 * @param {string} [req.body.language] - Language for the slogan (default: English)
 * @returns {Object} JSON response with success status and generated text
 * @property {boolean} success - Whether the generation was successful
 * @property {string} [text] - Generated marketing slogan (if successful)
 * @property {string} [error] - Error message (if failed)
 * @throws {500} If there's an error with the Gemini API call
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
