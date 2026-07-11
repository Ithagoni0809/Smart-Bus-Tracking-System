/**
 * models/Route.js
 * ─────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS:
 *   A Route defines a fixed path a bus follows: a source, a
 *   destination, and an ORDERED list of stops in between.
 *
 * WHY EMBED STOP ORDER HERE INSTEAD OF JUST REFERENCING Stop IDs?
 *   The order stops appear on a route, AND the expected time to reach
 *   each stop, is specific to THIS route — not a property of the Stop
 *   itself (the same physical stop might be stop #3 on one route and
 *   stop #9 on another). So we store an array of sub-documents that
 *   pair a Stop reference with route-specific data (sequence, ETA offset).
 *
 * RELATIONSHIPS:
 *   Route → Stop  (many-to-many via the `stops` array of sub-documents)
 *   Route → Bus   (one-to-many: many buses can run the same route)
 *   Route → Trip  (one-to-many: many trips happen on this route over time)
 * ─────────────────────────────────────────────────────────────
 */

const mongoose = require('mongoose');

// ── Sub-schema: RouteStop ───────────────────────────────────────────────────
// This is NOT a separate collection. It's an embedded document that lives
// inside the `stops` array of a Route document. It pairs a reference to the
// Stop collection with data specific to this route (sequence + timing).
const routeStopSchema = new mongoose.Schema(
  {
    stop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Stop',
      required: true,
    },
    // Order in which this stop appears on the route: 1, 2, 3...
    sequence: {
      type: Number,
      required: true,
      min: [1, 'Sequence must start at 1'],
    },
    // Minutes from route start when bus is EXPECTED to reach this stop
    expectedTimeFromStart: {
      type: Number,
      required: true,
      min: 0,
    },
    // Distance (km) from route start to this stop
    distanceFromStart: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false } // No need for a separate _id on each sub-document
);

const routeSchema = new mongoose.Schema(
  {
    routeNumber: {
      type: String,
      required: [true, 'Route number is required'],
      unique: true,
      uppercase: true,
      trim: true, // e.g., "216K", "10H"
    },

    routeName: {
      type: String,
      required: [true, 'Route name is required'],
      trim: true, // e.g., "Secunderabad to Hitech City"
    },

    source: {
      type: String,
      required: [true, 'Source location is required'],
      trim: true,
    },

    destination: {
      type: String,
      required: [true, 'Destination location is required'],
      trim: true,
    },

    // ── Ordered Stops ──────────────────────────────────────────────────────
    stops: {
      type: [routeStopSchema],
      validate: {
        validator: function (stops) {
          return stops.length >= 2; // A route needs at least source + destination
        },
        message: 'A route must have at least 2 stops',
      },
    },

    totalDistance: {
      type: Number,
      required: [true, 'Total distance is required'],
      min: [0.1, 'Distance must be greater than 0'],
      // In kilometres
    },

    expectedDuration: {
      type: Number,
      required: [true, 'Expected duration is required'],
      min: [1, 'Duration must be at least 1 minute'],
      // In minutes
    },

    fare: {
      type: Number,
      required: [true, 'Fare is required'],
      min: [0, 'Fare cannot be negative'],
    },

    // ── Route Polyline (for drawing the path on the map) ──────────────────
    // An ordered array of [lat, lng] pairs that traces the road path,
    // NOT just straight lines between stops. Generated once via a routing
    // service (e.g., OSRM) and cached here.
    polyline: {
      type: [[Number]], // Array of [lat, lng] pairs
      default: [],
    },

    routeType: {
      type: String,
      enum: ['city', 'intercity', 'express', 'metro-feeder'],
      default: 'city',
    },

    operatingDays: {
      type: [String],
      enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      default: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    },

    firstBusTime: {
      type: String, // Stored as "HH:MM" 24-hour format string
      default: '05:00',
    },

    lastBusTime: {
      type: String,
      default: '22:00',
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
routeSchema.index({ routeNumber: 1 });
routeSchema.index({ source: 1, destination: 1 }); // Speeds up route search by source/destination
routeSchema.index({ isActive: 1 });
// Text index enables full-text search across routeName, source, destination
routeSchema.index({ routeName: 'text', source: 'text', destination: 'text' });

// ── Virtual: Total Stop Count ───────────────────────────────────────────────
// NOTE: `stops` is often intentionally excluded via .select() (e.g. list views)
// or absent on a populated sub-document (e.g. Bus.populate('assignedRoute', 'routeNumber routeName')).
// In both cases `this.stops` is undefined, so guard against that instead of
// crashing every request that touches a partially-selected Route document.
routeSchema.virtual('stopCount').get(function () {
  return this.stops ? this.stops.length : undefined;
});

// ── Instance Method: Get stop sequence by Stop ID ───────────────────────────
routeSchema.methods.getStopSequence = function (stopId) {
  const found = this.stops.find((s) => s.stop.toString() === stopId.toString());
  return found ? found.sequence : null;
};

const Route = mongoose.model('Route', routeSchema);
module.exports = Route;
