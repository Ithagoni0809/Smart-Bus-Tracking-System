/**
 * app.js — Express application setup
 * All middleware and routes are registered here.
 * Kept separate from server.js so tests can import app without starting the HTTP server.
 */

require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const cookieParser = require('cookie-parser');

const { helmetConfig, generalRateLimiter, mongoSanitizeConfig, xssConfig } = require('./middleware/security');
const requestLogger = require('./middleware/requestLogger');
const notFound      = require('./middleware/notFound');
const errorHandler  = require('./middleware/errorHandler');

// Route imports
const authRoutes         = require('./routes/authRoutes');
const busRoutes          = require('./routes/busRoutes');
const routeRoutes        = require('./routes/routeRoutes');
const stopRoutes         = require('./routes/stopRoutes');
const tripRoutes         = require('./routes/tripRoutes');
const adminRoutes        = require('./routes/adminRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const favoriteRoutes     = require('./routes/favoriteRoutes');

const app = express();

// ── Security Middleware ──────────────────────────────────────────────────────
app.use(helmetConfig);
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use('/api', generalRateLimiter);

// ── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use((req, res, next) => {
  console.log("Method:", req.method);
  console.log("URL:", req.originalUrl);
  console.log("Headers:", req.headers["content-type"]);
  console.log("Body:", req.body);
  next();
});
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// ── Sanitization ──────────────────────────────────────────────────────────────
app.use(mongoSanitizeConfig);
app.use(xssConfig);

// ── Logging ───────────────────────────────────────────────────────────────────
app.use(requestLogger);

// ── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Smart Bus Tracking API is running', timestamp: new Date().toISOString() });
});

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/buses',         busRoutes);
app.use('/api/routes',        routeRoutes);
app.use('/api/stops',         stopRoutes);
app.use('/api/trips',         tripRoutes);
app.use('/api/admin',         adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/favorites',     favoriteRoutes);

// ── Error Handling (must be last) ─────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;
