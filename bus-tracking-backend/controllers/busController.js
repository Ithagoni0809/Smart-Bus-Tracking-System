/**
 * controllers/busController.js
 * ─────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS:
 *   Business logic for everything an admin does to manage the
 *   bus fleet, plus the read-only endpoints passengers use to
 *   search and view buses.
 *
 * ACCESS SUMMARY (enforced in routes/busRoutes.js):
 *   createBus, updateBus, deleteBus, assignDriver, assignRoute → admin only
 *   getBus, getAllBuses, searchBuses, getLiveBuses             → any authenticated user
 * ─────────────────────────────────────────────────────────────
 */

const Bus    = require('../models/Bus');
const Driver = require('../models/Driver');
const Route  = require('../models/Route');

const catchAsync = require('../utils/catchAsync');
const AppError   = require('../utils/AppError');
const logger     = require('../utils/logger');


// ═══════════════════════════════════════════════════════════════════════════
// CREATE BUS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * @route   POST /api/buses
 * @access  Admin
 * @desc    Adds a new bus to the fleet.
 *
 * BUSINESS LOGIC:
 *   - busNumber and vehicleNumber must be globally unique (enforced by the
 *     Mongoose schema's `unique: true`, but we also pre-check here for a
 *     friendlier error before hitting the database's E11000 error).
 *   - If assignedDriver/assignedRoute are provided at creation time, we
 *     validate they exist and that the driver isn't ALREADY assigned to
 *     another bus (a driver can only drive one bus at a time).
 */
exports.createBus = catchAsync(async (req, res, next) => {
  const { busNumber, vehicleNumber, assignedDriver, assignedRoute } = req.body;

  // ── Step 1: Pre-check uniqueness for a clean error message ────────────────
  const existing = await Bus.findOne({
    $or: [{ busNumber: busNumber?.toUpperCase() }, { vehicleNumber: vehicleNumber?.toUpperCase() }],
  });
  if (existing) {
    return next(new AppError('A bus with this bus number or vehicle number already exists.', 409));
  }

  // ── Step 2: If a driver is being assigned, validate availability ──────────
  if (assignedDriver) {
    const driver = await Driver.findById(assignedDriver);
    if (!driver) return next(new AppError('Assigned driver not found.', 404));
    if (driver.assignedBus) {
      return next(new AppError('This driver is already assigned to another bus.', 409));
    }
  }

  // ── Step 3: If a route is being assigned, validate it exists ──────────────
  if (assignedRoute) {
    const route = await Route.findById(assignedRoute);
    if (!route) return next(new AppError('Assigned route not found.', 404));
  }

  // ── Step 4: Create the bus ──────────────────────────────────────────────────
  const bus = await Bus.create({
    ...req.body,
    createdBy: req.user._id,
  });

  // ── Step 5: If a driver was assigned, update the driver's record too ──────
  // Keeping both sides of a one-to-one relationship in sync is essential —
  // otherwise Bus.assignedDriver and Driver.assignedBus could drift apart.
  if (assignedDriver) {
    await Driver.findByIdAndUpdate(assignedDriver, {
      assignedBus: bus._id,
      assignedRoute: assignedRoute || null,
    });
  }

  logger.info(`🚌 New bus added: ${bus.busNumber} by admin ${req.user.email}`);

  res.status(201).json({ success: true, bus });
});


// ═══════════════════════════════════════════════════════════════════════════
// UPDATE BUS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * @route   PUT /api/buses/:id
 * @access  Admin
 * @desc    Updates editable bus fields (capacity, busType, status, etc).
 *
 * NOTE: assignedDriver and assignedRoute are NOT updated here — they have
 * their own dedicated endpoints (assignDriver/assignRoute) because changing
 * them requires updating the OTHER side of the relationship too (see those
 * functions below). Allowing them through this generic update would let
 * the two collections silently drift out of sync.
 */
exports.updateBus = catchAsync(async (req, res, next) => {
  // Strip relationship fields out of the update payload — force admins to
  // use the dedicated assign endpoints for those.
  const { assignedDriver, assignedRoute, ...safeUpdates } = req.body;

  const bus = await Bus.findByIdAndUpdate(req.params.id, safeUpdates, {
    new: true,            // Return the UPDATED document, not the old one
    runValidators: true,  // Re-run schema validation on the updated fields
  });

  if (!bus) {
    return next(new AppError('Bus not found.', 404));
  }

  logger.info(`🚌 Bus updated: ${bus.busNumber} by admin ${req.user.email}`);

  res.status(200).json({ success: true, bus });
});


// ═══════════════════════════════════════════════════════════════════════════
// DELETE BUS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * @route   DELETE /api/buses/:id
 * @access  Admin
 * @desc    Removes a bus from the system.
 *
 * BUSINESS LOGIC:
 *   - A bus that is CURRENTLY ACTIVE (mid-trip) cannot be deleted — that
 *     would strand the live tracking data and confuse passengers watching
 *     it on the map. Admin must end the trip first.
 *   - If the bus has an assigned driver, we clear that driver's
 *     assignedBus/assignedRoute so they aren't left pointing at a
 *     deleted bus (orphaned reference).
 */
exports.deleteBus = catchAsync(async (req, res, next) => {
  const bus = await Bus.findById(req.params.id);

  if (!bus) {
    return next(new AppError('Bus not found.', 404));
  }

  if (bus.isActive) {
    return next(new AppError('Cannot delete a bus that is currently on an active trip. End the trip first.', 400));
  }

  // Clean up the driver side of the relationship before deleting
  if (bus.assignedDriver) {
    await Driver.findByIdAndUpdate(bus.assignedDriver, {
      assignedBus: null,
      assignedRoute: null,
    });
  }

  await Bus.findByIdAndDelete(req.params.id);

  logger.info(`🗑️  Bus deleted: ${bus.busNumber} by admin ${req.user.email}`);

  res.status(200).json({ success: true, message: 'Bus deleted successfully.' });
});


// ═══════════════════════════════════════════════════════════════════════════
// ASSIGN DRIVER TO BUS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * @route   PATCH /api/buses/:id/assign-driver
 * @access  Admin
 * @desc    Assigns a driver to a bus, keeping BOTH collections in sync.
 *
 * BUSINESS LOGIC (the important part):
 *   A driver can only be assigned to ONE bus at a time, and a bus can only
 *   have ONE driver at a time — this is a one-to-one relationship enforced
 *   at the APPLICATION level (Mongoose doesn't enforce this automatically
 *   across two different collections).
 *
 *   Steps:
 *   1. If the bus ALREADY has a different driver, unassign that old driver first
 *      (otherwise that old driver's record would incorrectly still show
 *      assignedBus = this bus, even though a new driver took over).
 *   2. If the NEW driver is already assigned to a DIFFERENT bus, reject —
 *      admin must explicitly unassign them from the other bus first
 *      (prevents accidentally double-booking a driver).
 *   3. Update both Bus.assignedDriver and Driver.assignedBus together.
 */
exports.assignDriver = catchAsync(async (req, res, next) => {
  const { driverId } = req.body;
  const bus = await Bus.findById(req.params.id);

  if (!bus) return next(new AppError('Bus not found.', 404));

  const newDriver = await Driver.findById(driverId);
  if (!newDriver) return next(new AppError('Driver not found.', 404));

  if (!newDriver.isActive) {
    return next(new AppError('Cannot assign an inactive driver.', 400));
  }

  // Guard: is this driver already driving a DIFFERENT bus?
  if (newDriver.assignedBus && newDriver.assignedBus.toString() !== bus._id.toString()) {
    return next(new AppError('This driver is already assigned to a different bus. Unassign them first.', 409));
  }

  // If this bus currently has a DIFFERENT driver, free up that old driver
  if (bus.assignedDriver && bus.assignedDriver.toString() !== driverId) {
    await Driver.findByIdAndUpdate(bus.assignedDriver, {
      assignedBus: null,
      assignedRoute: null,
    });
  }

  // Apply the new assignment on both sides
  bus.assignedDriver = driverId;
  await bus.save();

  newDriver.assignedBus = bus._id;
  // If the bus already has a route assigned, carry that over to the driver too
  newDriver.assignedRoute = bus.assignedRoute || null;
  await newDriver.save();

  logger.info(`👤 Driver ${newDriver.employeeId} assigned to bus ${bus.busNumber}`);

  res.status(200).json({ success: true, bus, driver: newDriver });
});


// ═══════════════════════════════════════════════════════════════════════════
// ASSIGN ROUTE TO BUS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * @route   PATCH /api/buses/:id/assign-route
 * @access  Admin
 * @desc    Assigns a route to a bus. If the bus has a driver, that driver's
 *          assignedRoute is updated too (drivers follow their bus's route).
 */
exports.assignRoute = catchAsync(async (req, res, next) => {
  const { routeId } = req.body;
  const bus = await Bus.findById(req.params.id);

  if (!bus) return next(new AppError('Bus not found.', 404));

  const route = await Route.findById(routeId);
  if (!route) return next(new AppError('Route not found.', 404));

  if (!route.isActive) {
    return next(new AppError('Cannot assign an inactive route.', 400));
  }

  bus.assignedRoute = routeId;
  await bus.save();

  // Keep the driver's record consistent if a driver is already on this bus
  if (bus.assignedDriver) {
    await Driver.findByIdAndUpdate(bus.assignedDriver, { assignedRoute: routeId });
  }

  logger.info(`🗺️  Route ${route.routeNumber} assigned to bus ${bus.busNumber}`);

  res.status(200).json({ success: true, bus });
});


// ═══════════════════════════════════════════════════════════════════════════
// GET SINGLE BUS (View Bus Details)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * @route   GET /api/buses/:id
 * @access  Any authenticated user
 * @desc    Full bus detail, with driver and route populated, for the
 *          passenger "Bus Details" page or admin's edit screen.
 */
exports.getBus = catchAsync(async (req, res, next) => {
  const bus = await Bus.findById(req.params.id)
    .populate('assignedDriver', 'name phone employeeId averageRating')
    .populate('assignedRoute', 'routeNumber routeName source destination totalDistance fare');

  if (!bus) {
    return next(new AppError('Bus not found.', 404));
  }

  res.status(200).json({ success: true, bus });
});


// ═══════════════════════════════════════════════════════════════════════════
// GET ALL BUSES (paginated, admin fleet list)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * @route   GET /api/buses
 * @access  Any authenticated user
 * @desc    Paginated list of all buses. Admin dashboard's "Manage Buses"
 *          table uses this with no filters; passengers rarely call this
 *          directly (they use /search or /live instead).
 */
exports.getAllBuses = catchAsync(async (req, res, next) => {
  const page  = parseInt(req.query.page)  || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip  = (page - 1) * limit;

  const [buses, total] = await Promise.all([
    Bus.find()
      .populate('assignedDriver', 'name employeeId')
      .populate('assignedRoute', 'routeNumber routeName')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit),
    Bus.countDocuments(),
  ]);

  res.status(200).json({
    success: true,
    count: buses.length,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    buses,
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// SEARCH BUSES
// ═══════════════════════════════════════════════════════════════════════════
/**
 * @route   GET /api/buses/search?q=216K&status=active&routeId=...
 * @access  Any authenticated user
 * @desc    Flexible search across bus number, vehicle number, and route.
 *          Powers the passenger "search for my bus" feature.
 *
 * BUSINESS LOGIC:
 *   `q` does a case-insensitive partial match against busNumber AND
 *   vehicleNumber (a passenger might type either). We use a MongoDB
 *   regex rather than the text index here because bus/vehicle numbers
 *   are short alphanumeric codes — partial substring matching ("216" finding
 *   "216K") is more useful than word-based text search for this field type.
 */
exports.searchBuses = catchAsync(async (req, res, next) => {
  const { q, status, routeId, page = 1, limit = 20 } = req.query;
  const filter = {};

  if (q) {
    const regex = new RegExp(q, 'i'); // 'i' = case-insensitive
    filter.$or = [{ busNumber: regex }, { vehicleNumber: regex }];
  }

  if (status) filter.status = status;
  if (routeId) filter.assignedRoute = routeId;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [buses, total] = await Promise.all([
    Bus.find(filter)
      .populate('assignedDriver', 'name phone')
      .populate('assignedRoute', 'routeNumber routeName source destination')
      .sort('-isActive -createdAt') // Active buses first, then newest
      .skip(skip)
      .limit(parseInt(limit)),
    Bus.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    count: buses.length,
    total,
    page: parseInt(page),
    totalPages: Math.ceil(total / parseInt(limit)),
    buses,
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// GET LIVE BUSES (currently active, with GPS)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * @route   GET /api/buses/live
 * @access  Any authenticated user
 * @desc    Returns ONLY buses that are currently on a trip (isActive: true),
 *          with their latest known GPS position. This is the exact query
 *          the passenger Live Map page calls once on load (before Socket.IO
 *          takes over for real-time updates) — see the Live Tracking module.
 *
 * Optionally filtered by routeId so the map can show "just this route".
 */
exports.getLiveBuses = catchAsync(async (req, res, next) => {
  const filter = { isActive: true };
  if (req.query.routeId) filter.assignedRoute = req.query.routeId;

  const buses = await Bus.find(filter)
    .populate('assignedDriver', 'name phone')
    .populate('assignedRoute', 'routeNumber routeName source destination')
    .select('busNumber currentLocation currentSpeed heading currentOccupancy capacity status assignedDriver assignedRoute');

  res.status(200).json({
    success: true,
    count: buses.length,
    buses,
  });
});
