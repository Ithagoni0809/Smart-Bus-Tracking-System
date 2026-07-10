/**
 * middleware/errorHandler.js
 * ─────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS:
 *   This is Express's GLOBAL error handler. ANY error thrown or
 *   passed via next(err) anywhere in the app ends up here, FIRST.
 *   It's the single place that decides what error response format
 *   the client receives — so every API error looks consistent.
 *
 * HOW EXPRESS KNOWS THIS IS AN ERROR HANDLER:
 *   Express identifies error-handling middleware by checking if the
 *   function has EXACTLY 4 parameters: (err, req, res, next).
 *   This must be registered LAST in app.js, after all routes.
 *
 * WHY WE TRANSFORM SPECIFIC MONGOOSE/JWT ERRORS:
 *   Mongoose and JWT throw their own error types with cryptic messages
 *   ("E11000 duplicate key error...", "CastError"). We translate these
 *   into clean, user-friendly AppError instances before sending them.
 * ─────────────────────────────────────────────────────────────
 */

const AppError = require('../utils/AppError');
const logger   = require('../utils/logger');

// ── Specific Error Transformers ─────────────────────────────────────────────

// Mongoose "CastError" — happens when an invalid ObjectId is passed
// e.g. GET /api/buses/123invalid → MongoDB can't cast "123invalid" to ObjectId
const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

// MongoDB "E11000 duplicate key" — happens when a unique field already exists
// e.g. registering with an email that's already in the database
const handleDuplicateFieldsDB = (err) => {
  // err.keyValue looks like: { email: "user@example.com" }
  const field = Object.keys(err.keyValue)[0];
  const value = err.keyValue[field];
  const message = `${field} '${value}' is already in use. Please use a different ${field}.`;
  return new AppError(message, 409); // 409 Conflict
};

// Mongoose "ValidationError" — happens when schema validation fails
// e.g. password too short, required field missing
const handleValidationErrorDB = (err) => {
  // err.errors is an object: { fieldName: ValidatorError }
  const messages = Object.values(err.errors).map((el) => el.message);
  const message = `Invalid input data: ${messages.join('. ')}`;
  return new AppError(message, 400);
};

// JWT "JsonWebTokenError" — malformed or tampered token
const handleJWTError = () =>
  new AppError('Invalid authentication token. Please log in again.', 401);

// JWT "TokenExpiredError" — token expired
const handleJWTExpiredError = () =>
  new AppError('Your session has expired. Please log in again.', 401);

// ── Development vs Production Error Responses ──────────────────────────────

// In development: send FULL error details (stack trace, error object) — helps debugging
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    success: false,
    status: err.status,
    message: err.message,
    error: err,
    stack: err.stack,
  });
};

// In production: send MINIMAL details — never leak internals to the client
const sendErrorProd = (err, res) => {
  // Operational errors (errors we created intentionally with AppError): safe to expose
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      status: err.status,
      message: err.message,
    });
  }

  // Programming errors / unknown errors: NEVER expose details to the client
  // Log full details on the server for debugging, but client sees a generic message
  logger.error('💥 UNEXPECTED ERROR (non-operational):', err);
  return res.status(500).json({
    success: false,
    status: 'error',
    message: 'Something went wrong on our end. Please try again later.',
  });
};

// ── Main Error Handler (the actual middleware) ──────────────────────────────
module.exports = (err, req, res, next) => {
  // Default to 500 (Internal Server Error) if no status code was set
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Always log the error server-side (regardless of environment)
  logger.error(`${err.statusCode} — ${err.message} — ${req.method} ${req.originalUrl}`);

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else {
    // Clone the error so we don't mutate the original
    let error = Object.assign(
      Object.create(Object.getPrototypeOf(err)),
      err
    );
    error.message = err.message;

    // Transform known error types into clean AppError instances
    if (error.name === 'CastError')   error = handleCastErrorDB(error);
    if (error.code === 11000)          error = handleDuplicateFieldsDB(error);
    if (error.name === 'ValidationError') error = handleValidationErrorDB(error);
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();

    sendErrorProd(error, res);
  }
};
