/**
 * validators/busValidator.js
 * ─────────────────────────────────────────────────────────────
 * Validation rules for every Bus Management endpoint.
 * Mirrors the Bus.js schema constraints so bad input is rejected
 * BEFORE it ever reaches Mongoose (faster failure, cleaner errors).
 * ─────────────────────────────────────────────────────────────
 */

const { body, param, query } = require('express-validator');

const BUS_TYPES = ['ordinary', 'express', 'deluxe', 'ac', 'metro-luxury'];
const BUS_STATUSES = ['idle', 'active', 'delayed', 'breakdown', 'maintenance'];

// ── Create Bus ──────────────────────────────────────────────────────────────
exports.createBusValidationRules = [
  body('busNumber')
    .trim()
    .notEmpty().withMessage('Bus number is required')
    .isLength({ min: 3, max: 20 }).withMessage('Bus number must be 3-20 characters'),

  body('vehicleNumber')
    .trim()
    .notEmpty().withMessage('Vehicle registration number is required')
    .matches(/^[A-Z]{2}\d{1,2}[A-Z]{1,2}\d{4}$/i)
    .withMessage('Vehicle number must be a valid RTA format, e.g. TS09EA1234'),

  body('capacity')
    .notEmpty().withMessage('Capacity is required')
    .isInt({ min: 1, max: 100 }).withMessage('Capacity must be between 1 and 100'),

  body('busType')
    .optional()
    .isIn(BUS_TYPES).withMessage(`Bus type must be one of: ${BUS_TYPES.join(', ')}`),

  body('assignedRoute')
    .optional()
    .isMongoId().withMessage('assignedRoute must be a valid Route ID'),

  body('assignedDriver')
    .optional()
    .isMongoId().withMessage('assignedDriver must be a valid Driver ID'),
];

// ── Update Bus ──────────────────────────────────────────────────────────────
exports.updateBusValidationRules = [
  param('id').isMongoId().withMessage('Invalid bus ID'),

  body('busNumber')
    .optional()
    .trim()
    .isLength({ min: 3, max: 20 }).withMessage('Bus number must be 3-20 characters'),

  body('vehicleNumber')
    .optional()
    .trim()
    .matches(/^[A-Z]{2}\d{1,2}[A-Z]{1,2}\d{4}$/i)
    .withMessage('Vehicle number must be a valid RTA format'),

  body('capacity')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Capacity must be between 1 and 100'),

  body('busType')
    .optional()
    .isIn(BUS_TYPES).withMessage(`Bus type must be one of: ${BUS_TYPES.join(', ')}`),

  body('status')
    .optional()
    .isIn(BUS_STATUSES).withMessage(`Status must be one of: ${BUS_STATUSES.join(', ')}`),
];

// ── Delete / Get Single Bus ──────────────────────────────────────────────────
exports.busIdParamRule = [
  param('id').isMongoId().withMessage('Invalid bus ID'),
];

// ── Assign Driver ────────────────────────────────────────────────────────────
exports.assignDriverValidationRules = [
  param('id').isMongoId().withMessage('Invalid bus ID'),
  body('driverId').isMongoId().withMessage('A valid driverId is required'),
];

// ── Assign Route ─────────────────────────────────────────────────────────────
exports.assignRouteValidationRules = [
  param('id').isMongoId().withMessage('Invalid bus ID'),
  body('routeId').isMongoId().withMessage('A valid routeId is required'),
];

// ── Search Buses ──────────────────────────────────────────────────────────────
exports.searchBusValidationRules = [
  query('q')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 }).withMessage('Search query must be 1-50 characters'),

  query('status')
    .optional()
    .isIn(BUS_STATUSES).withMessage(`Status must be one of: ${BUS_STATUSES.join(', ')}`),

  query('routeId')
    .optional()
    .isMongoId().withMessage('routeId must be a valid Mongo ID'),

  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
];
