// routes/adImprovement.js - NEW FILE
// AI-powered ad improvement based on company feedback

const express = require('express');
const router = express.Router();
const PendingAd = require('../models/PendingAd');
const Campaign = require('../models/Campaign');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');
const axios = require('axios');
const sharp = require('sharp');

// ✅ Try both canvas libraries (for compatibility)
let createCanvas, loadImage;
try {
  const canvas = require('canvas');
  createCanvas = canvas.createCanvas;
  loadImage = canvas.loadImage;
} catch (err) {
  const canvas = require('@napi-rs/canvas');
  createCanvas = canvas.createCanvas;
  loadImage = canvas.loadImage;
}

/* ---------------------------------------------
   🔧 HELPER: Call Gemini with Retry
---------------------------------------------- */
async function callGeminiWithRetry(prompt, maxRetries = 3, model = 'gemini-2.0-flash-exp') {
  console.log('📞 Calling Gemini API for improvement...');
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        { contents: [{ parts: [{ text: prompt }] }] },
        { timeout: 60000 }
      );
      
      console.log('✅ Gemini responded');
      return response.data.candidates[0].content.parts[0].text.trim();
      
    } catch (error) {
      console.error(`❌ Gemini attempt ${attempt} failed:`, error.message);
      lastError = error;
      
      if (error.response?.status === 503 && attempt < maxRetries) {
        const delay = 1000 * Math.pow(2, attempt - 1);
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        break;
      }
    }
  }
  
  throw lastError;
}

/* ---------------------------------------------
   🔧 HELPER: Build AI Improvement Prompt
---------------------------------------------- */
function buildImprovementPrompt(ad, rejectionData) {
  return `
You are an expert marketing copywriter specialized in improving advertising content based on client feedback.

CONTEXT:
An advertising professional created an ad that was rejected by the client company.
Your job is to analyze the rejection feedback and create an improved version of the ad.

ORIGINAL AD:
Title: "${ad.title}"
Body Text: "${ad.text}"
Call to Action: "${ad.callToAction}"

BUSINESS CONTEXT:
Business Name: ${ad.metadata?.businessName || 'N/A'}
Product/Service: ${ad.metadata?.productService || 'N/A'}
Target Audience: ${ad.metadata?.targetAudience || 'General'}
Tone: ${ad.metadata?.tone || 'Professional'}

REJECTION FEEDBACK:
Reason: ${rejectionData.reason}
Details: ${rejectionData.details || 'No additional details provided'}

YOUR TASK:
Create an improved version of this ad that addresses the rejection feedback while:
1. Maintaining the core business message
2. Respecting the original tone and style
3. Keeping the same language (Hebrew/English as in original)
4. Making specific improvements based on the rejection reason

OUTPUT REQUIREMENTS:
Return ONLY a valid JSON object with these exact fields:
{
  "title": "improved short ad title (max 10 words, same language as original)",
  "ad_text": "improved marketing body text (2-3 sentences, addresses the feedback)",
  "call_to_action": "improved CTA (3-5 words)",
  "improvement_notes": "brief explanation of what was changed and why (in English, 1-2 sentences)"
}

CRITICAL RULES:
- Output EXACTLY one JSON object and nothing else
- No markdown, no code fences, no explanations outside the JSON
- Keep the same language as the original ad
- Make meaningful improvements based on the rejection feedback
- If rejection mentions "too long", make it shorter
- If rejection mentions "not clear", make it clearer
- If rejection mentions "tone", adjust the tone
- If rejection mentions specific content issues, address them directly

Generate the improved ad now:
`.trim();
}

/* ---------------------------------------------
   🔧 HELPER: Search Pexels Image (same as server.js)
---------------------------------------------- */
async function searchPexelsImage(searchTerm, imageStyle = null) {
  console.log('🖼️ Pexels search for:', searchTerm, 'style:', imageStyle);

  if (!process.env.PEXELS_API_KEY) {
    console.log('⚠️ No Pexels API key - skipping search');
    return null;
  }

  if (!searchTerm || typeof searchTerm !== 'string' || searchTerm.trim().length === 0) {
    console.log('⚠️ Empty search term provided');
    return null;
  }

  const queries = [searchTerm.trim()];
  if (imageStyle && imageStyle.length <= 12) {
    queries.push(`${searchTerm.trim()} ${imageStyle}`);
  }
  
  const firstWord = searchTerm.trim().split(' ')[0];
  if (firstWord && firstWord.length > 2) {
    queries.push(firstWord);
  }

  const uniqueQueries = [...new Set(queries)].slice(0, 4);

  for (let i = 0; i < uniqueQueries.length; i++) {
    const term = uniqueQueries[i];
    console.log(`🔍 Pexels attempt ${i + 1}: "${term}"`);
    
    try {
      const response = await axios.get('https://api.pexels.com/v1/search', {
        params: {
          query: term,
          per_page: 8,
          orientation: 'landscape'
        },
        headers: { Authorization: process.env.PEXELS_API_KEY },
        timeout: 6000
      });

      const photos = response.data.photos;
      if (photos && photos.length > 0) {
        const imageUrl = photos[0].src.large2x || photos[0].src.large;
        console.log(`✅ Found ${photos.length} images`);
        return imageUrl;
      }
    } catch (err) {
      console.warn(`❌ Pexels search failed for "${term}":`, err.message);
    }

    if (i < uniqueQueries.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }

  return null;
}

/* ---------------------------------------------
   🔧 HELPER: Create Ad Design (same as server.js)
---------------------------------------------- */
function cleanAdText(text) {
  if (!text) return '';
  return text
    .replace(/\*\*Option \d+.*?\*\*/gi, '')
    .replace(/Option \d+.*?:/gi, '')
    .replace(/\*\*\d+\.\s*/gi, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/#{1,6}\s+/g, '')
    .replace(/`{1,3}/g, '')
    .replace(/^[\-\*\•]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/ +/g, ' ')
    .trim();
}

function wrapText(ctx, text, maxWidth) {
  if (!text) return [];
  const paragraphs = text.split(/\n+/);
  const lines = [];
  
  paragraphs.forEach(paragraph => {
    const trimmedParagraph = paragraph.trim();
    if (!trimmedParagraph) return;
    
    const words = trimmedParagraph.split(' ');
    let currentLine = '';
    
    for (let i = 0; i < words.length; i++) {
      const testWord = words[i];
      let testLine = currentLine + testWord + ' ';
      const metrics = ctx.measureText(testLine);
      
      if (metrics.width > maxWidth && i > 0) {
        lines.push(currentLine.trim() + '\u200F');
        currentLine = testWord + ' ';
      } else {
        currentLine = testLine;
      }
    }
    
    if (currentLine.trim()) {
      lines.push(currentLine.trim() + '\u200F');
    }
  });
  
  return lines;
}

async function createAdDesign(adData) {
  console.log('🎨 Creating improved ad design...');
  
  const { businessName, adText, title, productService, adStyle, imageUrl, agentName, callToAction } = adData;
  const canvas = createCanvas(800, 450);
  const ctx = canvas.getContext('2d');

  const styles = {
    modern: { overlay: 'rgba(0, 0, 0, 0.5)', accent: '#667eea' },
    minimal: { overlay: 'rgba(255, 255, 255, 0.85)', textColor: '#333', accent: '#333' },
    elegant: { overlay: 'rgba(0, 0, 0, 0.6)', accent: '#d4af37' },
    dark: { overlay: 'rgba(0, 0, 0, 0.7)', accent: '#00d4ff' }
  };
  const selectedStyle = styles[adStyle] || styles.modern;

  // Load background
  if (imageUrl) {
    try {
      const image = await loadImage(imageUrl);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      ctx.fillStyle = selectedStyle.overlay;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } catch (err) {
      console.log('🎨 Using gradient fallback');
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, '#667eea');
      gradient.addColorStop(1, '#764ba2');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  } else {
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Content box
  const boxPadding = 50;
  const qrZoneWidth = 160;
  const boxHeight = 350;
  const boxY = (canvas.height - boxHeight) / 2 - 10;
  const boxWidth = canvas.width - (boxPadding * 2) - qrZoneWidth;
  const boxX = boxPadding + qrZoneWidth;

  ctx.fillStyle = adStyle === 'minimal' ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.4)';
  ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

  const centerX = boxX + boxWidth / 2;
  const titleX = boxX + boxWidth - 10;
  
  // Title
  const titleText = '\u202E' + (title ? cleanAdText(title).toUpperCase() : (businessName || 'BUSINESS').toUpperCase()) + '!';
  ctx.fillStyle = adStyle === 'minimal' ? '#222' : selectedStyle.accent;
  ctx.font = 'bold 30px Arial';
  ctx.textAlign = 'right';
  ctx.fillText(titleText, titleX, boxY + 65);

  // Body text
  ctx.textAlign = 'center';
  ctx.fillStyle = adStyle === 'minimal' ? '#111' : '#fff';
  ctx.font = 'bold 26px Arial';
  const cleanText = cleanAdText(adText);
  const lines = wrapText(ctx, cleanText, boxWidth - 40);
  lines.slice(0, 6).forEach((line, i) => {
    ctx.fillText(line, centerX, boxY + 120 + (i * 30));
  });

  // CTA Button
  const buttonY = boxY + boxHeight - 30;
  const buttonWidth = 320;
  const buttonHeight = 50;
  const buttonX = centerX - buttonWidth / 2;
  
  const ctaText = '\u202E' + (callToAction ? cleanAdText(callToAction).toUpperCase() : 'GET STARTED NOW!');
  ctx.fillStyle = adStyle === 'minimal' ? '#333' : '#667eea';
  ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px Arial';
  ctx.fillText(ctaText, centerX, buttonY + 32);

  // Agent credit
  if (agentName) {
    ctx.font = '12px Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.textAlign = 'right';
    ctx.fillText(`נוצר ע"י ${agentName} (משופר)`, canvas.width - 20, canvas.height - 20);
  }

  return canvas.toDataURL('image/png');
}

/* ---------------------------------------------
   ✨ POST - Improve Rejected Ad with AI
---------------------------------------------- */
router.post('/:id/improve', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🔧 Starting AI improvement for ad:', id);
    
    // 1. Find the ad
    const ad = await PendingAd.findById(id)
      .populate('agentId', 'fullName')
      .populate('campaignId', 'websiteUrl');
    
    if (!ad) {
      return res.status(404).json({
        success: false,
        error: 'פרסומת לא נמצאה'
      });
    }
    
    if (ad.status !== 'rejected') {
      return res.status(400).json({
        success: false,
        error: 'ניתן לשפר רק פרסומות שנדחו'
      });
    }
    
    // 2. Mark as processing
    ad.aiImprovement = {
      isProcessing: true,
      lastAttempt: new Date(),
      attempts: (ad.aiImprovement?.attempts || 0) + 1,
      error: ''
    };
    ad.status = 'improving';
    await ad.save();
    
    console.log('✅ Ad marked as improving');
    
    // 3. Build improvement prompt
    const prompt = buildImprovementPrompt(ad, ad.currentRejection);
    
    // 4. Call Gemini
    let geminiResponse;
    try {
      geminiResponse = await callGeminiWithRetry(prompt, 3, 'gemini-2.0-flash-exp');
    } catch (geminiError) {
      console.error('❌ Gemini failed:', geminiError.message);
      
      ad.aiImprovement.isProcessing = false;
      ad.aiImprovement.error = 'שגיאה בשיפור AI: ' + geminiError.message;
      ad.status = 'rejected'; // חזרה לסטטוס דחוי
      await ad.save();
      
      return res.status(500).json({
        success: false,
        error: 'שגיאה בשיפור הפרסומת עם AI',
        details: geminiError.message
      });
    }
    
    // 5. Parse JSON response
    let improvedAd;
    try {
      let jsonString = (geminiResponse || '').trim();
      
      // Remove markdown fences if present
      const fencedMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (fencedMatch) {
        jsonString = fencedMatch[1];
      } else {
        const braceMatch = jsonString.match(/\{[\s\S]*\}/);
        if (braceMatch) jsonString = braceMatch[0];
      }
      
      improvedAd = JSON.parse(jsonString);
      console.log('✅ Gemini response parsed:', improvedAd);
      
    } catch (parseError) {
      console.error('❌ JSON parsing failed:', parseError.message);
      console.log('Raw response:', geminiResponse);
      
      ad.aiImprovement.isProcessing = false;
      ad.aiImprovement.error = 'שגיאה בפענוח תגובת AI';
      ad.status = 'rejected';
      await ad.save();
      
      return res.status(500).json({
        success: false,
        error: 'שגיאה בפענוח שיפור AI',
        rawResponse: geminiResponse
      });
    }
    
    // 6. Search for new image (optional - use original keyword or keep same image)
    let imageUrl = null;
    const keyword = ad.metadata?.imageKeyword || `${ad.metadata?.businessName} ${ad.metadata?.productService}`;
    const style = ad.metadata?.imageStyle || ad.metadata?.adStyle;
    
    console.log(`🔎 Searching for image: "${keyword}"`);
    imageUrl = await searchPexelsImage(keyword, style);
    
    // If no new image found, keep original
    if (!imageUrl) {
      console.log('⚠️ No new image found, keeping original');
      // We'll use the old imageData but create a new design with new text
    }
    
    // 7. Create new ad design
    const newImageData = await createAdDesign({
      businessName: ad.metadata?.businessName,
      adText: improvedAd.ad_text,
      title: improvedAd.title,
      callToAction: improvedAd.call_to_action,
      productService: ad.metadata?.productService,
      adStyle: ad.metadata?.adStyle || 'modern',
      imageUrl: imageUrl, // Will be null if not found, will use gradient
      agentName: ad.agentId?.fullName || 'AdsMaker'
    });
    
    console.log('✅ New ad design created');
    
    // 8. Update the ad with improvement
    ad.addImprovement({
      title: improvedAd.title,
      text: improvedAd.ad_text,
      callToAction: improvedAd.call_to_action,
      imageData: newImageData
    });
    
    ad.aiImprovement = {
      isProcessing: false,
      lastAttempt: new Date(),
      attempts: ad.aiImprovement.attempts,
      error: ''
    };
    
    await ad.save();
    
    console.log('✅ Ad improved successfully');
    
    // 9. Return success
    res.json({
      success: true,
      ad: ad,
      improvementNotes: improvedAd.improvement_notes,
      message: 'הפרסומת שופרה בהצלחה ונשלחה לאישור מחדש'
    });
    
  } catch (error) {
    console.error('❌ Error in improve endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'שגיאה בשיפור הפרסומת',
      details: error.message
    });
  }
});

/* ---------------------------------------------
   GET - Get improvement history for an ad
---------------------------------------------- */
router.get('/:id/history', authMiddleware, async (req, res) => {
  try {
    const ad = await PendingAd.findById(req.params.id)
      .populate('improvementHistory.performedBy', 'fullName email')
      .lean();
    
    if (!ad) {
      return res.status(404).json({
        success: false,
        error: 'פרסומת לא נמצאה'
      });
    }
    
    res.json({
      success: true,
      history: ad.improvementHistory || [],
      rejectionCount: ad.rejectionCount || 0
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'שגיאה בטעינת היסטוריה'
    });
  }
});

module.exports = router;