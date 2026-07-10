/**
 * routes/routeRoutes.js
 * ─────────────────────────────────────────────────────────────
 * Mounted at /api/routes in app.js.
 *
 * Same rule as busRoutes.js: static paths (/search, /stops/nearest)
 * must be registered BEFORE the dynamic /:id path.
 * ─────────────────────────────────────────────────────────────
 */

const express = require('express');
const router = express.Router();

const routeController = require('../controllers/routeController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const validateRequest = require('../middleware/validateRequest');

const {
  createRouteValidationRules,
  updateRouteValidationRules,
  routeIdParamRule,
  addStopValidationRules,
  removeStopValidationRules,
  searchRouteValidationRules,
  nearestStopValidationRules,
  remainingStopsValidationRules,
} = require('../validators/routeValidator');

router.use(protect);

// ═══════════════════════════════════════════════════════════════════════════
// STATIC PATHS FIRST
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/routes/search?from=X&to=Y  OR  ?q=216
router.get(
  '/search',
  searchRouteValidationRules,
  validateRequest,
  routeController.searchRoutes
);

// GET /api/routes/stops/nearest?lat=..&lng=..&maxDistanceKm=2
router.get(
  '/stops/nearest',
  nearestStopValidationRules,
  validateRequest,
  routeController.findNearestStops
);

// ═══════════════════════════════════════════════════════════════════════════
// COLLECTION ROUTES
// ═══════════════════════════════════════════════════════════════════════════

router
  .route('/')
  .get(routeController.getAllRoutes)
  .post(
    restrictTo('admin', 'superadmin'),
    createRouteValidationRules,
    validateRequest,
    routeController.createRoute
  );

// ═══════════════════════════════════════════════════════════════════════════
// SINGLE ROUTE ROUTES
// ═══════════════════════════════════════════════════════════════════════════

router
  .route('/:id')
  .get(routeIdParamRule, validateRequest, routeController.getRoute)
  .put(
    restrictTo('admin', 'superadmin'),
    updateRouteValidationRules,
    validateRequest,
    routeController.updateRoute
  )
  .delete(
    restrictTo('admin', 'superadmin'),
    routeIdParamRule,
    validateRequest,
    routeController.deleteRoute
  );

// GET /api/routes/:id/remaining-stops?currentSequence=4
router.get(
  '/:id/remaining-stops',
  remainingStopsValidationRules,
  validateRequest,
  routeController.getRemainingStops
);

// POST /api/routes/:id/stops — add a stop (admin only)
router.post(
  '/:id/stops',
  restrictTo('admin', 'superadmin'),
  addStopValidationRules,
  validateRequest,
  routeController.addStop
);

// DELETE /api/routes/:id/stops/:stopId — remove a stop (admin only)
router.delete(
  '/:id/stops/:stopId',
  restrictTo('admin', 'superadmin'),
  removeStopValidationRules,
  validateRequest,
  routeController.removeStop
);

module.exports = router;
