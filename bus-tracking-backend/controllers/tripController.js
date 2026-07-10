/**
 * controllers/tripController.js
 * ─────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS:
 *   Manages the lifecycle of a Trip — the entity that ties together
 *   a Bus, Driver, and Route for one journey. Starting a trip is
 *   what FLIPS ON live GPS tracking; ending a trip flips it off.
 *   This is the REST-API half of Live Tracking — the Socket.IO half
 *   (continuous GPS broadcasting while a trip is in progress) lives
 *   in socket/socketHandler.js.
 * ─────────────────────────────────────────────────────────────
 */

const Trip   = require('../models/Trip');
const Bus    = require('../models/Bus');
const Driver = require('../models/Driver');

const catchAsync = require('../utils/catchAsync');
const AppError   = require('../utils/AppError');
const logger     = require('../utils/logger');


// ═══════════════════════════════════════════════════════════════════════════
// START TRIP
// ═══════════════════════════════════════════════════════════════════════════
/**
 * @route   POST /api/trips/start
 * @access  Driver
 * @desc    Begins a new trip for the currently logged-in driver's assigned bus.
 *
 * BUSINESS LOGIC:
 *   1. The driver must already be ASSIGNED to a bus (set by admin via
 *      busController.assignDriver) — drivers can't just pick any bus.
 *   2. The driver must not ALREADY be on a trip (isOnTrip: true) —
 *      one active trip per driver at a time.
 *   3. The bus must have an assigned route — you can't track a trip with
 *      no path to follow.
 *   4. On success, we flip THREE documents into "active" state together:
 *      Trip (status: in-progress), Bus (isActive: true), Driver (isOnTrip: true).
 *      This is the moment the bus becomes visible on the passenger live map.
 */
exports.startTrip = catchAsync(async (req, res, next) => {
  const driver = await Driver.findById(req.user._id);

  if (driver.isOnTrip) {
    return next(new AppError('You already have an active trip in progress. End it before starting a new one.', 409));
  }

  if (!driver.assignedBus) {
    return next(new AppError('You are not currently assigned to a bus. Contact your administrator.', 400));
  }

  const bus = await Bus.findById(driver.assignedBus);
  if (!bus) {
    return next(new AppError('Your assigned bus could not be found.', 404));
  }

  if (!bus.assignedRoute) {
    return next(new AppError('Your bus does not have an assigned route. Contact your administrator.', 400));
  }

  if (bus.isActive) {
    return next(new AppError('This bus already has an active trip in progress.', 409));
  }

  // ── Create the Trip record ──────────────────────────────────────────────
  const now = new Date();
  const trip = await Trip.create({
    bus: bus._id,
    driver: driver._id,
    route: bus.assignedRoute,
    scheduledStartTime: now,     // In v1.0 we treat "now" as scheduled = actual;
    actualStartTime: now,        // a real timetable-based scheduling system is future scope.
    scheduledEndTime: now,       // Placeholder until trip ends (no fixed-duration scheduling yet)
    status: 'in-progress',
  });

  // ── Flip Bus to active state ────────────────────────────────────────────
  bus.isActive = true;
  bus.currentTrip = trip._id;
  bus.status = 'active';
  bus.lastPassedStopSequence = 0; // Reset progress tracker for the new trip
  await bus.save();

  // ── Flip Driver to on-trip state ────────────────────────────────────────
  driver.isOnTrip = true;
  driver.currentTrip = trip._id;
  await driver.save();

  logger.info(`▶️  Trip started: bus ${bus.busNumber}, driver ${driver.employeeId}, trip ${trip._id}`);

  // ── Notify the admin dashboard in real time via Socket.IO ──────────────
  // req.app.get('io') retrieves the Socket.IO instance attached in server.js
  const io = req.app.get('io');
  if (io) {
    io.to('admin').emit('trip-started', {
      tripId: trip._id,
      busId: bus._id,
      busNumber: bus.busNumber,
      driverName: driver.name,
      routeId: bus.assignedRoute,
    });
  }

  res.status(201).json({ success: true, trip, bus });
});


// ═══════════════════════════════════════════════════════════════════════════
// END TRIP
// ═══════════════════════════════════════════════════════════════════════════
/**
 * @route   PATCH /api/trips/:tripId/end
 * @access  Driver
 * @desc    Ends the driver's currently active trip.
 *
 * BUSINESS LOGIC:
 *   1. Calculates delayMinutes by comparing actualEndTime to scheduledEndTime.
 *   2. Resets Bus and Driver back to idle/not-on-trip — this is the moment
 *      the bus DISAPPEARS from the passenger live map.
 *   3. Increments totalTrips counters on both Bus and Driver for analytics.
 *   4. Broadcasts 'trip-ended' so any passenger currently watching this bus
 *      sees it go offline immediately, rather than appearing "frozen" at
 *      its last position forever.
 */
exports.endTrip = catchAsync(async (req, res, next) => {
  const trip = await Trip.findById(req.params.tripId);

  if (!trip) {
    return next(new AppError('Trip not found.', 404));
  }

  // Authorization check: a driver can only end THEIR OWN trip
  if (trip.driver.toString() !== req.user._id.toString()) {
    return next(new AppError('You can only end your own trip.', 403));
  }

  if (trip.status !== 'in-progress') {
    return next(new AppError('This trip is not currently in progress.', 400));
  }

  const now = new Date();
  trip.actualEndTime = now;
  trip.scheduledEndTime = trip.scheduledEndTime || now;
  trip.status = 'completed';
  trip.delayMinutes = trip.calculateDelay();

  if (req.body.latitude && req.body.longitude) {
    trip.endLocation = { latitude: req.body.latitude, longitude: req.body.longitude };
  }

  await trip.save();

  // ── Reset Bus to idle ────────────────────────────────────────────────────
  const bus = await Bus.findById(trip.bus);
  if (bus) {
    bus.isActive = false;
    bus.currentTrip = null;
    bus.status = 'idle';
    bus.currentSpeed = 0;
    bus.totalTrips += 1;
    await bus.save();
  }

  // ── Reset Driver to not-on-trip ─────────────────────────────────────────
  const driver = await Driver.findById(trip.driver);
  if (driver) {
    driver.isOnTrip = false;
    driver.currentTrip = null;
    driver.totalTrips += 1;
    await driver.save();
  }

  logger.info(`⏹️  Trip ended: ${trip._id} — delay: ${trip.delayMinutes} min`);

  // ── Notify passengers and admin that this bus has gone offline ─────────
  const io = req.app.get('io');
  if (io && bus) {
    io.to(`route:${trip.route}`).to(`bus:${bus._id}`).to('admin').emit('trip-ended', {
      tripId: trip._id,
      busId: bus._id,
    });
  }

  res.status(200).json({ success: true, trip });
});


// ═══════════════════════════════════════════════════════════════════════════
// GET TRIP DETAILS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * @route   GET /api/trips/:tripId
 * @access  Any authenticated user
 */
exports.getTrip = catchAsync(async (req, res, next) => {
  const trip = await Trip.findById(req.params.tripId)
    .populate('bus', 'busNumber vehicleNumber')
    .populate('driver', 'name phone')
    .populate('route', 'routeNumber routeName source destination');

  if (!trip) {
    return next(new AppError('Trip not found.', 404));
  }

  res.status(200).json({ success: true, trip });
});


// ═══════════════════════════════════════════════════════════════════════════
// GET TRIP HISTORY (for a bus, driver, or the logged-in passenger's travels)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * @route   GET /api/trips/history?busId=...&driverId=...
 * @access  Any authenticated user
 * @desc    Returns completed trips, newest first, optionally filtered.
 *          Powers the passenger "Bus History" feature and admin trip logs.
 */
exports.getTripHistory = catchAsync(async (req, res, next) => {
  const { busId, driverId, routeId, page = 1, limit = 20 } = req.query;
  const filter = { status: 'completed' };

  if (busId) filter.bus = busId;
  if (driverId) filter.driver = driverId;
  if (routeId) filter.route = routeId;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [trips, total] = await Promise.all([
    Trip.find(filter)
      .populate('bus', 'busNumber')
      .populate('driver', 'name')
      .populate('route', 'routeNumber routeName')
      .sort('-actualEndTime')
      .skip(skip)
      .limit(parseInt(limit)),
    Trip.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    count: trips.length,
    total,
    page: parseInt(page),
    totalPages: Math.ceil(total / parseInt(limit)),
    trips,
  });
});
