// controllers/stopController.js
// Manages bus stop creation, update, deletion, and lookup.
// Stops are physical GPS-tagged locations referenced by Routes.

const Stop       = require('../models/Stop');
const catchAsync = require('../utils/catchAsync');
const AppError   = require('../utils/AppError');
const logger     = require('../utils/logger');

// CREATE STOP
exports.createStop = catchAsync(async (req, res, next) => {
  const { stopName, stopCode, latitude, longitude, city, address, landmark, facilities } = req.body;

  const existing = await Stop.findOne({ stopCode: stopCode?.toUpperCase() });
  if (existing) return next(new AppError('A stop with this code already exists.', 409));

  const stop = await Stop.create({
    stopName, stopCode,
    location: { type: 'Point', coordinates: [parseFloat(longitude), parseFloat(latitude)] },
    city, address, landmark, facilities,
    createdBy: req.user._id,
  });

  logger.info(`📍 Stop created: ${stop.stopName} (${stop.stopCode})`);
  res.status(201).json({ success: true, stop });
});

// GET ALL STOPS
exports.getAllStops = catchAsync(async (req, res) => {
  const { city, q, page = 1, limit = 50 } = req.query;
  const filter = { isActive: true };
  if (city) filter.city = new RegExp(city, 'i');
  if (q)    filter.$or  = [{ stopName: new RegExp(q, 'i') }, { stopCode: new RegExp(q, 'i') }];

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [stops, total] = await Promise.all([
    Stop.find(filter).sort('stopName').skip(skip).limit(parseInt(limit)),
    Stop.countDocuments(filter),
  ]);

  res.status(200).json({ success: true, count: stops.length, total, stops });
});

// GET SINGLE STOP
exports.getStop = catchAsync(async (req, res, next) => {
  const stop = await Stop.findById(req.params.id);
  if (!stop) return next(new AppError('Stop not found.', 404));
  res.status(200).json({ success: true, stop });
});

// UPDATE STOP
exports.updateStop = catchAsync(async (req, res, next) => {
  const { latitude, longitude, ...rest } = req.body;
  const update = { ...rest };
  if (latitude && longitude) {
    update.location = { type: 'Point', coordinates: [parseFloat(longitude), parseFloat(latitude)] };
  }
  const stop = await Stop.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
  if (!stop) return next(new AppError('Stop not found.', 404));
  res.status(200).json({ success: true, stop });
});

// DELETE STOP
exports.deleteStop = catchAsync(async (req, res, next) => {
  const stop = await Stop.findById(req.params.id);
  if (!stop) return next(new AppError('Stop not found.', 404));
  await Stop.findByIdAndDelete(req.params.id);
  res.status(200).json({ success: true, message: 'Stop deleted.' });
});

// NEAREST STOPS (geospatial $near query)
exports.getNearestStops = catchAsync(async (req, res, next) => {
  const { lat, lng, maxDistanceKm = 2 } = req.query;
  if (!lat || !lng) return next(new AppError('lat and lng are required.', 400));

  const stops = await Stop.find({
    location: {
      $near: {
        $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
        $maxDistance: parseFloat(maxDistanceKm) * 1000,
      },
    },
    isActive: true,
  }).limit(20);

  res.status(200).json({ success: true, count: stops.length, stops });
});
