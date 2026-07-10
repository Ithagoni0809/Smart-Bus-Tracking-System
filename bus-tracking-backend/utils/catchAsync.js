/**
 * utils/catchAsync.js
 * ─────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS:
 *   Every async controller function needs a try-catch block.
 *   Without this utility, every function would look like:
 *
 *     exports.login = async (req, res, next) => {
 *       try {
 *         // ... actual code
 *       } catch (err) {
 *         next(err); // pass to global error handler
 *       }
 *     };
 *
 *   That's a LOT of repeated try-catch blocks.
 *   catchAsync wraps any async function and auto-catches errors,
 *   passing them to next() → global error handler automatically.
 *
 * HOW IT WORKS:
 *   catchAsync returns a NEW function that Express calls.
 *   That new function calls `fn` and if `fn` rejects (throws),
 *   the `.catch(next)` sends the error to Express error handler.
 *
 * USAGE:
 *   exports.login = catchAsync(async (req, res, next) => {
 *     // No try-catch needed! Errors auto-go to error handler.
 *     const user = await User.findOne({ email: req.body.email });
 *   });
 * ─────────────────────────────────────────────────────────────
 */

/**
 * @param {Function} fn - Async controller function
 * @returns {Function} Express middleware that auto-handles promise rejections
 */
const catchAsync = (fn) => {
  return (req, res, next) => {
    // fn(req, res, next) returns a Promise (because fn is async)
    // .catch(next) passes any rejection to Express's error handler
    fn(req, res, next).catch(next);
  };
};

module.exports = catchAsync;
