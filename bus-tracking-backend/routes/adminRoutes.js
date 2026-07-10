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

module.exports = router;
