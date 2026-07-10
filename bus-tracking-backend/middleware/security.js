/**
 * middleware/security.js
 * ─────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS:
 *   Bundles all security-related middleware in one place so app.js
 *   stays clean and it's obvious at a glance what protections are
 *   active. Covers: HTTP headers, rate limiting, NoSQL injection
 *   prevention, and XSS sanitization.
 * ─────────────────────────────────────────────────────────────
 */

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');

/**
 * helmetConfig — sets various secure HTTP headers automatically:
 *   - X-Content-Type-Options: nosniff (prevents MIME-sniffing attacks)
 *   - X-Frame-Options: DENY (prevents clickjacking via iframes)
 *   - Strict-Transport-Security (forces HTTPS in browsers, production only)
 *   - X-XSS-Protection, Content-Security-Policy, and more
 */
exports.helmetConfig = helmet({
  // Allow cross-origin requests for map tiles, etc. (default Helmet CSP is very strict)
  crossOriginResourcePolicy: { policy: 'cross-origin' },
});

/**
 * generalRateLimiter — applies to ALL API routes.
 * Default: 100 requests per 15 minutes per IP address.
 * Prevents brute-force attacks and API abuse.
 */
exports.generalRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100, // limit each IP to 100 requests per window
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again after 15 minutes.',
  },
  standardHeaders: true, // Return rate limit info in RateLimit-* headers
  legacyHeaders: false,  // Disable the deprecated X-RateLimit-* headers
});

/**
 * authRateLimiter — STRICTER limit specifically for auth routes
 * (login, register, forgot-password). These are the most targeted
 * endpoints for brute-force and credential-stuffing attacks, so they
 * get a much tighter limit than general API browsing.
 */
exports.authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // only 10 attempts per 15 minutes per IP
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins against the limit
});

/**
 * mongoSanitizeConfig — strips out any keys starting with '$' or
 * containing '.' from req.body, req.query, req.params.
 * WHY: Prevents NoSQL injection attacks like:
 *   { "email": { "$gt": "" }, "password": { "$gt": "" } }
 *   which would otherwise match EVERY user in the database.
 */
exports.mongoSanitizeConfig = mongoSanitize({
  replaceWith: '_', // Replace prohibited characters instead of just stripping them
});

/**
 * xssConfig — sanitizes user input in req.body, req.query, req.params
 * to strip out any embedded <script> tags or malicious HTML, preventing
 * stored/reflected Cross-Site Scripting (XSS) attacks.
 */
exports.xssConfig = xss();
