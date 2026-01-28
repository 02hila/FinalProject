/**
 * @file cors.js - Cross-Origin Resource Sharing (CORS) Configuration
 *
 * Defines the CORS policy used by the Express application.
 * Maintains a whitelist of allowed origins (production domains, Vercel previews,
 * and local development servers) and exposes a configuration object compatible
 * with the `cors` npm package.
 *
 * Current behaviour: all origins are ultimately allowed through (with a console
 * warning for origins not in the whitelist). This keeps the app functional during
 * development and for ad-hoc preview deployments while still logging unexpected
 * callers.
 *
 * @exports {Object}  corsOptions     - Configuration object passed to cors().
 * @exports {Array}   allowedOrigins  - Explicit list of whitelisted origin URLs.
 *
 * Related files:
 *   - server/index.js (or app.js) -- applies corsOptions via app.use(cors(corsOptions)).
 */

/** Explicit list of production and development origins that are always allowed. */
const allowedOrigins = [
  'https://adsmaker-frontend.vercel.app',
  'https://adsmaker-rho.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'https://adsmaker.onrender.com'
];

/** Regex to match any Vercel preview deployment for the adsmaker project. */
const vercelPreviewRegex = /adsmaker-.*\.vercel\.app$/;

/**
 * CORS options object consumed by the `cors` middleware.
 *
 * The `origin` callback implements the following logic:
 *   1. Requests with no origin (e.g., server-to-server, Postman) are allowed.
 *   2. Origins in the explicit whitelist or matching the Vercel preview regex are allowed.
 *   3. All other origins are allowed with a warning logged to the console.
 *   4. Malformed origin strings are caught and allowed to avoid blocking requests.
 *
 * @type {Object}
 */
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin header (non-browser clients, same-origin, etc.)
    if (!origin) return callback(null, true);

    try {
      const hostname = new URL(origin).hostname;

      if (allowedOrigins.includes(origin) || vercelPreviewRegex.test(hostname)) {
        return callback(null, true);
      }

      // Origin is not in the whitelist -- allow it but log a warning for visibility.
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
