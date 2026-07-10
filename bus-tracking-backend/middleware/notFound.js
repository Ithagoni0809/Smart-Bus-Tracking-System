/**
 * middleware/notFound.js
 * ─────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS:
 *   Express, by default, sends an ugly HTML error page when no
 *   route matches the request URL. This middleware intercepts
 *   that case and creates a clean, JSON-formatted 404 AppError,
 *   which then flows into our global errorHandler.js for a
 *   consistent response format.
 *
 * WHERE THIS IS REGISTERED:
 *   In app.js, AFTER all real routes but BEFORE the error handler.
 *   If a request reaches this point, it means no route matched.
 * ─────────────────────────────────────────────────────────────
 */

const AppError = require('../utils/AppError');

module.exports = (req, res, next) => {
  // Pass a 404 AppError to the global error handler via next()
  next(new AppError(`Cannot find ${req.originalUrl} on this server.`, 404));
};
