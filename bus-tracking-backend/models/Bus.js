/**
 * models/Bus.js
 * ─────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS:
 *   Represents a physical bus vehicle. This is the MOST frequently
 *   updated document in the entire system — its location fields
 *   change every 5 seconds while the bus is on a trip.
 *
 * WHY STORE currentLocation HERE INSTEAD OF ONLY IN GpsLog?
 *   GpsLog stores the full HISTORY of every GPS ping (for analytics,
 *   replay, and audit). But when a passenger opens the live map, we
 *   need the bus's LATEST position FAST, without scanning the entire
 *   GpsLog history. So we denormalize: store the latest position
 *   directly on the Bus document for instant reads, while GpsLog
 *   keeps the full trail.
 *
 * RELATIONSHIPS:
 *   Bus → Route   (many-to-one: many buses can be assigned to the same route over time,
 *                   but each bus has exactly ONE current route assignment)
 *   Bus → Driver  (one-to-one: one driver per bus at a time)
 *   Bus → Trip    (one-to-many: a bus has many trips over its lifetime)
 * ─────────────────────────────────────────────────────────────
 */

const mongoose = require('mongoose');

const busSchema = new mongoose.Schema(
  {
    busNumber: {
      type: String,
      required: [true, 'Bus number is required'],
      unique: true,
      uppercase: true,
      trim: true, // Official bus number, e.g., "AP39Z-1234"
    },

    vehicleNumber: {
      type: String,
      required: [true, 'Vehicle registration number is required'],
      unique: true,
      uppercase: true,
      trim: true, // RTA registration plate, e.g., "TS09EA1234"
    },

    capacity: {
      type: Number,
      required: [true, 'Bus capacity is required'],
      min: [1, 'Capacity must be at least 1'],
      max: [100, 'Capacity seems unrealistic — check value'],
    },

    busType: {
      type: String,
      enum: ['ordinary', 'express', 'deluxe', 'ac', 'metro-luxury'],
      default: 'ordinary',
    },

    // ── Assignment ─────────────────────────────────────────────────────────
    assignedRoute: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Route',
      default: null,
    },

    assignedDriver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
      default: null,
    },

    // ── Live Trip State ────────────────────────────────────────────────────
    isActive: {
      type: Boolean,
      default: false, // true ONLY while a trip is in progress
    },

    currentTrip: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip',
      default: null,
    },

    // ── Live GPS Position ──────────────────────────────────────────────────
    currentLocation: {
      latitude: {
        type: Number,
        min: -90,
        max: 90,
        default: null,
      },
      longitude: {
        type: Number,
        min: -180,
        max: 180,
        default: null,
      },
      updatedAt: {
        type: Date,
        default: null,
      },
    },

    currentSpeed: {
      type: Number, // km/h
      default: 0,
      min: 0,
    },

    heading: {
      type: Number, // Direction of travel in degrees (0-360, 0 = North)
      default: 0,
      min: 0,
      max: 360,
    },

    currentOccupancy: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ── Stop Progress Tracking ─────────────────────────────────────────────
    // Which stop (by sequence number on the route) the bus most recently passed
    lastPassedStopSequence: {
      type: Number,
      default: 0,
    },

    // ── Status ──────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: {
        values: ['idle', 'active', 'delayed', 'breakdown', 'maintenance'],
        message: 'Invalid bus status',
      },
      default: 'idle',
    },

    // ── Maintenance ─────────────────────────────────────────────────────────
    lastServiceDate: {
      type: Date,
      default: null,
    },

    nextServiceDue: {
      type: Date,
      default: null,
    },

    // ── Statistics ──────────────────────────────────────────────────────────
    totalTrips: {
      type: Number,
      default: 0,
    },

    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
      set: (val) => Math.round(val * 10) / 10,
    },

    totalRatings: {
      type: Number,
      default: 0,
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
busSchema.index({ busNumber: 1 });
busSchema.index({ assignedRoute: 1 });   // "Show all buses on route X"
busSchema.index({ isActive: 1 });        // "Show all currently live buses" — used VERY frequently
busSchema.index({ status: 1 });
// Compound index: queries that filter by route AND active status together
// (this is the exact query the Live Map page runs)
busSchema.index({ assignedRoute: 1, isActive: 1 });

// ── Virtual: Occupancy Percentage ───────────────────────────────────────────
busSchema.virtual('occupancyPercentage').get(function () {
  if (!this.capacity) return 0;
  return Math.round((this.currentOccupancy / this.capacity) * 100);
});

// ── Virtual: Occupancy Level (for color-coded UI badges) ───────────────────
busSchema.virtual('occupancyLevel').get(function () {
  const pct = this.capacity ? (this.currentOccupancy / this.capacity) * 100 : 0;
  if (pct >= 100) return 'full';
  if (pct >= 75)  return 'high';
  if (pct >= 40)  return 'medium';
  return 'low';
});

const Bus = mongoose.model('Bus', busSchema);
module.exports = Bus;
