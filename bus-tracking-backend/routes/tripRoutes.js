/**
 * routes/tripRoutes.js
 * ─────────────────────────────────────────────────────────────
 * Mounted at /api/trips in app.js.
 * ─────────────────────────────────────────────────────────────
 */

const express = require('express');
const router = express.Router();

const tripController = require('../controllers/tripController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const validateRequest = require('../middleware/validateRequest');

const {
  startTripValidationRules,
  endTripValidationRules,
  tripIdParamRule,
} = require('../validators/tripValidator');

router.use(protect);

// GET /api/trips/history — trip history, filterable (any logged-in user)
router.get('/history', tripController.getTripHistory);

// POST /api/trips/start — driver starts a new trip
router.post(
  '/start',
  restrictTo('driver'),
  startTripValidationRules,
  validateRequest,
  tripController.startTrip
);

// PATCH /api/trips/:tripId/end — driver ends their active trip
router.patch(
  '/:tripId/end',
  restrictTo('driver'),
  endTripValidationRules,
  validateRequest,
  tripController.endTrip
);

// GET /api/trips/:tripId — single trip details
router.get(
  '/:tripId',
  tripIdParamRule,
  validateRequest,
  tripController.getTrip
);

module.exports = router;
