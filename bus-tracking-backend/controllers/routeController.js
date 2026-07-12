/**
 * controllers/routeController.js
 * ─────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS:
 *   Business logic for managing routes (the fixed paths buses follow)
 *   and the geo-calculations passengers rely on: total distance,
 *   estimated travel time, nearest-stop search, and remaining-stops.
 *
 * KEY DESIGN DECISION — Stops are STORED separately, REFERENCED here:
 *   See models/Route.js and models/Stop.js for the full reasoning.
 *   In short: a physical stop's GPS coordinates live in the Stop
 *   collection ONCE. A Route just stores an ORDERED array pairing
 *   { stop: <StopId>, sequence, distanceFromStart, expectedTimeFromStart }.
 *   Whenever we need actual coordinates for a calculation, we populate
 *   the `stop` reference.
 * ─────────────────────────────────────────────────────────────
 */

const Route = require('../models/Route');
const Stop  = require('../models/Stop');
const Bus   = require('../models/Bus');

const catchAsync = require('../utils/catchAsync');
const AppError   = require('../utils/AppError');
const logger     = require('../utils/logger');
const {
  haversineDistance,
  findNearestStop,
  calculateRouteCompletion,
} = require('../utils/geoUtils');


// ═══════════════════════════════════════════════════════════════════════════
// CREATE ROUTE
// ═══════════════════════════════════════════════════════════════════════════
/**
 * @route   POST /api/routes
 * @access  Admin
 * @desc    Creates a new route with an ordered list of stops.
 *
 * BUSINESS LOGIC:
 *   1. Every stop ID referenced in `stops` must actually exist in the
 *      Stop collection — we validate this BEFORE creating the route,
 *      since Mongoose's `ref` field doesn't enforce referential integrity
 *      on its own (MongoDB has no foreign key constraints).
 *   2. Sequence numbers must be unique and form a clean 1..N ordering —
 *      we don't strictly require zero gaps, but we DO require no duplicates,
 *      since duplicate sequences would break ETA/remaining-stop math.
 *   3. totalDistance and expectedDuration, if not explicitly provided,
 *      are AUTO-CALCULATED from the stop coordinates using Haversine
 *      distance — see calculateRouteDistanceAndDuration() helper below.
 */
exports.createRoute = catchAsync(async (req, res, next) => {
  const { routeNumber, stops } = req.body;

  // ── Step 1: Uniqueness pre-check ────────────────────────────────────────
  const existing = await Route.findOne({ routeNumber: routeNumber?.toUpperCase() });
  if (existing) {
    return next(new AppError('A route with this route number already exists.', 409));
  }

  // ── Step 2: Validate every referenced stop actually exists ─────────────
  const stopIds = stops.map((s) => s.stop);
  const foundStops = await Stop.find({ _id: { $in: stopIds } });
  if (foundStops.length !== stopIds.length) {
    return next(new AppError('One or more referenced stops do not exist.', 404));
  }

  // ── Step 3: Validate no duplicate sequence numbers ──────────────────────
  const sequences = stops.map((s) => s.sequence);
  if (new Set(sequences).size !== sequences.length) {
    return next(new AppError('Stop sequence numbers must be unique within a route.', 400));
  }

  // ── Step 4: Auto-calculate distance/duration if not provided ───────────
  let { totalDistance, expectedDuration } = req.body;
  if (!totalDistance || !expectedDuration) {
    const calculated = calculateRouteDistanceAndDuration(stops, foundStops);
    totalDistance = totalDistance || calculated.totalDistance;
    expectedDuration = expectedDuration || calculated.expectedDuration;
  }

  // ── Step 5: Create the route ─────────────────────────────────────────────
  const route = await Route.create({
    ...req.body,
    totalDistance,
    expectedDuration,
    createdBy: req.user._id,
  });

  logger.info(`🗺️  New route created: ${route.routeNumber} by admin ${req.user.email}`);

  res.status(201).json({ success: true, route });
});

/**
 * calculateRouteDistanceAndDuration — helper (not an exported endpoint).
 * Sums the Haversine distance between EACH CONSECUTIVE pair of stops
 * (in sequence order) to get a total route distance, then estimates
 * duration assuming a 25 km/h average city-bus speed (accounts for
 * traffic + stop dwell time, more realistic than open-road speed).
 */
const calculateRouteDistanceAndDuration = (routeStops, populatedStops) => {
  // Build a lookup map: stopId → { latitude, longitude }
  const stopMap = {};
  populatedStops.forEach((s) => {
    stopMap[s._id.toString()] = {
      latitude: s.location.coordinates[1],  // GeoJSON is [lng, lat]
      longitude: s.location.coordinates[0],
    };
  });

  // Sort by sequence to ensure we sum distances in the correct travel order
  const sorted = [...routeStops].sort((a, b) => a.sequence - b.sequence);

  let totalDistance = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prevCoords = stopMap[sorted[i - 1].stop.toString()];
    const currCoords = stopMap[sorted[i].stop.toString()];
    if (prevCoords && currCoords) {
      totalDistance += haversineDistance(
        prevCoords.latitude, prevCoords.longitude,
        currCoords.latitude, currCoords.longitude
      );
    }
  }

  const AVERAGE_CITY_BUS_SPEED_KMH = 25;
  const expectedDuration = Math.ceil((totalDistance / AVERAGE_CITY_BUS_SPEED_KMH) * 60); // minutes

  return {
    totalDistance: Math.round(totalDistance * 100) / 100,
    expectedDuration,
  };
};


// ═══════════════════════════════════════════════════════════════════════════
// UPDATE ROUTE
// ═══════════════════════════════════════════════════════════════════════════
/**
 * @route   PUT /api/routes/:id
 * @access  Admin
 * @desc    Updates route metadata (name, fare, operating days, etc).
 *          Stop list changes go through the dedicated add/remove-stop
 *          endpoints below — NOT through this generic update — because
 *          adding/removing a stop requires recalculating distance/duration
 *          for every OTHER stop after it, which deserves its own focused logic.
 */
exports.updateRoute = catchAsync(async (req, res, next) => {
  const { stops, ...safeUpdates } = req.body; // stops intentionally excluded

  const route = await Route.findByIdAndUpdate(req.params.id, safeUpdates, {
    new: true,
    runValidators: true,
  });

  if (!route) {
    return next(new AppError('Route not found.', 404));
  }

  logger.info(`🗺️  Route updated: ${route.routeNumber} by admin ${req.user.email}`);

  res.status(200).json({ success: true, route });
});


// ═══════════════════════════════════════════════════════════════════════════
// DELETE ROUTE
// ═══════════════════════════════════════════════════════════════════════════
/**
 * @route   DELETE /api/routes/:id
 * @access  Admin
 * @desc    Deletes a route — but ONLY if no bus is currently assigned to it.
 *          Deleting an in-use route would orphan Bus.assignedRoute references
 *          and break the live map for any bus currently running it.
 */
exports.deleteRoute = catchAsync(async (req, res, next) => {
  const route = await Route.findById(req.params.id);
  if (!route) {
    return next(new AppError('Route not found.', 404));
  }

  const busesOnRoute = await Bus.countDocuments({ assignedRoute: route._id });
  if (busesOnRoute > 0) {
    return next(
      new AppError(`Cannot delete this route — ${busesOnRoute} bus(es) are currently assigned to it. Reassign them first.`, 400)
    );
  }

  await Route.findByIdAndDelete(req.params.id);

  logger.info(`🗑️  Route deleted: ${route.routeNumber} by admin ${req.user.email}`);

  res.status(200).json({ success: true, message: 'Route deleted successfully.' });
});


// ═══════════════════════════════════════════════════════════════════════════
// ADD STOP TO ROUTE
// ═══════════════════════════════════════════════════════════════════════════
/**
 * @route   POST /api/routes/:id/stops
 * @access  Admin
 * @desc    Inserts a new stop into an existing route's ordered stop list.
 *
 * BUSINESS LOGIC:
 *   - Rejects if the sequence number is already taken on this route
 *     (admin should use a sequence that doesn't collide, e.g. inserting
 *     stop "2.5" conceptually means renumbering — for v1.0 we keep this
 *     simple and require the admin to pick a free sequence number; a
 *     "renumber and shift" helper is straightforward future work).
 *   - Rejects if the stop doesn't exist in the Stop collection.
 *   - Recalculates totalDistance and expectedDuration after insertion,
 *     since adding a stop changes both.
 */
exports.addStop = catchAsync(async (req, res, next) => {
  const { stopId, sequence, expectedTimeFromStart, distanceFromStart } = req.body;

  const route = await Route.findById(req.params.id);
  if (!route) return next(new AppError('Route not found.', 404));

  const stop = await Stop.findById(stopId);
  if (!stop) return next(new AppError('Stop not found.', 404));

  const sequenceTaken = route.stops.some((s) => s.sequence === sequence);
  if (sequenceTaken) {
    return next(new AppError(`Sequence number ${sequence} is already used on this route. Choose a different one.`, 409));
  }

  const alreadyOnRoute = route.stops.some((s) => s.stop.toString() === stopId);
  if (alreadyOnRoute) {
    return next(new AppError('This stop is already part of the route.', 409));
  }

  route.stops.push({ stop: stopId, sequence, expectedTimeFromStart, distanceFromStart });

  // Re-derive totalDistance/expectedDuration from the new full stop list
  const populatedStops = await Stop.find({ _id: { $in: route.stops.map((s) => s.stop) } });
  const recalculated = calculateRouteDistanceAndDuration(route.stops, populatedStops);
  route.totalDistance = recalculated.totalDistance;
  route.expectedDuration = recalculated.expectedDuration;

  await route.save();

  logger.info(`➕ Stop "${stop.stopName}" added to route ${route.routeNumber}`);

  res.status(200).json({ success: true, route });
});


// ═══════════════════════════════════════════════════════════════════════════
// REMOVE STOP FROM ROUTE
// ═══════════════════════════════════════════════════════════════════════════
/**
 * @route   DELETE /api/routes/:id/stops/:stopId
 * @access  Admin
 * @desc    Removes a stop from a route's ordered list and recalculates
 *          distance/duration. A route must retain at least 2 stops
 *          (source + destination) — enforced by the schema validator,
 *          but we also check here to give a clean error before attempting save.
 */
exports.removeStop = catchAsync(async (req, res, next) => {
  const route = await Route.findById(req.params.id);
  if (!route) return next(new AppError('Route not found.', 404));

  if (route.stops.length <= 2) {
    return next(new AppError('Cannot remove stop — a route must have at least 2 stops.', 400));
  }

  const stopExists = route.stops.some((s) => s.stop.toString() === req.params.stopId);
  if (!stopExists) {
    return next(new AppError('This stop is not part of the route.', 404));
  }

  route.stops = route.stops.filter((s) => s.stop.toString() !== req.params.stopId);

  // Recalculate distance/duration after removal
  const populatedStops = await Stop.find({ _id: { $in: route.stops.map((s) => s.stop) } });
  const recalculated = calculateRouteDistanceAndDuration(route.stops, populatedStops);
  route.totalDistance = recalculated.totalDistance;
  route.expectedDuration = recalculated.expectedDuration;

  await route.save();

  logger.info(`➖ Stop removed from route ${route.routeNumber}`);

  res.status(200).json({ success: true, route });
});


// ═══════════════════════════════════════════════════════════════════════════
// GET SINGLE ROUTE (with full stop details)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * @route   GET /api/routes/:id
 * @access  Any authenticated user
 * @desc    Returns full route details with EVERY stop's full document
 *          populated (name, GPS coordinates, facilities) — this is what
 *          powers the passenger "Route Details" page showing the full
 *          stop-by-stop itinerary.
 */
exports.getRoute = catchAsync(async (req, res, next) => {
  const route = await Route.findById(req.params.id).populate({
    path: 'stops.stop',
    select: 'stopName stopCode location address landmark facilities',
  });

  if (!route) {
    return next(new AppError('Route not found.', 404));
  }

  // Ensure stops are returned in sequence order (defensive — they SHOULD
  // already be inserted in order, but a direct DB edit could break that)
  route.stops.sort((a, b) => a.sequence - b.sequence);

  res.status(200).json({ success: true, route });
});


// ═══════════════════════════════════════════════════════════════════════════
// GET ALL ROUTES
// ═══════════════════════════════════════════════════════════════════════════
/**
 * @route   GET /api/routes
 * @access  Any authenticated user
 */
exports.getAllRoutes = catchAsync(async (req, res, next) => {
  // Passengers/drivers should only ever see routes currently in service.
  // Admins/superadmins manage the full list, including deactivated routes —
  // otherwise a route would permanently vanish from the admin's own
  // management page the moment it's deactivated, with no way to see or
  // reactivate it again.
  const isAdminRole = req.user.role === 'admin' || req.user.role === 'superadmin';
  const filter = isAdminRole ? {} : { isActive: true };

  const routes = await Route.find(filter)
    .select('routeNumber routeName source destination totalDistance expectedDuration fare routeType isActive')
    .sort('routeNumber');

  res.status(200).json({ success: true, count: routes.length, routes });
});


// ═══════════════════════════════════════════════════════════════════════════
// SEARCH ROUTES (by source/destination, or free text)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * @route   GET /api/routes/search?from=Secunderabad&to=HitechCity
 *          GET /api/routes/search?q=216
 * @access  Any authenticated user
 * @desc    Powers the passenger search bar: "I want to go FROM X TO Y."
 *
 * BUSINESS LOGIC:
 *   - If `from`/`to` are given, we do partial case-insensitive matches
 *     against route.source and route.destination — passengers rarely
 *     type the EXACT official stop name.
 *   - If `q` is given instead, we run the route's text index (routeName,
 *     source, destination combined) for a general free-text search,
 *     e.g. searching just a route number or partial name.
 */
exports.searchRoutes = catchAsync(async (req, res, next) => {
  const { from, to, q } = req.query;
  let filter = { isActive: true };

  if (from || to) {
    if (from) filter.source = new RegExp(from, 'i');
    if (to) filter.destination = new RegExp(to, 'i');
  } else if (q) {
    filter = { ...filter, $text: { $search: q } };
  }

  const routes = await Route.find(filter)
    .select('routeNumber routeName source destination totalDistance expectedDuration fare routeType')
    .sort('routeNumber')
    .limit(50);

  res.status(200).json({ success: true, count: routes.length, routes });
});


// ═══════════════════════════════════════════════════════════════════════════
// NEAREST STOP SEARCH
// ═══════════════════════════════════════════════════════════════════════════
/**
 * @route   GET /api/routes/stops/nearest?lat=17.44&lng=78.38&maxDistanceKm=2
 * @access  Any authenticated user
 * @desc    Finds bus stops near the passenger's current GPS position.
 *          Powers "stops near me" on the passenger map.
 *
 * IMPLEMENTATION NOTE:
 *   This uses MongoDB's native $near geospatial query against the Stop
 *   collection's 2dsphere index (see models/Stop.js) — NOT our own
 *   Haversine JS function. $near is implemented in MongoDB's query engine
 *   itself and is FAR faster than fetching every stop and computing
 *   distance in JavaScript, because it uses the geospatial index to skip
 *   straight to nearby documents instead of scanning the whole collection.
 *
 *   We reserve the JS Haversine helper (geoUtils.js) for calculations
 *   that happen on data ALREADY in memory (e.g. comparing a bus's
 *   position against the small list of stops on ONE specific route,
 *   in the Live Tracking module) where spinning up a separate DB query
 *   would be slower than just computing it directly.
 */
exports.findNearestStops = catchAsync(async (req, res, next) => {
  const { lat, lng, maxDistanceKm = 2 } = req.query;

  const stops = await Stop.find({
    location: {
      $near: {
        $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
        $maxDistance: parseFloat(maxDistanceKm) * 1000, // $maxDistance is in METRES
      },
    },
    isActive: true,
  }).limit(20);

  res.status(200).json({ success: true, count: stops.length, stops });
});


// ═══════════════════════════════════════════════════════════════════════════
// REMAINING STOPS CALCULATION
// ═══════════════════════════════════════════════════════════════════════════
/**
 * @route   GET /api/routes/:id/remaining-stops?currentSequence=4
 * @access  Any authenticated user
 * @desc    Given the sequence number of the stop a bus has most recently
 *          passed, returns every stop AFTER it (i.e. what's still ahead)
 *          plus a simple count. This is what powers the passenger-facing
 *          "3 stops remaining" badge.
 *
 * WHY currentSequence COMES FROM THE QUERY, NOT COMPUTED HERE:
 *   The Bus document already tracks `lastPassedStopSequence` (updated
 *   live by the GPS-update Socket.IO handler — see the Live Tracking
 *   module). This endpoint is a pure, stateless calculation given that
 *   number, so it can also be used for "what if" queries (e.g. a
 *   passenger picking a hypothetical boarding stop) without needing to
 *   look up a specific bus at all.
 */
exports.getRemainingStops = catchAsync(async (req, res, next) => {
  const currentSequence = parseInt(req.query.currentSequence);

  const route = await Route.findById(req.params.id).populate({
    path: 'stops.stop',
    select: 'stopName stopCode location',
  });

  if (!route) {
    return next(new AppError('Route not found.', 404));
  }

  const sortedStops = [...route.stops].sort((a, b) => a.sequence - b.sequence);
  const remainingStops = sortedStops.filter((s) => s.sequence > currentSequence);

  const totalRouteDistance = route.totalDistance;
  const lastPassedStop = sortedStops.find((s) => s.sequence === currentSequence);
  const completionPercentage = lastPassedStop
    ? calculateRouteCompletion(lastPassedStop.distanceFromStart, totalRouteDistance)
    : 0;

  res.status(200).json({
    success: true,
    currentSequence,
    remainingStopsCount: remainingStops.length,
    remainingStops,
    routeCompletionPercentage: completionPercentage,
  });
});
