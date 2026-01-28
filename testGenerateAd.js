/**
 * testGenerateAd.js -- Standalone Gemini AI Ad-Generation Test Script
 *
 * Purpose:
 *   Quick smoke test that verifies the Google Gemini API key is valid and the
 *   text-generation endpoint is reachable. Sends a short Hebrew prompt asking
 *   for a candy-business advertisement and prints the response.
 *
 * Usage:
 *   node testGenerateAd.js
 *
 * Prerequisites:
 *   - A .env file (or environment variable) containing GEMINI_API_KEY.
 *   - The @google/genai package installed.
 *
 * Connections:
 *   - Uses the same Gemini model ("gemini-2.5-flash") that the server's ad
 *     generator uses in production, so this script doubles as an integration
 *     check for that dependency.
 */

import 'dotenv/config';
import * as genai from '@google/genai';

/**
 * Generates a short ad using the Gemini text-generation API and logs it.
 * @returns {Promise<void>}
 */
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
