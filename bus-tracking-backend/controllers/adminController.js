// controllers/adminController.js
// Admin-only endpoints: manage drivers, view analytics, manage users.

const Driver   = require('../models/Driver');
const User     = require('../models/User');
const Bus      = require('../models/Bus');
const Trip     = require('../models/Trip');
const Route    = require('../models/Route');
const GpsLog   = require('../models/GpsLog');
const Admin    = require('../models/Admin');
const catchAsync = require('../utils/catchAsync');
const AppError   = require('../utils/AppError');
const logger     = require('../utils/logger');

// ── DRIVER MANAGEMENT ─────────────────────────────────────────────────────

// Create a driver account (admin only)
exports.createDriver = catchAsync(async (req, res, next) => {
  const { name, email, phone, password, employeeId, licenseNumber, licenseExpiry } = req.body;

  // Check uniqueness within Driver (email/employeeId/license) AND across
  // User/Admin by email — same reasoning as authController.register: login
  // resolves by email across all three collections.
  const [existingDriver, existingUser, existingAdmin] = await Promise.all([
    Driver.findOne({ $or: [{ email }, { employeeId }, { licenseNumber }] }),
    User.findOne({ email }),
    Admin.findOne({ email }),
  ]);
  if (existingDriver) return next(new AppError('Driver with this email, employeeId, or license already exists.', 409));
  if (existingUser || existingAdmin) return next(new AppError('An account with this email already exists.', 409));

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

// ── ADMIN MANAGEMENT (superadmin only) ──────────────────────────────────────
// WHY THESE ARE HERE: same file as the rest of admin-facing management
// endpoints, kept separate below the analytics section for clarity.
// All routes for this section are additionally locked to restrictTo('superadmin')
// in adminRoutes.js — a plain 'admin' cannot reach any of these, even though
// they share the /api/admin base path with routes they CAN access.

// Get all admin accounts (superadmin only)
exports.getAllAdmins = catchAsync(async (req, res) => {
  const admins = await Admin.find().sort('-createdAt');
  res.status(200).json({ success: true, count: admins.length, admins });
});

// Create a new admin account (superadmin only)
exports.createAdmin = catchAsync(async (req, res, next) => {
  const { name, email, phone, password, role, department } = req.body;

  if (role && !['admin', 'superadmin'].includes(role)) {
    return next(new AppError('Role must be admin or superadmin.', 400));
  }

  const [existing, existingUser, existingDriver] = await Promise.all([
    Admin.findOne({ $or: [{ email }, { phone }] }),
    User.findOne({ email }),
    Driver.findOne({ email }),
  ]);
  if (existing) return next(new AppError('An admin with this email or phone already exists.', 409));
  if (existingUser || existingDriver) return next(new AppError('An account with this email already exists.', 409));

  const newAdmin = await Admin.create({
    name, email, phone, password,
    role: role || 'admin',
    department,
  });

  newAdmin.password = undefined;
  logger.info(`👑 Admin account created: ${newAdmin.email} (${newAdmin.role}) by ${req.user.email}`);
  res.status(201).json({ success: true, admin: newAdmin });
});

// Activate / deactivate an admin account (superadmin only)
exports.toggleAdminStatus = catchAsync(async (req, res, next) => {
  const target = await Admin.findById(req.params.id);
  if (!target) return next(new AppError('Admin not found.', 404));

  if (target._id.equals(req.user._id)) {
    return next(new AppError('You cannot deactivate your own account.', 400));
  }

  if (target.isActive && target.role === 'superadmin') {
    const activeSuperadmins = await Admin.countDocuments({ role: 'superadmin', isActive: true });
    if (activeSuperadmins <= 1) {
      return next(new AppError('Cannot deactivate the last remaining superadmin.', 400));
    }
  }

  target.isActive = !target.isActive;
  await target.save({ validateBeforeSave: false });
  logger.info(`👑 Admin ${target.email} ${target.isActive ? 'activated' : 'deactivated'} by ${req.user.email}`);
  res.status(200).json({ success: true, message: `Admin ${target.isActive ? 'activated' : 'deactivated'}.`, isActive: target.isActive });
});

// Promote/demote between 'admin' and 'superadmin' (superadmin only)
exports.updateAdminRole = catchAsync(async (req, res, next) => {
  const { role } = req.body;
  if (!['admin', 'superadmin'].includes(role)) {
    return next(new AppError('Role must be admin or superadmin.', 400));
  }

  const target = await Admin.findById(req.params.id);
  if (!target) return next(new AppError('Admin not found.', 404));

  if (target._id.equals(req.user._id) && role !== 'superadmin') {
    return next(new AppError('You cannot demote your own account.', 400));
  }

  if (target.role === 'superadmin' && role === 'admin') {
    const activeSuperadmins = await Admin.countDocuments({ role: 'superadmin', isActive: true });
    if (activeSuperadmins <= 1) {
      return next(new AppError('Cannot demote the last remaining superadmin.', 400));
    }
  }

  target.role = role;
  await target.save({ validateBeforeSave: false });
  logger.info(`👑 Admin ${target.email} role changed to ${role} by ${req.user.email}`);
  res.status(200).json({ success: true, message: `Role updated to ${role}.`, admin: target });
});

// Update an admin's granular permissions (superadmin only)
exports.updateAdminPermissions = catchAsync(async (req, res, next) => {
  const { permissions } = req.body;
  if (!permissions || typeof permissions !== 'object') {
    return next(new AppError('permissions object is required.', 400));
  }

  const target = await Admin.findById(req.params.id);
  if (!target) return next(new AppError('Admin not found.', 404));

  target.permissions = { ...target.permissions.toObject(), ...permissions };
  await target.save({ validateBeforeSave: false });
  res.status(200).json({ success: true, admin: target });
});
