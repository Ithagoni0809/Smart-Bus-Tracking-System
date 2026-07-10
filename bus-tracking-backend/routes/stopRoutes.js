// routes/stopRoutes.js
const express = require('express');
const router  = express.Router();
const stopController = require('../controllers/stopController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/nearest', stopController.getNearestStops);

router.route('/')
  .get(stopController.getAllStops)
  .post(restrictTo('admin', 'superadmin'), stopController.createStop);

router.route('/:id')
  .get(stopController.getStop)
  .put(restrictTo('admin', 'superadmin'), stopController.updateStop)
  .delete(restrictTo('admin', 'superadmin'), stopController.deleteStop);

module.exports = router;
