/**
 * config/db.js
 * ─────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS:
 *   All MongoDB connection logic lives in one place.
 *   Every other file just calls connectDB() and never
 *   has to know HOW the connection works.
 *
 * HOW IT WORKS:
 *   1. Mongoose.connect() opens a TCP connection to MongoDB Atlas
 *   2. We register event listeners on the connection object
 *   3. 'connected' fires once the handshake is done
 *   4. 'error' fires if connection drops unexpectedly
 *   5. 'disconnected' fires when MongoDB is unreachable
 *   6. Mongoose automatically tries to reconnect after disconnect
 * ─────────────────────────────────────────────────────────────
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * connectDB — asynchronously connects to MongoDB Atlas.
 * Called once at server startup in server.js.
 * The server will NOT start if this fails.
 */
const connectDB = async () => {
  try {
    // mongoose.connect() returns a promise — we await it
    const conn=await mongoose.connect(process.env.MONGODB_URI);
    logger.info("MongoDB Connected");
    // Log which database host we connected to
    logger.info(`✅ MongoDB Connected: ${conn.connection.host}`);
    logger.info(`📦 Database Name: ${conn.connection.name}`);

  } catch (error) {
    // If connection fails at startup, we MUST stop the server.
    // There's no point running an app with no database.
    logger.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1); // Exit with failure code 1
  }
};

// ── Connection Event Listeners ──────────────────────────────────────────────
// These fire AFTER initial connection during the server's lifetime.

// Fires every time mongoose successfully connects (including reconnects)
mongoose.connection.on('connected', () => {
  logger.info('Mongoose connection established');
});

// Fires if a connection error occurs AFTER initial connection
mongoose.connection.on('error', (err) => {
  logger.error(`💥 Mongoose connection error: ${err.message}`);
});

// Fires when mongoose loses its connection to MongoDB
mongoose.connection.on('disconnected', () => {
  logger.warn('⚠️  Mongoose disconnected. Attempting to reconnect...');
});

// Graceful shutdown: when Node.js process is killed (Ctrl+C or server stop),
// we close the MongoDB connection cleanly so no data is lost.
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  logger.info('🔴 MongoDB connection closed due to app termination');
  process.exit(0);
});

module.exports = connectDB;
