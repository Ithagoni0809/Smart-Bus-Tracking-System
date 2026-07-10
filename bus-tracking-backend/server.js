/**
 * server.js
 * ─────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS:
 *   This is the TRUE entry point of the backend (the file you run
 *   with `node server.js` or `npm run dev`). It is responsible for:
 *     1. Loading environment variables FIRST (before anything else
 *        needs them — config/db.js, utils/jwt.js etc. all read
 *        process.env values at import time in some cases).
 *     2. Connecting to MongoDB.
 *     3. Creating a raw HTTP server wrapping the Express `app`
 *        (Socket.IO needs the raw http.Server, not just the Express app,
 *        to attach WebSocket upgrade handling).
 *     4. Attaching Socket.IO to that HTTP server.
 *     5. Starting to listen on PORT.
 *     6. Setting up global safety nets for crashes
 *        (uncaughtException, unhandledRejection).
 * ─────────────────────────────────────────────────────────────
 */

// ── Step 0: Load environment variables FIRST, before any other import ───────
// This must be the very first line that touches process.env-dependent code.
require('dotenv').config();

const http = require('http');
const { Server } = require('socket.io');

const app = require('./app');
const connectDB = require('./config/db');
const logger = require('./utils/logger');
const initializeSocket = require('./socket/socketHandler');

// ── Step 1: Global Safety Net — Uncaught Synchronous Exceptions ─────────────
// Catches errors that happen OUTSIDE of Express's request-response cycle
// (e.g., a bug in a setTimeout callback, or reading an undefined property
// during startup). Without this, Node.js crashes silently with no clean log.
process.on('uncaughtException', (err) => {
  logger.error(`💥 UNCAUGHT EXCEPTION! Shutting down...`);
  logger.error(`${err.name}: ${err.message}`);
  logger.error(err.stack);
  process.exit(1); // Exit immediately — the app is in an unknown/unsafe state
});

// ── Step 2: Connect to MongoDB BEFORE starting the server ───────────────────
// We don't want to accept HTTP requests if the database isn't ready.
connectDB();

// ── Step 3: Create a raw HTTP server wrapping the Express app ───────────────
// Why not just app.listen()? Because Socket.IO needs direct access to the
// underlying http.Server instance to intercept the WebSocket upgrade
// handshake — app.listen() creates this internally but doesn't expose it.
const server = http.createServer(app);

// ── Step 4: Attach Socket.IO to the same HTTP server ─────────────────────────
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL, // Same-origin policy as our REST API
    credentials: true,
  },
  // pingTimeout: how long to wait for a pong before considering a client
  // disconnected. Important for mobile drivers on patchy networks — too
  // short and we'd wrongly mark them disconnected during a brief signal drop.
  pingTimeout: 30000, // 30 seconds
});

// Make `io` accessible inside Express route controllers via req.app.get('io')
// (useful later if a REST endpoint needs to trigger a socket broadcast,
// e.g. admin manually broadcasting a notification through a REST API call)
app.set('io', io);

// Register every Socket.IO event listener (see socket/socketHandler.js)
initializeSocket(io);

// ── Step 5: Start listening ───────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  logger.info('═══════════════════════════════════════════════════');
  logger.info(`🚌  Smart Bus Tracking API`);
  logger.info(`🚀  Server running in ${process.env.NODE_ENV || 'development'} mode`);
  logger.info(`📡  Listening on port ${PORT}`);
  logger.info(`🔌  Socket.IO ready for real-time connections`);
  logger.info('═══════════════════════════════════════════════════');
});

// ── Step 6: Global Safety Net — Unhandled Promise Rejections ────────────────
// Catches rejected Promises that have NO .catch() handler anywhere
// (e.g., a database query that fails outside of catchAsync's coverage).
// Without this, Node.js would silently fail or, in future versions, crash hard.
process.on('unhandledRejection', (err) => {
  logger.error(`💥 UNHANDLED REJECTION! Shutting down...`);
  logger.error(`${err.name}: ${err.message}`);
  logger.error(err.stack);

  // Close the server gracefully (finish in-flight requests) before exiting
  server.close(() => {
    process.exit(1);
  });
});

// ── Step 7: Graceful Shutdown on SIGTERM (sent by Render/Railway on redeploy) ──
process.on('SIGTERM', () => {
  logger.info('👋 SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    logger.info('💤 Process terminated.');
  });
});

module.exports = server; // Exported for potential use in integration tests
