/**
 * utils/jwt.js
 * ─────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS:
 *   JWT logic (signing + verifying) is used in both authController.js
 *   and authMiddleware.js. Centralizing it here avoids duplication
 *   and makes it easy to change the algorithm or secrets in one place.
 *
 * TOKEN STRATEGY:
 *   Access Token  — short-lived (24h). Sent with every API request.
 *   Refresh Token — long-lived (30d). Used ONLY to get a new access token.
 *
 *   This means if an access token is stolen, it only works for 24 hours.
 *   The refresh token is stored in an httpOnly cookie (not readable by JS).
 * ─────────────────────────────────────────────────────────────
 */

const jwt = require('jsonwebtoken');
const AppError = require('./AppError');

/**
 * generateAccessToken — creates a short-lived access token
 * @param {string} userId - MongoDB _id of the user/driver
 * @param {string} role - 'passenger' | 'driver' | 'admin'
 * @returns {string} Signed JWT string
 */
const generateAccessToken = (userId, role) => {
  return jwt.sign(
    // PAYLOAD: data embedded in the token (visible to anyone who decodes it)
    { id: userId, role },
    // SECRET: used to sign and verify the token
    process.env.JWT_ACCESS_SECRET,
    // OPTIONS
    { expiresIn: process.env.JWT_ACCESS_EXPIRE } // e.g., '24h'
  );
};

/**
 * generateRefreshToken — creates a long-lived refresh token
 * @param {string} userId - MongoDB _id of the user/driver
 * @returns {string} Signed JWT string
 */
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE } // e.g., '30d'
  );
};

/**
 * verifyAccessToken — decodes and validates an access token
 * @param {string} token - The JWT string to verify
 * @returns {Object} Decoded payload { id, role, iat, exp }
 * @throws {AppError} If token is invalid or expired
 */
const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AppError('Your session has expired. Please log in again.', 401);
    }
    if (error.name === 'JsonWebTokenError') {
      throw new AppError('Invalid authentication token. Please log in again.', 401);
    }
    throw new AppError('Authentication failed.', 401);
  }
};

/**
 * verifyRefreshToken — decodes and validates a refresh token
 * @param {string} token - The refresh JWT string to verify
 * @returns {Object} Decoded payload { id, iat, exp }
 * @throws {AppError} If token is invalid or expired
 */
const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AppError('Refresh token expired. Please log in again.', 401);
    }
    throw new AppError('Invalid refresh token. Please log in again.', 401);
  }
};

/**
 * sendTokenResponse — creates tokens, sets refresh token cookie, returns JSON
 * Called after login and register to send tokens to client.
 *
 * @param {Object} user - The Mongoose user document
 * @param {number} statusCode - HTTP status code (200 or 201)
 * @param {Object} res - Express response object
 */
const sendTokenResponse = (user, statusCode, res) => {
  // 1. Generate both tokens
  const accessToken  = generateAccessToken(user._id, user.role);
  const refreshToken = generateRefreshToken(user._id);

  // 2. Cookie options for the refresh token
  const cookieOptions = {
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    httpOnly: true,   // ← CRITICAL: cannot be read by JavaScript (prevents XSS theft)
    sameSite: 'strict', // Prevents CSRF attacks
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
  };

  // 3. Set the refresh token in an httpOnly cookie
  res.cookie('refreshToken', refreshToken, cookieOptions);

  // 4. Remove sensitive fields before sending user object
  user.password = undefined;
  user.emailVerificationToken = undefined;
  user.passwordResetToken = undefined;

  // 5. Send response with access token in body
  res.status(statusCode).json({
    success: true,
    accessToken, // ← Client stores this in memory (NOT localStorage)
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      phone: user.phone,
    },
  });
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  sendTokenResponse,
};
