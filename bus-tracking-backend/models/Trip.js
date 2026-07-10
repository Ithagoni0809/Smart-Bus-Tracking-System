/**
 * models/Trip.js
 * ─────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS:
 *   A Trip is a single journey: from when a driver clicks "Start Trip"
 *   to when they click "End Trip". This is the central record tying
 *   together a Bus, a Driver, a Route, and a time window.
 *
 *   Trips are what make analytics possible: average delay per route,
 *   total trips per day, driver performance, etc.
 *
 * RELATIONSHIPS:
 *   Trip → Bus     (many-to-one: many trips happen on the same bus over time)
 *   Trip → Driver  (many-to-one: many trips driven by the same driver over time)
 *   Trip → Route   (many-to-one: many trips happen on the same route over time)
 *   Trip → GpsLog  (one-to-many: a trip has many GPS pings during its lifetime)
 *   Trip → Review  (one-to-many: passengers can review a specific trip)
 * ─────────────────────────────────────────────────────────────
 */

const mongoose = require('mongoose');

const tripSchema = new mongoose.Schema(
  {
    bus: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bus',
      required: [true, 'Trip must belong to a bus'],
    },

    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
      required: [true, 'Trip must have a driver'],
    },

    route: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Route',
      required: [true, 'Trip must belong to a route'],
    },

    // ── Timing ──────────────────────────────────────────────────────────────
    scheduledStartTime: {
      type: Date,
      required: true,
    },

    actualStartTime: {
      type: Date,
      default: null, // Set when driver actually clicks "Start Trip"
    },

    scheduledEndTime: {
      type: Date,
      required: true,
    },

    actualEndTime: {
      type: Date,
      default: null, // Set when driver clicks "End Trip"
    },

    // ── Status ──────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: {
        values: ['scheduled', 'in-progress', 'completed', 'cancelled', 'breakdown'],
        message: 'Invalid trip status',
      },
      default: 'scheduled',
    },

    // ── Delay Tracking ──────────────────────────────────────────────────────
    delayMinutes: {
      type: Number,
      default: 0, // Calculated: actualEndTime - scheduledEndTime, in minutes
    },

    // ── Passenger Metrics ───────────────────────────────────────────────────
    maxOccupancyRecorded: {
      type: Number,
      default: 0,
    },

    // ── Distance & Performance ──────────────────────────────────────────────
    totalDistanceCovered: {
      type: Number, // km, calculated by summing GPS log segments
      default: 0,
    },

    averageSpeed: {
      type: Number, // km/h
      default: 0,
    },

    // ── Incident Tracking ────────────────────────────────────────────────────
    hadEmergency: {
      type: Boolean,
      default: false,
    },

    hadBreakdown: {
      type: Boolean,
      default: false,
    },

    routeDeviationCount: {
      type: Number,
      default: 0, // Number of times bus went >500m off-route
    },

    // ── Last Position at End of Trip (for record-keeping) ──────────────────
    endLocation: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
    },

    cancellationReason: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
tripSchema.index({ bus: 1, createdAt: -1 });    // "Show trip history for bus X, newest first"
tripSchema.index({ driver: 1, createdAt: -1 }); // "Show trip history for driver X"
tripSchema.index({ route: 1 });                  // "Show all trips on route X" (for analytics)
tripSchema.index({ status: 1 });                 // "Show all in-progress trips"
tripSchema.index({ actualStartTime: 1 });        // Date-range queries for analytics

// ── Instance Method: Calculate Delay ────────────────────────────────────────
tripSchema.methods.calculateDelay = function () {
  if (!this.actualEndTime || !this.scheduledEndTime) return 0;
  const diffMs = this.actualEndTime - this.scheduledEndTime;
  return Math.round(diffMs / (1000 * 60)); // Convert ms → minutes
};

const Trip = mongoose.model('Trip', tripSchema);
module.exports = Trip;
