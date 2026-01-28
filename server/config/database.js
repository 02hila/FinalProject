/**
 * @file database.js - MongoDB Connection Configuration
 *
 * Establishes and manages the connection to MongoDB using Mongoose.
 * Called once during server startup to initialize the database connection.
 * If the connection fails, the process exits with a non-zero code to signal
 * the failure to the hosting environment (e.g., Render, Docker).
 *
 * @exports {Function} connectDatabase - Async function that opens the MongoDB connection.
 *
 * Dependencies:
 *   - mongoose: ODM for MongoDB.
 *   - process.env.MONGODB_URI: Connection string set in the environment.
 *
 * Related files:
 *   - server/index.js (or app.js) -- calls connectDatabase() at startup.
 */

const mongoose = require('mongoose');

/**
 * Opens a connection to MongoDB using the URI from environment variables.
 *
 * @async
 * @function connectDatabase
 * @returns {Promise<void>} Resolves when the connection is established.
 * @throws Will log the error and terminate the process (exit code 1) on failure.
 */
async function connectDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
}

module.exports = { connectDatabase };
