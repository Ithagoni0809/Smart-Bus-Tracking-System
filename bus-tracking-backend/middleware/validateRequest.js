/**
 * middleware/validateRequest.js
 * ─────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS:
 *   express-validator's validation rules (in validators/authValidator.js)
 *   only DEFINE the rules — they don't automatically reject bad requests.
 *   This middleware runs AFTER the validation rules and checks if any
 *   rule failed. If so, it formats all errors into one clean response
 *   and stops the request from reaching the controller.
 *
 * USAGE PATTERN (in routes/authRoutes.js):
 *   router.post('/register', registerValidationRules, validateRequest, authController.register);
 *                             ↑ defines rules            ↑ checks results   ↑ only runs if valid
 * ─────────────────────────────────────────────────────────────
 */

const { validationResult } = require('express-validator');
const AppError = require('../utils/AppError');

module.exports = (req, res, next) => {
  // Collect any validation errors accumulated by the previous validation-chain middleware
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    // Format errors into a simple array: [{ field: 'email', message: '...' }]
    const formattedErrors = errors.array().map((err) => ({
      field: err.path,
      message: err.msg,
    }));

    // Build one combined message string for the AppError
    const message = formattedErrors.map((e) => e.message).join('. ');
    const error = new AppError(message, 400);
    error.errors = formattedErrors; // Attach detailed array too, for frontend form highlighting

    return next(error);
  }

  next(); // No validation errors — proceed to the controller
};
