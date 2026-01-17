const axios = require('axios');

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

  const queries = [searchTerm.trim()];
  if (imageStyle && imageStyle.length <= 12) {
    queries.push(`${searchTerm.trim()} ${imageStyle}`);
  }

  const firstWord = searchTerm.trim().split(' ')[0];
  if (firstWord && firstWord.length > 2 && firstWord.toLowerCase() !== searchTerm.toLowerCase()) {
    queries.push(firstWord);
  }

  const uniqueQueries = [...new Set(queries)].slice(0, 4);

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
        const imageUrl = selectedPhoto.src.large2x || selectedPhoto.src.large || selectedPhoto.src.original;
        console.log(`Found ${photos.length} images. Selected top result for term: "${term}"`);
        return imageUrl;
      } else {
        console.log(`No results for: "${term}"`);
      }
    } catch (err) {
      console.warn(`Pexels search failed for "${term}":`, err.message);
    }

    if (i < uniqueQueries.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }

  console.log('All Pexels searches failed - will use gradient fallback');
  return null;
}

module.exports = { searchPexelsImage };
