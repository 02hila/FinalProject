import 'dotenv/config';
import * as genai from '@google/genai';

async function generateAd() {
  try {
    console.log('🤖 Sending prompt to Gemini...');

    const response = await genai.models.text.generate({
      apiKey: process.env.GEMINI_API_KEY,
      model: 'gemini-2.5-flash',
      input: 'כתוב פרסומת קצרה ומושכת לעסק חדש בתחום ממתקים',
      maxOutputTokens: 300,
    });

    console.log('✅ Generated ad:');
    console.log(response.output_text);

  } catch (err) {
    console.error('❌ Error generating ad:', err);
  }
}

generateAd();
