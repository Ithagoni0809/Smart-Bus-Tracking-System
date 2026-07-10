// routes/notificationRoutes.js
const express = require('express');
const router  = express.Router();
const nc      = require('../controllers/notificationController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/',                nc.getMyNotifications);
router.patch('/read-all',      nc.markAllAsRead);
router.patch('/:id/read',      nc.markAsRead);
router.delete('/:id',          nc.deleteNotification);
router.post('/',               restrictTo('admin', 'superadmin'), nc.createNotification);

module.exports = router;
