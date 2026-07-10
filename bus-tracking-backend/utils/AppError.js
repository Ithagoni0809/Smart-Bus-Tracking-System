/**
 * utils/AppError.js
 * ─────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS:
 *   Node's built-in Error class has only `message` and `stack`.
 *   We need HTTP status codes and an `isOperational` flag on every
 *   error so our global error handler can format responses correctly.
 *
 *   isOperational = true  → expected error (wrong password, not found)
 *                           → send the message to the client
 *   isOperational = false → unexpected/programming error
 *                           → send generic "something went wrong" to client
 *                           → log full details on the server
 *
 * USAGE IN CONTROLLERS:
 *   throw new AppError('User not found', 404);
 *   throw new AppError('Invalid credentials', 401);
 *   throw new AppError('Email already registered', 409);
 * ─────────────────────────────────────────────────────────────
 */

class AppError extends Error {
  /**
   * @param {string} message - Human-readable error description
   * @param {number} statusCode - HTTP status code (400, 401, 403, 404, 409, 500, etc.)
   */
  constructor(message, statusCode) {
    // Call the parent Error constructor with the message
    // This sets this.message AND this.stack (the stack trace)
    super(message);

    // HTTP status code to send in the response
    this.statusCode = statusCode;

    // status: 'fail' for 4xx client errors, 'error' for 5xx server errors
    // String() converts number to string so startsWith() works
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';

    // Mark as an operational error (expected, intentional error)
    // Our error handler will send this.message to the client only if this is true
    this.isOperational = true;

    // Capture the stack trace, excluding the AppError constructor itself
    // So the stack trace points to where new AppError() was called, not here
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
