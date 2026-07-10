/**
 * controllers/authController.js
 * ─────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS:
 *   Contains the business logic for every authentication action:
 *   register, login, logout, refresh token, forgot password,
 *   reset password, verify email, and change password.
 *
 *   Controllers are the "C" in MVC: they receive a parsed/validated
 *   request, talk to the Model layer, and send a Response.
 *   They contain NO direct database schema logic (that's in models/)
 *   and NO route-matching logic (that's in routes/).
 *
 * NOTE ON SCOPE:
 *   This controller handles PASSENGER (User) authentication.
 *   Driver and Admin login follow the identical pattern but query
 *   the Driver/Admin models instead — see the "role-aware login"
 *   note inside the login function below for how one endpoint
 *   could be extended to support all three, or kept separate.
 * ─────────────────────────────────────────────────────────────
 */

const crypto = require('crypto');
const User   = require('../models/User');
const Driver = require('../models/Driver');
const Admin  = require('../models/Admin');

const catchAsync = require('../utils/catchAsync');
const AppError   = require('../utils/AppError');
const sendEmail  = require('../utils/email');
const logger     = require('../utils/logger');
const {
  generateAccessToken,
  verifyRefreshToken,
  sendTokenResponse,
} = require('../utils/jwt');


// ═══════════════════════════════════════════════════════════════════════════
// REGISTER
// ═══════════════════════════════════════════════════════════════════════════
/**
 * @route   POST /api/auth/register
 * @access  Public
 * @desc    Creates a new passenger account, sends a verification email,
 *          and logs the user in immediately (issues tokens).
 *
 * FLOW:
 *   1. Validation already ran in middleware (registerValidationRules) — by the
 *      time we get here, req.body is guaranteed well-formed.
 *   2. Check if email is already registered (Mongoose unique index would
 *      also catch this, but checking first gives a cleaner error message).
 *   3. Create the user — the User model's pre-save hook auto-hashes the password.
 *   4. Generate an email verification token (raw token emailed, hash stored).
 *   5. Attempt to send the verification email. If email sending fails,
 *      we DON'T block registration — log it and let user request resend later.
 *   6. Send back access token + refresh token cookie so user is logged in
 *      immediately (common UX pattern: verify-later, not verify-to-use).
 */
exports.register = catchAsync(async (req, res, next) => {
  console.log("BODY RECEIVED:", req.body);

  const { name, email, phone, password } = req.body;

  // ── Step 1: Check for existing account ────────────────────────────────────
  const existingUser = await User.findOne({ email });
  console.log("Email searched:", email);
  console.log("Existing User:", existingUser);
  if (existingUser) {
    return next(new AppError('An account with this email already exists. Please log in instead.', 409));
  }

  // ── Step 2: Create the user document ──────────────────────────────────────
  // Note: we do NOT pass confirmPassword to the model — it was only needed
  // for validation, not for storage.
  const newUser = await User.create({ name, email, phone, password });

  // ── Step 3: Generate email verification token ─────────────────────────────
  const rawVerificationToken = newUser.createEmailVerificationToken();
  // createEmailVerificationToken() set fields on newUser in memory but did NOT
  // save them to the database yet — we must save explicitly:
  await newUser.save({ validateBeforeSave: false });
  // validateBeforeSave: false skips re-running full schema validation
  // (e.g., password minlength) since we're only updating token fields here.

  // ── Step 4: Send verification email (non-blocking on failure) ─────────────
  if (process.env.NODE_ENV !== 'test') {
  try {
    await sendEmail({
      to: newUser.email,
      template: 'verification',
      templateData: [newUser.name, verificationUrl],
    });
  } catch (emailError) {
    logger.error(
      `Failed to send verification email to ${newUser.email}: ${emailError.message}`
    );
  }
}

  // ── Step 5: Log the user in immediately ────────────────────────────────────
  logger.info(`✅ New passenger registered: ${newUser.email}`);
  sendTokenResponse(newUser, 201, res);
});


// ═══════════════════════════════════════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════════════════════════════════════
/**
 * @route   POST /api/auth/login
 * @access  Public
 * @desc    Authenticates a passenger and issues tokens.
 *
 * SECURITY NOTE ON ERROR MESSAGES:
 *   We deliberately use the SAME error message ("Invalid email or password")
 *   whether the EMAIL doesn't exist OR the PASSWORD is wrong. If we said
 *   "Email not found" vs "Wrong password" separately, an attacker could use
 *   that to discover which emails are registered (user enumeration attack).
 *
 * ROLE-AWARE LOGIN (architecture note):
 *   This function logs in PASSENGERS via the User model. Driver and Admin
 *   login use the identical bcrypt-compare + token pattern but query their
 *   own models (see driverAuthController / adminAuthController for the
 *   parallel implementations — same logic, different collection).
 */
exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // ── Step 1: Find user and explicitly include the password field ──────────
  // Remember: password has `select: false` in the schema, so we must
  // opt back in with .select('+password') to get it for comparison.
  const user = await User.findOne({ email }).select('+password');

  // ── Step 2: Verify user exists AND password matches ───────────────────────
  // We check both conditions in one place to keep timing consistent
  // (prevents timing attacks that could reveal whether the email exists).
  if (!user || !(await user.comparePassword(password))) {
    return next(new AppError('Invalid email or password.', 401));
  }

  // ── Step 3: Check account is active ────────────────────────────────────────
  if (!user.isActive) {
    return next(new AppError('Your account has been deactivated. Please contact support.', 403));
  }

  // ── Step 4: Update last login timestamp ────────────────────────────────────
  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  // ── Step 5: Issue tokens ────────────────────────────────────────────────────
  logger.info(`🔓 User logged in: ${user.email}`);
  sendTokenResponse(user, 200, res);
});


// ═══════════════════════════════════════════════════════════════════════════
// LOGOUT
// ═══════════════════════════════════════════════════════════════════════════
/**
 * @route   POST /api/auth/logout
 * @access  Private (any authenticated role)
 * @desc    Clears the refresh token cookie. Since JWTs are stateless,
 *          there's nothing to delete server-side — logout simply means
 *          "stop sending this token." Clearing the httpOnly cookie
 *          prevents the browser from automatically resending it.
 *
 * NOTE: The access token itself can't be "revoked" without a token
 *       blocklist (extra DB lookup on every request — a v2.0 feature).
 *       For this project, the access token simply expires naturally
 *       within 24 hours, which is an acceptable trade-off.
 */
exports.logout = (req, res) => {
  res.cookie('refreshToken', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000), // Expires in 10 seconds
    httpOnly: true,
  });

  res.status(200).json({
    success: true,
    message: 'Logged out successfully.',
  });
};


// ═══════════════════════════════════════════════════════════════════════════
// REFRESH ACCESS TOKEN
// ═══════════════════════════════════════════════════════════════════════════
/**
 * @route   POST /api/auth/refresh-token
 * @access  Public (but requires valid refresh token cookie)
 * @desc    Issues a new short-lived access token using the long-lived
 *          refresh token stored in an httpOnly cookie. This lets the
 *          frontend silently re-authenticate the user without forcing
 *          them to log in again every 24 hours.
 *
 * FLOW:
 *   1. Frontend's access token expires (or is about to).
 *   2. Frontend calls POST /api/auth/refresh-token (cookie sent automatically).
 *   3. We verify the refresh token is valid and not expired.
 *   4. We look up the user to confirm the account still exists/is active.
 *   5. We issue a BRAND NEW access token (NOT a new refresh token —
 *      refresh token rotation is a v2.0 enhancement).
 */
exports.refreshToken = catchAsync(async (req, res, next) => {
  // ── Step 1: Extract refresh token from httpOnly cookie ────────────────────
  const token = req.cookies.refreshToken;

  if (!token) {
    return next(new AppError('No refresh token provided. Please log in again.', 401));
  }

  // ── Step 2: Verify the refresh token ───────────────────────────────────────
  const decoded = verifyRefreshToken(token); // throws AppError if invalid/expired

  // ── Step 3: Confirm the user still exists and is active ───────────────────
  const user = await User.findById(decoded.id);
  if (!user || !user.isActive) {
    return next(new AppError('Account no longer valid. Please log in again.', 401));
  }

  // ── Step 4: Issue a fresh access token ─────────────────────────────────────
  const newAccessToken = generateAccessToken(user._id, 'passenger');

  res.status(200).json({
    success: true,
    accessToken: newAccessToken,
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// GET CURRENT USER
// ═══════════════════════════════════════════════════════════════════════════
/**
 * @route   GET /api/auth/me
 * @access  Private
 * @desc    Returns the currently authenticated user's profile.
 *          req.user was already populated by the `protect` middleware,
 *          so this is just a clean pass-through response.
 */
exports.getMe = catchAsync(async (req, res, next) => {
  res.status(200).json({
    success: true,
    user: req.user,
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// VERIFY EMAIL
// ═══════════════════════════════════════════════════════════════════════════
/**
 * @route   GET /api/auth/verify-email/:token
 * @access  Public
 * @desc    Confirms a user's email address using the token sent in the
 *          verification email.
 *
 * HOW THE TOKEN MATCHING WORKS:
 *   The URL contains the RAW token (e.g., from req.params.token).
 *   We hash it the SAME way we did when creating it (SHA-256), then
 *   search for a user whose STORED hash matches. This way the raw
 *   token is never stored in the database — only its hash.
 */
exports.verifyEmail = catchAsync(async (req, res, next) => {
  // ── Step 1: Hash the incoming raw token to match stored format ────────────
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  // ── Step 2: Find a user with this hash AND a non-expired token ────────────
  const user = await User.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpires: { $gt: Date.now() }, // $gt = greater than NOW = not expired
  });

  if (!user) {
    return next(new AppError('Verification link is invalid or has expired. Please request a new one.', 400));
  }

  // ── Step 3: Mark email as verified and clear the token fields ─────────────
  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save({ validateBeforeSave: false });

  logger.info(`✅ Email verified: ${user.email}`);

  res.status(200).json({
    success: true,
    message: 'Email verified successfully! You can now use all features.',
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// RESEND VERIFICATION EMAIL
// ═══════════════════════════════════════════════════════════════════════════
/**
 * @route   POST /api/auth/resend-verification
 * @access  Private
 * @desc    Generates a NEW verification token and resends the email.
 *          Useful if the original email expired (24h) or was lost.
 */
exports.resendVerificationEmail = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id);

  if (user.isEmailVerified) {
    return next(new AppError('This email is already verified.', 400));
  }

  const rawVerificationToken = user.createEmailVerificationToken();
  await user.save({ validateBeforeSave: false });

  const verificationUrl = `${process.env.CLIENT_URL}/verify-email/${rawVerificationToken}`;

  await sendEmail({
    to: user.email,
    template: 'verification',
    templateData: [user.name, verificationUrl],
  });

  res.status(200).json({
    success: true,
    message: 'Verification email resent. Please check your inbox.',
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// FORGOT PASSWORD
// ═══════════════════════════════════════════════════════════════════════════
/**
 * @route   POST /api/auth/forgot-password
 * @access  Public
 * @desc    Sends a password reset link to the user's email.
 *
 * SECURITY NOTE:
 *   We ALWAYS return the same success message, whether or not the email
 *   exists in our database. This prevents attackers from using this
 *   endpoint to discover which emails are registered (enumeration attack).
 */
exports.forgotPassword = catchAsync(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email });

  // Always respond with the same generic message — don't reveal if email exists
  const genericResponse = {
    success: true,
    message: 'If an account with that email exists, a password reset link has been sent.',
  };

  if (!user) {
    // Don't tell the client the email wasn't found — just return generic success
    return res.status(200).json(genericResponse);
  }

  // ── Generate reset token ────────────────────────────────────────────────────
  const rawResetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  const resetUrl = `${process.env.CLIENT_URL}/reset-password/${rawResetToken}`;

  try {
    await sendEmail({
      to: user.email,
      template: 'passwordReset',
      templateData: [user.name, resetUrl],
    });

    logger.info(`📧 Password reset email sent: ${user.email}`);
    res.status(200).json(genericResponse);

  } catch (emailError) {
    // CRITICAL: if email fails to send, we MUST clear the reset token.
    // Otherwise the token sits in the database with no way for the user
    // to ever receive it — effectively a dead-end, wasted token.
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    logger.error(`Failed to send password reset email: ${emailError.message}`);
    return next(new AppError('Error sending password reset email. Please try again later.', 500));
  }
});


// ═══════════════════════════════════════════════════════════════════════════
// RESET PASSWORD
// ═══════════════════════════════════════════════════════════════════════════
/**
 * @route   PATCH /api/auth/reset-password/:token
 * @access  Public
 * @desc    Sets a new password using a valid (non-expired) reset token.
 *          Logs the user in immediately afterward (issues fresh tokens).
 */
exports.resetPassword = catchAsync(async (req, res, next) => {
  // ── Step 1: Hash incoming token to match stored format ────────────────────
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  // ── Step 2: Find user with matching, non-expired token ────────────────────
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  if (!user) {
    return next(new AppError('Password reset link is invalid or has expired. Please request a new one.', 400));
  }

  // ── Step 3: Set new password (pre-save hook will auto-hash it) ────────────
  user.password = req.body.password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save(); // Full validation runs here since password IS being modified

  logger.info(`🔐 Password reset completed: ${user.email}`);

  // ── Step 4: Notify user via email that their password changed ─────────────
  try {
    await sendEmail({
      to: user.email,
      template: 'passwordChanged',
      templateData: [user.name],
    });
  } catch (emailError) {
    // Non-critical — don't block the response if this notification fails
    logger.error(`Failed to send password-changed notification: ${emailError.message}`);
  }

  // ── Step 5: Log the user in immediately with fresh tokens ──────────────────
  sendTokenResponse(user, 200, res);
});


// ═══════════════════════════════════════════════════════════════════════════
// CHANGE PASSWORD (while logged in)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * @route   PATCH /api/auth/change-password
 * @access  Private
 * @desc    Allows a logged-in user to change their password by providing
 *          their CURRENT password (proves it's really them, not just
 *          someone who stole an active session) and a new password.
 */
exports.changePassword = catchAsync(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  // ── Step 1: Get user WITH password field included ─────────────────────────
  const user = await User.findById(req.user._id).select('+password');

  // ── Step 2: Verify current password is correct ────────────────────────────
  if (!(await user.comparePassword(currentPassword))) {
    return next(new AppError('Current password is incorrect.', 401));
  }

  // ── Step 3: Set new password ────────────────────────────────────────────────
  user.password = newPassword; // pre-save hook auto-hashes this
  await user.save();

  logger.info(`🔐 Password changed by user: ${user.email}`);

  // ── Step 4: Issue fresh tokens (force re-login on other devices conceptually) ──
  sendTokenResponse(user, 200, res);
});
