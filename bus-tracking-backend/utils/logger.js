/**
 * utils/logger.js
 * ─────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS:
 *   console.log() has no timestamps, no log levels, and doesn't
 *   write to files. Winston gives us structured, levelled logging
 *   that writes to the console during development and to rotating
 *   log files in production.
 *
 * LOG LEVELS (most → least severe):
 *   error   → system crashes, uncaught exceptions
 *   warn    → something bad that didn't crash the app
 *   info    → normal operational messages (server started, db connected)
 *   http    → one line per HTTP request (method, URL, status, response time)
 *   debug   → detailed debug info (only shown in development)
 * ─────────────────────────────────────────────────────────────
 */

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// ── Custom Log Format ───────────────────────────────────────────────────────
// Defines how each log line looks when printed
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), // Add timestamp
  winston.format.errors({ stack: true }),                         // Include stack trace for errors
  winston.format.printf(({ level, message, timestamp, stack }) => {
    // stack is available when we log an Error object
    return stack
      ? `[${timestamp}] ${level.toUpperCase()}: ${message}\n${stack}`
      : `[${timestamp}] ${level.toUpperCase()}: ${message}`;
  })
);

// ── Console Format (Colorized for readability) ──────────────────────────────
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }), // Colors: red for error, yellow for warn, etc.
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp }) => {
    return `[${timestamp}] ${level}: ${message}`;
  })
);

// ── Transports (where logs are written) ────────────────────────────────────
const transports = [];

// 1. Always write to console
transports.push(
  new winston.transports.Console({
    format: consoleFormat,
    // In test environment, suppress console logs to keep test output clean
    silent: process.env.NODE_ENV === 'test',
  })
);

// 2. In production, also write to rotating log files
if (process.env.NODE_ENV === 'production') {
  // Error-only log file — only errors are written here
  transports.push(
    new DailyRotateFile({
      filename: path.join(__dirname, '../logs/error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      format: logFormat,
      maxFiles: '30d', // Keep 30 days of error logs
    })
  );

  // Combined log file — all levels (info, warn, error)
  transports.push(
    new DailyRotateFile({
      filename: path.join(__dirname, '../logs/combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      format: logFormat,
      maxFiles: '14d', // Keep 14 days of combined logs
    })
  );
}

// ── Custom Levels ────────────────────────────────────────────────────────────
// Winston's default levels don't include 'http'. We add it between 'info' and 'verbose'
// so morgan's request logs (via requestLogger.js) have their own dedicated level.
const customLevels = {
  levels: { error: 0, warn: 1, info: 2, http: 3, debug: 4 },
  colors: { error: 'red', warn: 'yellow', info: 'green', http: 'magenta', debug: 'blue' },
};
winston.addColors(customLevels.colors);

// ── Create Logger Instance ──────────────────────────────────────────────────
const logger = winston.createLogger({
  levels: customLevels.levels,
  // The minimum level to log. 'debug' in dev means everything. 'warn' in prod means only warn + error.
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'warn',
  format: logFormat,
  transports,
});

module.exports = logger;
