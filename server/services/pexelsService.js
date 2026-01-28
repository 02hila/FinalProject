/**
 * Pexels Image Search Service
 *
 * Searches the Pexels stock-photo API for landscape images matching a given
 * keyword. Implements a cascading search strategy: tries the full term first,
 * then the term combined with an optional style qualifier, and finally the
 * first word alone as a broadened fallback.
 *
 * Key exports:
 *  - searchPexelsImage -- returns the URL of the best-matching landscape photo, or null
 *
 * Called by:
 *  - Ad generation routes (to find a background image for a newly created ad)
 *  - lowPerformanceChecker and unsharedAdsChecker (to find images for alternative ads)
 *
 * Depends on:
 *  - Environment variable: PEXELS_API_KEY
 *  - axios for HTTP requests
 */
const axios = require('axios');

/**
 * Searches Pexels for a landscape stock photo matching the given term.
 *
 * Search strategy (up to 4 queries, tried in order):
 *   1. Exact searchTerm
 *   2. searchTerm + imageStyle (if style is short enough to be useful)
 *   3. First word of searchTerm alone (broadened fallback)
 * Each query returns up to 8 results; the top result is selected.
 *
 * A 250 ms delay is inserted between successive API calls to stay within
 * Pexels rate limits.
 *
 * @param {string} searchTerm - English keywords for the image search (e.g. "bakery bread").
 * @param {string|null} [imageStyle=null] - Optional single-word style hint (e.g. "outdoor", "studio").
 * @returns {Promise<string|null>} URL of the best matching photo (large2x preferred), or null if none found.
 */
async function searchPexelsImage(searchTerm, imageStyle = null) {
  console.log('Pexels search for:', searchTerm, 'style:', imageStyle);

  if (!process.env.PEXELS_API_KEY) {
    console.log('No Pexels API key - skipping search');
    return null;
  }

  if (!searchTerm || typeof searchTerm !== 'string' || searchTerm.trim().length === 0) {
    console.log('Empty search term provided');
    return null;
  }

  // Build an ordered list of search queries from most specific to most broad
  const queries = [searchTerm.trim()];
  if (imageStyle && imageStyle.length <= 12) {
    queries.push(`${searchTerm.trim()} ${imageStyle}`);
  }

  // Use just the first word as a broadened fallback (only if it differs from the full term)
  const firstWord = searchTerm.trim().split(' ')[0];
  if (firstWord && firstWord.length > 2 && firstWord.toLowerCase() !== searchTerm.toLowerCase()) {
    queries.push(firstWord);
  }

  const uniqueQueries = [...new Set(queries)].slice(0, 4);

  // Try each query in order; return the first successful result
  for (let i = 0; i < uniqueQueries.length; i++) {
    const term = uniqueQueries[i];
    console.log(`Pexels attempt ${i + 1}: "${term}"`);

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
        const selectedPhoto = photos[0];
        // Prefer the highest-resolution variant available
        const imageUrl = selectedPhoto.src.large2x || selectedPhoto.src.large || selectedPhoto.src.original;
        console.log(`Found ${photos.length} images. Selected top result for term: "${term}"`);
        return imageUrl;
      } else {
        console.log(`No results for: "${term}"`);
      }
    } catch (err) {
      console.warn(`Pexels search failed for "${term}":`, err.message);
    }

    // Small delay between requests to respect Pexels API rate limits
    if (i < uniqueQueries.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }

  console.log('All Pexels searches failed - will use gradient fallback');
  return null;
}

module.exports = { searchPexelsImage };
