const express = require('express');
const router = express.Router();
const axios = require('axios');

// POST - Smart Image Search
router.post('/smart-image-search', async (req, res) => {
  try {
    const { productService, businessName, adText } = req.body;

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

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      }
    );

    let searchQuery = response.data.candidates[0].content.parts[0].text.trim();
    
    searchQuery = searchQuery
      .replace(/[*"'`\n]/g, '')
      .replace(/Keywords?:/gi, '')
      .trim();

    console.log('🔍 Gemini suggested search query:', searchQuery);

    res.json({
      success: true,
      searchQuery: searchQuery
    });

  } catch (error) {
    console.error('Smart image search error:', error.response?.data || error.message);
    res.json({
      success: false,
      searchQuery: 'business professional modern'
    });
  }
});

// POST - Pexels Image Search
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

// POST - Generate Text with Gemini
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

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      }
    );

    let generatedText = response.data.candidates[0].content.parts[0].text.trim();
    generatedText = generatedText
      .replace(/\*\*/g, '')
      .replace(/Option \d+.*?:/gi, '')
      .replace(/\*\*Option \d+.*?\*\*/gi, '')
      .split('\n')[0]
      .trim();

    res.json({ success: true, text: generatedText });
  } catch (error) {
    console.error('Error generating text:', error.response?.data || error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;