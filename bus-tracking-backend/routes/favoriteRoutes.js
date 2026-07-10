// routes/favoriteRoutes.js
const express = require('express');
const router  = express.Router();
const fc      = require('../controllers/favoriteController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/',        fc.getMyFavorites);
router.get('/check',   fc.checkFavorite);
router.post('/',       fc.addFavorite);
router.delete('/:id',  fc.removeFavorite);

module.exports = router;
