// controllers/adminController.js
// Admin-only endpoints: manage drivers, view analytics, manage users.

const Driver   = require('../models/Driver');
const User     = require('../models/User');
const Bus      = require('../models/Bus');
const Trip     = require('../models/Trip');
const Route    = require('../models/Route');
const GpsLog   = require('../models/GpsLog');
const catchAsync = require('../utils/catchAsync');
const AppError   = require('../utils/AppError');
const logger     = require('../utils/logger');

// ── DRIVER MANAGEMENT ─────────────────────────────────────────────────────

// Create a driver account (admin only)
exports.createDriver = catchAsync(async (req, res, next) => {
  const { name, email, phone, password, employeeId, licenseNumber, licenseExpiry } = req.body;

  const existing = await Driver.findOne({ $or: [{ email }, { employeeId }, { licenseNumber }] });
  if (existing) return next(new AppError('Driver with this email, employeeId, or license already exists.', 409));

  const driver = await Driver.create({
    name, email, phone, password,
    employeeId, licenseNumber, licenseExpiry,
    createdBy: req.user._id,
  });

  driver.password = undefined;
  logger.info(`👤 Driver created: ${driver.employeeId} by admin ${req.user.email}`);
  res.status(201).json({ success: true, driver });
});

// Get all drivers (paginated)
exports.getAllDrivers = catchAsync(async (req, res) => {
  const { page = 1, limit = 20, isActive, isOnTrip } = req.query;
  const filter = {};
  if (isActive  !== undefined) filter.isActive  = isActive  === 'true';
  if (isOnTrip  !== undefined) filter.isOnTrip  = isOnTrip  === 'true';

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [drivers, total] = await Promise.all([
    Driver.find(filter)
      .select('-password')
      .populate('assignedBus',   'busNumber')
      .populate('assignedRoute', 'routeNumber routeName')
      .sort('-createdAt')
      .skip(skip)
      .limit(parseInt(limit)),
    Driver.countDocuments(filter),
  ]);

  res.status(200).json({ success: true, count: drivers.length, total, drivers });
});

// Get single driver
exports.getDriver = catchAsync(async (req, res, next) => {
  const driver = await Driver.findById(req.params.id)
    .select('-password')
    .populate('assignedBus',   'busNumber vehicleNumber')
    .populate('assignedRoute', 'routeNumber routeName');
  if (!driver) return next(new AppError('Driver not found.', 404));
  res.status(200).json({ success: true, driver });
});

// Update driver
exports.updateDriver = catchAsync(async (req, res, next) => {
  const { password, ...safeUpdates } = req.body; // Prevent password change via this endpoint
  const driver = await Driver.findByIdAndUpdate(req.params.id, safeUpdates, { new: true, runValidators: true }).select('-password');
  if (!driver) return next(new AppError('Driver not found.', 404));
  res.status(200).json({ success: true, driver });
});

// Deactivate driver
exports.deactivateDriver = catchAsync(async (req, res, next) => {
  const driver = await Driver.findById(req.params.id);
  if (!driver) return next(new AppError('Driver not found.', 404));
  if (driver.isOnTrip) return next(new AppError('Cannot deactivate a driver currently on a trip.', 400));
  driver.isActive = false;
  await driver.save();
  res.status(200).json({ success: true, message: 'Driver deactivated.' });
});

// ── USER MANAGEMENT ───────────────────────────────────────────────────────

// Get all passengers
exports.getAllUsers = catchAsync(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [users, total] = await Promise.all([
    User.find({ role: 'passenger' })
      .select('-password')
      .sort('-createdAt')
      .skip(skip)
      .limit(parseInt(limit)),
    User.countDocuments({ role: 'passenger' }),
  ]);
  res.status(200).json({ success: true, count: users.length, total, users });
});

// Toggle user active status
exports.toggleUserStatus = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id);
  if (!user) return next(new AppError('User not found.', 404));
  user.isActive = !user.isActive;
  await user.save();
  res.status(200).json({ success: true, message: `User ${user.isActive ? 'activated' : 'deactivated'}.`, isActive: user.isActive });
});

// ── ANALYTICS ─────────────────────────────────────────────────────────────

exports.getAnalytics = catchAsync(async (req, res) => {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);

  const [
    totalBuses, activeBuses, totalRoutes, totalDrivers,
    totalUsers, tripsToday, tripsThisWeek,
    avgDelayArr, completedTrips, breakdownTrips,
  ] = await Promise.all([
    Bus.countDocuments(),
    Bus.countDocuments({ isActive: true }),
    Route.countDocuments({ isActive: true }),
    Driver.countDocuments({ isActive: true }),
    User.countDocuments({ role: 'passenger' }),
    Trip.countDocuments({ actualStartTime: { $gte: today } }),
    Trip.countDocuments({ actualStartTime: { $gte: weekAgo } }),
    Trip.aggregate([
      { $match: { status: 'completed', actualEndTime: { $gte: weekAgo } } },
      { $group: { _id: null, avgDelay: { $avg: '$delayMinutes' } } },
    ]),
    Trip.countDocuments({ status: 'completed', actualEndTime: { $gte: weekAgo } }),
    Trip.countDocuments({ status: 'breakdown', actualStartTime: { $gte: weekAgo } }),
  ]);

  // Trips per day for the past 7 days (for chart)
  const tripsPerDay = await Trip.aggregate([
    { $match: { actualStartTime: { $gte: weekAgo } } },
    { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$actualStartTime' } },
        count: { $sum: 1 },
    }},
    { $sort: { _id: 1 } },
  ]);

  res.status(200).json({
    success: true,
    analytics: {
      fleet:   { totalBuses, activeBuses, totalRoutes, totalDrivers },
      users:   { totalUsers },
      trips:   { tripsToday, tripsThisWeek, completedTrips, breakdownTrips },
      performance: {
        avgDelayMinutes: avgDelayArr[0]?.avgDelay?.toFixed(1) || 0,
        onTimeRate: completedTrips
          ? (((completedTrips - breakdownTrips) / completedTrips) * 100).toFixed(1)
          : 100,
      },
      chart: { tripsPerDay },
    },
  });
});
