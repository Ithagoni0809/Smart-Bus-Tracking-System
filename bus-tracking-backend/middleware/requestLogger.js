/**
 * middleware/requestLogger.js
 * ─────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS:
 *   Logs every single HTTP request that hits the server: method,
 *   URL, status code, and response time. This is invaluable for
 *   debugging ("why did this request fail?") and for spotting
 *   abuse patterns (e.g., one IP hammering an endpoint).
 *
 * HOW IT WORKS:
 *   Morgan generates the log LINE format. We pipe that line into
 *   our Winston logger (instead of printing directly to console)
 *   so HTTP logs follow the same timestamped, leveled format as
 *   every other log in the app, and get written to file in production.
 * ─────────────────────────────────────────────────────────────
 */

const morgan = require('morgan');
const logger = require('../utils/logger');

// Custom morgan format: method, url, status, response-time, content-length
// Example output: "GET /api/buses/live 200 45.123 ms - 512"
const morganFormat = ':method :url :status :response-time ms - :res[content-length]';

// Morgan's "stream" option lets us redirect its output anywhere we want.
// Here we redirect it into Winston's "http" log level instead of console.log.
const stream = {
  write: (message) => logger.http(message.trim()),
};

// Skip logging in test environment to keep test output clean
const skip = () => process.env.NODE_ENV === 'test';

module.exports = morgan(morganFormat, { stream, skip });
