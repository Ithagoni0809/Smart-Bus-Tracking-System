/**
 * validators/tripValidator.js
 * ─────────────────────────────────────────────────────────────
 * Validation rules for Trip lifecycle endpoints (start/end trip),
 * which are the entry/exit points for the Live Tracking module.
 * ─────────────────────────────────────────────────────────────
 */

const { body, param } = require('express-validator');

exports.startTripValidationRules = [
  body('busId').isMongoId().withMessage('A valid busId is required'),
];

exports.endTripValidationRules = [
  param('tripId').isMongoId().withMessage('Invalid trip ID'),
  body('latitude').optional().isFloat({ min: -90, max: 90 }),
  body('longitude').optional().isFloat({ min: -180, max: 180 }),
];

exports.tripIdParamRule = [
  param('tripId').isMongoId().withMessage('Invalid trip ID'),
];
