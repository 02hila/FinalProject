const allowedOrigins = [
  'https://adsmaker-frontend.vercel.app',
  'https://adsmaker-rho.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'https://adsmaker.onrender.com'
];

const vercelPreviewRegex = /adsmaker-.*\.vercel\.app$/;

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    try {
      const hostname = new URL(origin).hostname;

      if (allowedOrigins.includes(origin) || vercelPreviewRegex.test(hostname)) {
        return callback(null, true);
      }

      console.warn('CORS origin not in whitelist but allowing:', origin);
      return callback(null, true);

    } catch (e) {
      console.error('CORS origin parse error:', origin, e.message);
      return callback(null, true);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

module.exports = { corsOptions, allowedOrigins };
