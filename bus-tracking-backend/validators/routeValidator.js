/**
 * validators/routeValidator.js
 * ─────────────────────────────────────────────────────────────
 * Validation rules for Route Management endpoints.
 * ─────────────────────────────────────────────────────────────
 */

const { body, param, query } = require('express-validator');

// ── Create Route ─────────────────────────────────────────────────────────────
exports.createRouteValidationRules = [
  body('routeNumber')
    .trim()
    .notEmpty().withMessage('Route number is required')
    .isLength({ min: 1, max: 10 }).withMessage('Route number must be 1-10 characters'),

  body('routeName')
    .trim()
    .notEmpty().withMessage('Route name is required'),

  body('source')
    .trim()
    .notEmpty().withMessage('Source location is required'),

  body('destination')
    .trim()
    .notEmpty().withMessage('Destination location is required'),

  body('stops')
    .isArray({ min: 2 }).withMessage('A route must have at least 2 stops (source and destination)'),

  body('stops.*.stop')
    .isMongoId().withMessage('Each stop entry must reference a valid Stop ID'),

  body('stops.*.sequence')
    .isInt({ min: 1 }).withMessage('Each stop must have a sequence number ≥ 1'),

  body('fare')
    .notEmpty().withMessage('Fare is required')
    .isFloat({ min: 0 }).withMessage('Fare cannot be negative'),

  body('routeType')
    .optional()
    .isIn(['city', 'intercity', 'express', 'metro-feeder']).withMessage('Invalid route type'),
];

// ── Update Route ─────────────────────────────────────────────────────────────
exports.updateRouteValidationRules = [
  param('id').isMongoId().withMessage('Invalid route ID'),

  body('routeName').optional().trim().notEmpty().withMessage('Route name cannot be empty'),
  body('fare').optional().isFloat({ min: 0 }).withMessage('Fare cannot be negative'),
  body('isActive').optional().isBoolean().withMessage('isActive must be true or false'),
];

// ── Route ID Param ───────────────────────────────────────────────────────────
exports.routeIdParamRule = [
  param('id').isMongoId().withMessage('Invalid route ID'),
];

// ── Add Stop to Route ─────────────────────────────────────────────────────────
exports.addStopValidationRules = [
  param('id').isMongoId().withMessage('Invalid route ID'),
  body('stopId').isMongoId().withMessage('A valid stopId is required'),
  body('sequence').isInt({ min: 1 }).withMessage('Sequence must be a positive integer'),
  body('expectedTimeFromStart').isFloat({ min: 0 }).withMessage('expectedTimeFromStart must be ≥ 0'),
  body('distanceFromStart').isFloat({ min: 0 }).withMessage('distanceFromStart must be ≥ 0'),
];

// ── Remove Stop from Route ────────────────────────────────────────────────────
exports.removeStopValidationRules = [
  param('id').isMongoId().withMessage('Invalid route ID'),
  param('stopId').isMongoId().withMessage('Invalid stop ID'),
];

// ── Search Routes (by source/destination) ─────────────────────────────────────
exports.searchRouteValidationRules = [
  query('from').optional().trim().isLength({ min: 1 }).withMessage('from cannot be empty'),
  query('to').optional().trim().isLength({ min: 1 }).withMessage('to cannot be empty'),
  query('q').optional().trim().isLength({ min: 1, max: 50 }).withMessage('Search query must be 1-50 characters'),
];

// ── Nearest Stop Search ────────────────────────────────────────────────────────
exports.nearestStopValidationRules = [
  query('lat')
    .notEmpty().withMessage('lat is required')
    .isFloat({ min: -90, max: 90 }).withMessage('lat must be between -90 and 90'),
  query('lng')
    .notEmpty().withMessage('lng is required')
    .isFloat({ min: -180, max: 180 }).withMessage('lng must be between -180 and 180'),
  query('maxDistanceKm')
    .optional()
    .isFloat({ min: 0.1, max: 50 }).withMessage('maxDistanceKm must be between 0.1 and 50'),
];

// ── Remaining Stops Calculation ────────────────────────────────────────────────
exports.remainingStopsValidationRules = [
  param('id').isMongoId().withMessage('Invalid route ID'),
  query('currentSequence')
    .notEmpty().withMessage('currentSequence is required')
    .isInt({ min: 0 }).withMessage('currentSequence must be a non-negative integer'),
];
