// controllers/favoriteController.js
const Favorite   = require('../models/Favorite');
const catchAsync = require('../utils/catchAsync');
const AppError   = require('../utils/AppError');

// GET all favourites for logged-in user
exports.getMyFavorites = catchAsync(async (req, res) => {
  const favorites = await Favorite.find({ user: req.user._id })
    .populate('route', 'routeNumber routeName source destination fare')
    .populate('bus',   'busNumber vehicleNumber busType currentOccupancy capacity')
    .sort('-createdAt');
  res.status(200).json({ success: true, count: favorites.length, favorites });
});

// ADD a favourite
exports.addFavorite = catchAsync(async (req, res, next) => {
  const { routeId, busId, nickname, notifyOnArrival, notifyOnDelay } = req.body;
  if (!routeId && !busId) return next(new AppError('Provide either routeId or busId.', 400));

  const fav = await Favorite.create({
    user: req.user._id,
    route: routeId || null,
    bus:   busId   || null,
    nickname, notifyOnArrival, notifyOnDelay,
  });

  res.status(201).json({ success: true, favorite: fav });
});

// REMOVE a favourite
exports.removeFavorite = catchAsync(async (req, res, next) => {
  const fav = await Favorite.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!fav) return next(new AppError('Favourite not found.', 404));
  res.status(200).json({ success: true, message: 'Removed from favourites.' });
});

// CHECK if a route/bus is already favourited
exports.checkFavorite = catchAsync(async (req, res) => {
  const { routeId, busId } = req.query;
  const filter = { user: req.user._id };
  if (routeId) filter.route = routeId;
  if (busId)   filter.bus   = busId;
  const fav = await Favorite.findOne(filter);
  res.status(200).json({ success: true, isFavorited: !!fav, favoriteId: fav?._id || null });
});
