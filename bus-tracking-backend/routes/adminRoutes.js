// routes/adminRoutes.js
const express = require('express');
const router  = express.Router();
const ac      = require('../controllers/adminController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.use(protect, restrictTo('admin', 'superadmin'));

// Analytics
router.get('/analytics', ac.getAnalytics);

// Driver management
router.get('/drivers',         ac.getAllDrivers);
router.post('/drivers',        ac.createDriver);
router.get('/drivers/:id',     ac.getDriver);
router.put('/drivers/:id',     ac.updateDriver);
router.patch('/drivers/:id/deactivate', ac.deactivateDriver);

// User management
router.get('/users',               ac.getAllUsers);
router.patch('/users/:id/toggle',  ac.toggleUserStatus);

// ── Admin management (superadmin only) ──────────────────────────────────
// Stacking restrictTo('superadmin') on top of the router-wide
// restrictTo('admin','superadmin') further narrows access: a plain
// 'admin' passes the first check but is rejected by the second.
router.get('/admins',                     restrictTo('superadmin'), ac.getAllAdmins);
router.post('/admins',                    restrictTo('superadmin'), ac.createAdmin);
router.patch('/admins/:id/toggle',        restrictTo('superadmin'), ac.toggleAdminStatus);
router.patch('/admins/:id/role',          restrictTo('superadmin'), ac.updateAdminRole);
router.patch('/admins/:id/permissions',   restrictTo('superadmin'), ac.updateAdminPermissions);

module.exports = router;
