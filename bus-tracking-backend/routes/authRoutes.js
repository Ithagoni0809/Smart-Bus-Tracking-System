/**
 * routes/authRoutes.js
 * ─────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS:
 *   Defines the URL paths for all authentication endpoints and
 *   wires together, in order, for each route:
 *     1. Rate limiting (only on sensitive routes)
 *     2. Validation rules (express-validator chains)
 *     3. validateRequest (checks validation results, rejects bad input)
 *     4. protect (JWT check, only on routes requiring login)
 *     5. The actual controller function
 *
 *   This file contains almost NO logic itself — it's a wiring diagram.
 *   All the logic lives in controllers/authController.js.
 *
 * BASE PATH:
 *   This router is mounted at /api/auth in app.js, so:
 *   router.post('/login') → actual URL is POST /api/auth/login
 * ─────────────────────────────────────────────────────────────
 */

const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { authRateLimiter } = require('../middleware/security');
const validateRequest = require('../middleware/validateRequest');

const {
  registerValidationRules,
  loginValidationRules,
  forgotPasswordValidationRules,
  resetPasswordValidationRules,
  changePasswordValidationRules,
} = require('../validators/authValidator');


// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC ROUTES (no login required)
// ═══════════════════════════════════════════════════════════════════════════

// POST /api/auth/register — create a new passenger account
router.post(
  '/register',
  authRateLimiter,             // Strict rate limit: prevents bot mass-registration
  registerValidationRules,     // Validates name, email, phone, password format
  validateRequest,             // Rejects request if any validation rule failed
  authController.register
);

// POST /api/auth/login — authenticate and receive tokens
router.post(
  '/login',
  authRateLimiter,             // Strict rate limit: prevents brute-force password guessing
  loginValidationRules,
  validateRequest,
  authController.login
);

// POST /api/auth/refresh-token — get a new access token using refresh cookie
router.post(
  '/refresh-token',
  authController.refreshToken
);

// GET /api/auth/verify-email/:token — confirm email address from emailed link
router.get(
  '/verify-email/:token',
  authController.verifyEmail
);

// POST /api/auth/forgot-password — request a password reset email
router.post(
  '/forgot-password',
  authRateLimiter,             // Strict rate limit: prevents email-bombing a victim's inbox
  forgotPasswordValidationRules,
  validateRequest,
  authController.forgotPassword
);

// PATCH /api/auth/reset-password/:token — set new password from emailed link
router.patch(
  '/reset-password/:token',
  resetPasswordValidationRules,
  validateRequest,
  authController.resetPassword
);


// ═══════════════════════════════════════════════════════════════════════════
// PRIVATE ROUTES (require valid JWT — `protect` runs first)
// ═══════════════════════════════════════════════════════════════════════════

// POST /api/auth/logout — clear refresh token cookie
router.post(
  '/logout',
  protect,
  authController.logout
);

// GET /api/auth/me — get currently logged-in user's profile
router.get(
  '/me',
  protect,
  authController.getMe
);

// POST /api/auth/resend-verification — resend email verification link
router.post(
  '/resend-verification',
  protect,
  authController.resendVerificationEmail
);

// PATCH /api/auth/change-password — change password while logged in
router.patch(
  '/change-password',
  protect,
  changePasswordValidationRules,
  validateRequest,
  authController.changePassword
);


module.exports = router;
