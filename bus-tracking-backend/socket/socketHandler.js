/**
 * socket/socketHandler.js
 * ─────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS:
 *   This is the real-time NERVOUS SYSTEM of the entire application.
 *   Every "live" feature in the SRS — live GPS tracking, ETA, speed,
 *   remaining stops, route deviation, occupancy — is computed and
 *   broadcast from inside this single file.
 *
 * THE CORE LOOP (every 5 seconds, while a driver is on a trip):
 *   1. Driver's browser captures GPS via navigator.geolocation
 *   2. Driver emits 'gps-update' over its Socket.IO connection
 *   3. Server (THIS FILE) receives it, and for that one ping:
 *        a. Validates the driver is actually on an active trip
 *        b. Computes speed (if device didn't report one) via geoUtils
 *        c. Computes route deviation (is the bus off its path?)
 *        d. Computes nearest stop + remaining stops count
 *        e. Computes ETA to the NEXT stop
 *        f. Persists a GpsLog document (the permanent history)
 *        g. Updates the Bus document's live fields (denormalized cache)
 *        h. Broadcasts 'bus-position' to everyone watching this bus/route
 *   4. Passenger's browser receives 'bus-position' and animates the
 *      marker, updates the ETA card, updates the remaining-stops badge
 *
 * ROOM STRATEGY (who receives what):
 *   `route:<routeId>` — every passenger watching this route's live map
 *   `bus:<busId>`     — every passenger who opened this SPECIFIC bus's detail page
 *   `admin`           — the admin dashboard, sees EVERYTHING
 * ─────────────────────────────────────────────────────────────
 */

const logger = require('../utils/logger');
const { verifyAccessToken } = require('../utils/jwt');

const Bus    = require('../models/Bus');
const Driver = require('../models/Driver');
const Trip   = require('../models/Trip');
const Route  = require('../models/Route');
const Stop   = require('../models/Stop');
const GpsLog = require('../models/GpsLog');

const {
  haversineDistance,
  calculateBearing,
  calculateSpeed,
  calculateETA,
  findNearestStop,
  isOffRoute,
  calculateRouteCompletion,
} = require('../utils/geoUtils');

// ── In-Memory Cache: Route Stop Coordinates ─────────────────────────────────
// Re-fetching and re-populating a route's full stop list from MongoDB on
// EVERY single GPS ping (every 5 seconds, per active bus) would be wasteful —
// the stop list for a route almost never changes mid-trip. We cache it in
// memory, keyed by routeId, and only refresh when a trip starts or the cache
// is missing. This is a simple in-process cache; for a multi-server deployment
// you'd swap this for Redis, but for this project's scale it's the right
// trade-off of simplicity vs performance.
const routeStopCache = new Map(); // routeId (string) -> [{ sequence, latitude, longitude, distanceFromStart, stopId }]

const loadRouteStopsIntoCache = async (routeId) => {
  const route = await Route.findById(routeId).populate({
    path: 'stops.stop',
    select: 'location stopName',
  });
  if (!route) return [];

  const stopList = route.stops
    .map((s) => ({
      sequence: s.sequence,
      distanceFromStart: s.distanceFromStart,
      stopId: s.stop._id.toString(),
      stopName: s.stop.stopName,
      latitude: s.stop.location.coordinates[1],  // GeoJSON [lng, lat]
      longitude: s.stop.location.coordinates[0],
    }))
    .sort((a, b) => a.sequence - b.sequence);

  routeStopCache.set(routeId.toString(), stopList);
  return stopList;
};

const getRouteStops = async (routeId) => {
  const key = routeId.toString();
  if (routeStopCache.has(key)) return routeStopCache.get(key);
  return loadRouteStopsIntoCache(key);
};


/**
 * initializeSocket — attaches all event handlers to the Socket.IO server.
 * @param {Server} io - The Socket.IO server instance created in server.js
 */
const initializeSocket = (io) => {

  // ── Socket.IO Authentication Middleware ─────────────────────────────────
  // Runs once per new connection, BEFORE the 'connection' event fires.
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        // Anonymous connections are allowed (passengers browsing before
        // login can still watch public live bus positions). Events that
        // REQUIRE an identified driver/admin check socket.user inside
        // their own handler below.
        return next();
      }
      const decoded = verifyAccessToken(token);
      socket.user = decoded; // { id, role }
      next();
    } catch (err) {
      next(new Error('Authentication failed for socket connection'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`🔌 Socket connected: ${socket.id}${socket.user ? ` (${socket.user.role}: ${socket.user.id})` : ' (anonymous)'}`);

    // ═══════════════════════════════════════════════════════════════════
    // ROOM MANAGEMENT (passenger subscriptions)
    // ═══════════════════════════════════════════════════════════════════

    socket.on('join-route', ({ routeId }) => {
      if (!routeId) return;
      socket.join(`route:${routeId}`);
      logger.debug(`Socket ${socket.id} joined route:${routeId}`);
    });

    socket.on('leave-route', ({ routeId }) => {
      if (!routeId) return;
      socket.leave(`route:${routeId}`);
    });

    socket.on('join-bus', ({ busId }) => {
      if (!busId) return;
      socket.join(`bus:${busId}`);
    });

    socket.on('leave-bus', ({ busId }) => {
      if (!busId) return;
      socket.leave(`bus:${busId}`);
    });

    socket.on('join-admin', () => {
      if (socket.user?.role === 'admin' || socket.user?.role === 'superadmin') {
        socket.join('admin');
        logger.debug(`Socket ${socket.id} joined admin room`);
      }
    });


    // ═══════════════════════════════════════════════════════════════════
    // DRIVER: JOIN AS ACTIVE DRIVER
    // ═══════════════════════════════════════════════════════════════════
    /**
     * EVENT: driver-join
     * SENT BY: Driver app, immediately after clicking "Start Trip"
     *          (the REST call to POST /api/trips/start already flipped
     *          the DB state — this socket event is what opens the
     *          real-time GPS pipe for that trip).
     * PAYLOAD: { busId, routeId, tripId }
     *
     * WHY A SEPARATE EVENT FROM gps-update?
     *   This lets the server validate ONCE (is this really an active
     *   driver, on an active trip, for this bus?) and then JOIN the
     *   socket to the right rooms — rather than re-validating on
     *   every single 5-second gps-update ping, which would be wasteful.
     */
    socket.on('driver-join', async ({ busId, routeId, tripId }) => {
      if (!socket.user || socket.user.role !== 'driver') {
        socket.emit('error-message', { message: 'Only authenticated drivers can start GPS sharing.' });
        return;
      }

      try {
        const driver = await Driver.findById(socket.user.id);
        if (!driver || !driver.isOnTrip || driver.currentTrip?.toString() !== tripId) {
          socket.emit('error-message', { message: 'No matching active trip found for this driver.' });
          return;
        }

        // Tag this socket with trip context — every subsequent gps-update
        // from this socket reuses this without re-querying the database.
        socket.driverContext = { busId, routeId, tripId, driverId: socket.user.id };

        socket.join(`bus:${busId}`);
        socket.join(`route:${routeId}`);
        socket.join(`driver:${socket.user.id}`);

        // Warm the route-stops cache for this trip right away, so the
        // FIRST gps-update doesn't pay the cold-cache database cost.
        await getRouteStops(routeId);

        logger.info(`🚍 Driver ${driver.employeeId} joined live tracking for bus ${busId}`);
        socket.emit('driver-join-ack', { success: true });

      } catch (err) {
        logger.error(`driver-join error: ${err.message}`);
        socket.emit('error-message', { message: 'Failed to start GPS sharing.' });
      }
    });


    // ═══════════════════════════════════════════════════════════════════
    // DRIVER: GPS UPDATE  ← THE CORE EVENT OF THE ENTIRE SYSTEM
    // ═══════════════════════════════════════════════════════════════════
    /**
     * EVENT: gps-update
     * SENT BY: Driver app, every 5 seconds while a trip is in progress
     * PAYLOAD: { latitude, longitude, speed (optional), accuracy (optional),
     *            occupancy (optional), heading (optional) }
     *
     * THIS HANDLER DOES SEVEN THINGS, IN ORDER:
     *   1. Validate the socket has an active driverContext (set by driver-join)
     *   2. Calculate speed server-side (fallback/sanity-check vs device GPS)
     *   3. Calculate bearing (direction of travel, for marker rotation)
     *   4. Detect route deviation (>500m from every known route stop)
     *   5. Find nearest stop + remaining-stops count + route completion %
     *   6. Calculate ETA to the NEXT stop ahead
     *   7. Persist GpsLog (history) + update Bus (live cache) + broadcast
     */
    socket.on('gps-update', async (payload) => {
      const ctx = socket.driverContext;
      if (!ctx) {
        socket.emit('error-message', { message: 'GPS update rejected: call driver-join first.' });
        return;
      }

      try {
        const { latitude, longitude, accuracy, occupancy, heading: deviceHeading, speed: deviceSpeed } = payload;

        if (typeof latitude !== 'number' || typeof longitude !== 'number') {
          socket.emit('error-message', { message: 'Invalid GPS coordinates.' });
          return;
        }

        // ── Step 1: Fetch the bus's PREVIOUS known position ─────────────
        const bus = await Bus.findById(ctx.busId);
        if (!bus) return;

        const prevLat = bus.currentLocation.latitude;
        const prevLng = bus.currentLocation.longitude;
        const prevTime = bus.currentLocation.updatedAt;

        // ── Step 2: Calculate speed (server-side fallback/smoothing) ────
        let speed = deviceSpeed;
        if ((speed === undefined || speed === null) && prevLat && prevLng && prevTime) {
          const distanceKm = haversineDistance(prevLat, prevLng, latitude, longitude);
          const timeSeconds = (Date.now() - new Date(prevTime).getTime()) / 1000;
          speed = calculateSpeed(distanceKm, timeSeconds);
        }
        speed = speed || 0;

        // ── Step 3: Calculate bearing for marker rotation ───────────────
        let heading = deviceHeading;
        if ((heading === undefined || heading === null) && prevLat && prevLng) {
          heading = calculateBearing(prevLat, prevLng, latitude, longitude);
        }
        heading = heading || bus.heading || 0;

        // ── Step 4 & 5: Route-aware calculations (deviation, nearest stop) ──
        const routeStops = await getRouteStops(ctx.routeId);
        const { nearestStop, distanceToNearestStop, nearestSequence } = findNearestStop(latitude, longitude, routeStops);
        const offRoute = isOffRoute(latitude, longitude, routeStops, 0.5); // 500m threshold (FR-D08)

        // Only advance lastPassedStopSequence FORWARD — a GPS jitter that
        // momentarily looks closer to an earlier stop shouldn't make the
        // bus appear to go "backwards" in its progress.
        let lastPassedSequence = bus.lastPassedStopSequence;
        if (nearestSequence && distanceToNearestStop < 0.15 && nearestSequence > lastPassedSequence) {
          // Within 150m of a stop counts as "arrived at / passed" that stop
          lastPassedSequence = nearestSequence;
        }

        const remainingStops = routeStops.filter((s) => s.sequence > lastPassedSequence);
        const routeCompletionPercentage = (() => {
          const passedStop = routeStops.find((s) => s.sequence === lastPassedSequence);
          const distanceCovered = passedStop ? passedStop.distanceFromStart : 0;
          const totalDistance = routeStops.length ? routeStops[routeStops.length - 1].distanceFromStart : 0;
          return calculateRouteCompletion(distanceCovered, totalDistance);
        })();

        // ── Step 6: ETA to the very next stop ahead ──────────────────────
        const nextStop = remainingStops[0] || null;
        const etaToNextStop = nextStop
          ? calculateETA(latitude, longitude, nextStop.latitude, nextStop.longitude, speed)
          : null;

        // ── Step 7a: Persist permanent history (GpsLog) ──────────────────
        await GpsLog.create({
          bus: ctx.busId,
          trip: ctx.tripId,
          driver: ctx.driverId,
          latitude,
          longitude,
          speed,
          heading,
          accuracy: accuracy || null,
          occupancyAtTime: occupancy ?? bus.currentOccupancy,
          capturedAt: new Date(),
        });

        // ── Step 7b: Update the Bus document's live cache fields ─────────
        bus.currentLocation = { latitude, longitude, updatedAt: new Date() };
        bus.currentSpeed = speed;
        bus.heading = heading;
        bus.lastPassedStopSequence = lastPassedSequence;
        if (occupancy !== undefined && occupancy !== null) bus.currentOccupancy = occupancy;
        if (offRoute && bus.status !== 'breakdown') bus.status = 'delayed'; // soft signal; admin can investigate
        await bus.save();

        // Track deviation count on the trip for analytics
        if (offRoute) {
          await Trip.findByIdAndUpdate(ctx.tripId, { $inc: { routeDeviationCount: 1 } });
        }

        // ── Step 7c: Broadcast to everyone watching this bus/route ───────
        const broadcastPayload = {
          busId: ctx.busId,
          tripId: ctx.tripId,
          latitude,
          longitude,
          speed,
          heading,
          occupancy: bus.currentOccupancy,
          occupancyPercentage: bus.capacity ? Math.round((bus.currentOccupancy / bus.capacity) * 100) : 0,
          lastPassedStopSequence: lastPassedSequence,
          remainingStopsCount: remainingStops.length,
          routeCompletionPercentage,
          nextStop: nextStop
            ? { stopId: nextStop.stopId, stopName: nextStop.stopName, sequence: nextStop.sequence }
            : null,
          eta: etaToNextStop, // { distanceKm, etaMinutes } or null if at route end
          isOffRoute: offRoute,
          timestamp: new Date().toISOString(),
        };

        io.to(`route:${ctx.routeId}`).to(`bus:${ctx.busId}`).to('admin').emit('bus-position', broadcastPayload);

        // ── Route deviation gets its OWN dedicated event too ─────────────
        // (separate from bus-position so the frontend can trigger a distinct
        // alert/toast without parsing through every routine position update)
        if (offRoute) {
          io.to(`driver:${ctx.driverId}`).to('admin').emit('route-deviation', {
            busId: ctx.busId,
            tripId: ctx.tripId,
            latitude,
            longitude,
            distanceFromRoute: distanceToNearestStop,
          });
        }

      } catch (err) {
        logger.error(`gps-update error: ${err.message}`);
        socket.emit('error-message', { message: 'Failed to process GPS update.' });
      }
    });


    // ═══════════════════════════════════════════════════════════════════
    // DRIVER: EMERGENCY ALERT
    // ═══════════════════════════════════════════════════════════════════
    /**
     * EVENT: emergency-alert
     * SENT BY: Driver app, when the driver presses the emergency button
     * PAYLOAD: { message (optional) }
     * BROADCASTS TO: admin room + the bus's route room (passengers see it too)
     */
    socket.on('emergency-alert', async ({ message }, ack) => {
      const ctx = socket.driverContext;
      if (!ctx) {
        // No active trip context — usually means this driver isn't
        // currently on a trip (or was never assigned a bus, so could
        // never start one). Previously this just silently did nothing
        // while the driver's UI showed a fake success toast regardless.
        if (typeof ack === 'function') {
          ack({ success: false, message: 'You must be on an active trip to send an emergency alert.' });
        }
        return;
      }

      try {
        const driver = await Driver.findById(ctx.driverId).select('name phone');
        const bus = await Bus.findById(ctx.busId).select('busNumber currentLocation');

        await Trip.findByIdAndUpdate(ctx.tripId, { hadEmergency: true });

        const payload = {
          busId: ctx.busId,
          tripId: ctx.tripId,
          driverName: driver?.name,
          driverPhone: driver?.phone,
          busNumber: bus?.busNumber,
          location: bus?.currentLocation,
          message: message || 'Emergency reported by driver.',
          timestamp: new Date().toISOString(),
        };

        io.to('admin').to(`route:${ctx.routeId}`).emit('emergency-alert', payload);
        logger.warn(`🚨 EMERGENCY ALERT: bus ${bus?.busNumber}, driver ${driver?.name}`);
        if (typeof ack === 'function') ack({ success: true });

      } catch (err) {
        logger.error(`emergency-alert error: ${err.message}`);
        if (typeof ack === 'function') ack({ success: false, message: 'Failed to send emergency alert. Please try again.' });
      }
    });


    // ═══════════════════════════════════════════════════════════════════
    // DRIVER: BREAKDOWN REPORT
    // ═══════════════════════════════════════════════════════════════════
    socket.on('breakdown-report', async ({ description }, ack) => {
      const ctx = socket.driverContext;
      if (!ctx) {
        if (typeof ack === 'function') {
          ack({ success: false, message: 'You must be on an active trip to report a breakdown.' });
        }
        return;
      }

      try {
        await Trip.findByIdAndUpdate(ctx.tripId, { hadBreakdown: true });
        await Bus.findByIdAndUpdate(ctx.busId, { status: 'breakdown' });

        io.to('admin').to(`route:${ctx.routeId}`).emit('breakdown-report', {
          busId: ctx.busId,
          tripId: ctx.tripId,
          description: description || 'Breakdown reported by driver.',
          timestamp: new Date().toISOString(),
        });

        logger.warn(`🔧 Breakdown reported: bus ${ctx.busId}`);
        if (typeof ack === 'function') ack({ success: true });
      } catch (err) {
        logger.error(`breakdown-report error: ${err.message}`);
        if (typeof ack === 'function') ack({ success: false, message: 'Failed to report breakdown. Please try again.' });
      }
    });


    // ═══════════════════════════════════════════════════════════════════
    // DISCONNECT
    // ═══════════════════════════════════════════════════════════════════
    /**
     * If a DRIVER's socket disconnects unexpectedly (lost signal, app
     * closed) mid-trip, we do NOT auto-end the trip — a temporary signal
     * drop is normal (e.g. driving through a tunnel) and Socket.IO's
     * client-side auto-reconnect will resume gps-update pings once
     * connectivity returns. The trip only ends via the explicit
     * PATCH /api/trips/:tripId/end REST call (tripController.endTrip).
     * We just log it here for visibility.
     */
    socket.on('disconnect', (reason) => {
      logger.info(`🔌 Socket disconnected: ${socket.id} (${reason})`);
      if (socket.driverContext) {
        logger.info(`   ↳ Driver ${socket.driverContext.driverId} GPS sharing paused (bus ${socket.driverContext.busId})`);
      }
    });
  });
};

module.exports = initializeSocket;
