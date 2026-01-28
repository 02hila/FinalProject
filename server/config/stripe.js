/**
 * @file stripe.js - Stripe SDK Initialization
 *
 * Creates and exports a pre-configured Stripe client instance used across the
 * server for payment-related operations (creating checkout sessions, managing
 * subscriptions, handling webhooks, etc.).
 *
 * Requires the STRIPE_SECRET_KEY environment variable to be set. A missing key
 * is logged as an error at startup but does not crash the process, so that
 * non-payment routes can still function during development.
 *
 * @exports {Stripe} stripe - Configured Stripe SDK instance.
 *
 * Related files:
 *   - server/routes/payment.js (or similar) -- uses this instance for API calls.
 *   - .env                                  -- must contain STRIPE_SECRET_KEY.
 */

const Stripe = require('stripe');

// Warn early if the secret key is missing; downstream calls will fail gracefully.
if (!process.env.STRIPE_SECRET_KEY) {
  console.error('STRIPE_SECRET_KEY is not set!');
}

/**
 * Pre-configured Stripe client pinned to a specific API version to avoid
 * breaking changes when Stripe releases new versions.
 *
 * @type {Stripe}
 */
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16'
});

module.exports = stripe;
