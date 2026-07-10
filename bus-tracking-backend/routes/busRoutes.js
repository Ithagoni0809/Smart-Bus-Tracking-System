/**
 * routes/busRoutes.js
 * ─────────────────────────────────────────────────────────────
 * Mounted at /api/buses in app.js.
 *
 * ROUTE ORDER MATTERS in Express: more specific static paths
 * (/search, /live) MUST be registered BEFORE the dynamic /:id
 * path. Otherwise Express would interpret "search" or "live" as
 * an :id value and try to look up a bus with that literal string,
 * which fails the isMongoId() validation and returns a confusing
 * 400 error instead of running the intended controller.
 * ─────────────────────────────────────────────────────────────
 */

const express = require('express');
const router = express.Router();

const busController = require('../controllers/busController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const validateRequest = require('../middleware/validateRequest');

const {
  createBusValidationRules,
  updateBusValidationRules,
  busIdParamRule,
  assignDriverValidationRules,
  assignRouteValidationRules,
  searchBusValidationRules,
} = require('../validators/busValidator');

// Every bus route requires the user to be logged in
router.use(protect);

// ═══════════════════════════════════════════════════════════════════════════
// STATIC PATHS FIRST (search, live) — must come before /:id
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/buses/search — flexible search by bus/vehicle number, status, route
router.get(
  '/search',
  searchBusValidationRules,
  validateRequest,
  busController.searchBuses
);

// GET /api/buses/live — only currently active buses with GPS, for the live map
router.get(
  '/live',
  busController.getLiveBuses
);

// ═══════════════════════════════════════════════════════════════════════════
// COLLECTION ROUTES
// ═══════════════════════════════════════════════════════════════════════════

router
  .route('/')
  // GET /api/buses — paginated list (any logged-in user, mainly admin UI)
  .get(busController.getAllBuses)
  // POST /api/buses — add a new bus (admin only)
  .post(
    restrictTo('admin', 'superadmin'),
    createBusValidationRules,
    validateRequest,
    busController.createBus
  );

// ═══════════════════════════════════════════════════════════════════════════
// SINGLE BUS ROUTES (dynamic /:id — must come AFTER /search and /live)
// ═══════════════════════════════════════════════════════════════════════════

router
  .route('/:id')
  // GET /api/buses/:id — full bus details (any logged-in user)
  .get(busIdParamRule, validateRequest, busController.getBus)
  // PUT /api/buses/:id — update bus fields (admin only)
  .put(
    restrictTo('admin', 'superadmin'),
    updateBusValidationRules,
    validateRequest,
    busController.updateBus
  )
  // DELETE /api/buses/:id — remove a bus (admin only)
  .delete(
    restrictTo('admin', 'superadmin'),
    busIdParamRule,
    validateRequest,
    busController.deleteBus
  );

// PATCH /api/buses/:id/assign-driver — assign a driver to this bus (admin only)
router.patch(
  '/:id/assign-driver',
  restrictTo('admin', 'superadmin'),
  assignDriverValidationRules,
  validateRequest,
  busController.assignDriver
);

// PATCH /api/buses/:id/assign-route — assign a route to this bus (admin only)
router.patch(
  '/:id/assign-route',
  restrictTo('admin', 'superadmin'),
  assignRouteValidationRules,
  validateRequest,
  busController.assignRoute
);

module.exports = router;
