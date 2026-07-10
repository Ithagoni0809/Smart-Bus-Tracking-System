/**
 * middleware/authMiddleware.js
 * ─────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS:
 *   Protects routes by verifying the JWT sent in the Authorization
 *   header, then attaches the authenticated user to req.user so
 *   every downstream controller knows WHO is making the request.
 *
 * HOW IT WORKS (step by step):
 *   1. Client sends:  Authorization: Bearer <accessToken>
 *   2. We extract the token from that header
 *   3. jwt.verify() checks the signature + expiry
 *   4. If valid, decoded payload = { id, role, iat, exp }
 *   5. We look up the actual user/driver/admin document by id
 *   6. We attach it to req.user so controllers can use req.user._id, etc.
 *   7. next() passes control to the next middleware/controller
 *
 * WHY LOOK UP THE FULL DOCUMENT INSTEAD OF JUST TRUSTING THE TOKEN PAYLOAD?
 *   The token might be valid but the account could have been deactivated
 *   or deleted AFTER the token was issued. We re-verify against the live
 *   database on every request to catch that.
 * ─────────────────────────────────────────────────────────────
 */

const { verifyAccessToken } = require('../utils/jwt');
const catchAsync = require('../utils/catchAsync');
const AppError   = require('../utils/AppError');
const User    = require('../models/User');
const Driver  = require('../models/Driver');
const Admin   = require('../models/Admin');

/**
 * protect — verifies JWT and attaches user to req.user
 * Use on ANY route that requires the user to be logged in,
 * regardless of role.
 */
exports.protect = catchAsync(async (req, res, next) => {
  let token;

  // ── 1. Extract token from Authorization header ───────────────────────────
  // Expected format: "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1]; // Split "Bearer <token>" → take index 1
  }

  if (!token) {
    return next(new AppError('You are not logged in. Please log in to access this resource.', 401));
  }

  // ── 2. Verify the token (throws AppError if invalid/expired) ─────────────
  const decoded = verifyAccessToken(token);

  // ── 3. Look up the actual account based on role embedded in token ────────
  // We check all three collections because a single JWT system serves
  // passengers, drivers, AND admins — the role tells us which collection to query.
  let currentAccount;
  if (decoded.role === 'passenger') {
    currentAccount = await User.findById(decoded.id);
  } else if (decoded.role === 'driver') {
    currentAccount = await Driver.findById(decoded.id);
  } else if (decoded.role === 'admin' || decoded.role === 'superadmin') {
    currentAccount = await Admin.findById(decoded.id);
  }

  if (!currentAccount) {
    return next(new AppError('The account belonging to this token no longer exists.', 401));
  }

  if (!currentAccount.isActive) {
    return next(new AppError('Your account has been deactivated. Contact support.', 403));
  }

  // ── 4. Attach to request object for downstream use ───────────────────────
  req.user = currentAccount;
  req.user.role = decoded.role; // Ensure role is always available (admin vs superadmin distinction)

  next(); // Continue to the actual route handler
});

/**
 * restrictTo — role-based access control (RBAC)
 * Use AFTER `protect` on routes that should only be accessible
 * by specific roles.
 *
 * USAGE:
 *   router.post('/buses', protect, restrictTo('admin'), busController.createBus);
 *   router.post('/gps', protect, restrictTo('driver'), gpsController.update);
 *
 * @param  {...string} roles - Allowed roles, e.g. 'admin', 'driver'
 */
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    // req.user.role was set by the `protect` middleware above (must run first)
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError(`Access denied. This action requires one of these roles: ${roles.join(', ')}`, 403)
      );
    }
    next();
  };
};
