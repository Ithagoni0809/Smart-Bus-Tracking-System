/**
 * models/GpsLog.js
 * ─────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS:
 *   Every single GPS ping (sent every 5 seconds by an active driver)
 *   is recorded here. This is by far the HIGHEST VOLUME collection
 *   in the system — a single 1-hour trip generates ~720 documents.
 *
 * WHY A TTL (TIME-TO-LIVE) INDEX?
 *   We don't need GPS pings from 2 months ago for live tracking.
 *   Keeping them forever would blow past MongoDB Atlas's free tier
 *   storage limit (512MB) very quickly. A TTL index tells MongoDB:
 *   "automatically delete documents X seconds after the timestamp
 *   in this field" — so old logs clean themselves up with zero
 *   custom cron jobs or manual deletion code.
 *
 * RELATIONSHIPS:
 *   GpsLog → Bus   (many-to-one: many GPS pings belong to one bus)
 *   GpsLog → Trip  (many-to-one: many GPS pings belong to one trip)
 * ─────────────────────────────────────────────────────────────
 */

const mongoose = require('mongoose');

const gpsLogSchema = new mongoose.Schema(
  {
    bus: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bus',
      required: [true, 'GPS log must belong to a bus'],
    },

    trip: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip',
      required: [true, 'GPS log must belong to a trip'],
    },

    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
      required: [true, 'GPS log must record which driver sent it'],
    },

    latitude: {
      type: Number,
      required: [true, 'Latitude is required'],
      min: -90,
      max: 90,
    },

    longitude: {
      type: Number,
      required: [true, 'Longitude is required'],
      min: -180,
      max: 180,
    },

    speed: {
      type: Number, // km/h, calculated client-side or server-side from consecutive points
      default: 0,
      min: 0,
    },

    heading: {
      type: Number, // Direction of travel, 0-360 degrees
      default: 0,
      min: 0,
      max: 360,
    },

    accuracy: {
      type: Number, // GPS accuracy radius in metres (from browser Geolocation API)
      default: null,
    },

    occupancyAtTime: {
      type: Number, // Snapshot of occupancy when this ping was sent
      default: 0,
    },

    // The exact moment the GPS coordinate was captured on the device
    capturedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true, // createdAt = when the SERVER received it (vs capturedAt = when DEVICE recorded it)
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────

// Compound index: "get all GPS points for trip X, in chronological order"
// This is the exact query used to redraw a trip's path for replay/analytics
gpsLogSchema.index({ trip: 1, capturedAt: 1 });

// "get the most recent GPS points for bus X"
gpsLogSchema.index({ bus: 1, capturedAt: -1 });

// ── TTL INDEX — THE MOST IMPORTANT INDEX IN THIS SCHEMA ─────────────────────
// expireAfterSeconds: 2592000 = 30 days (30 * 24 * 60 * 60)
// MongoDB runs a background task every 60 seconds that deletes any document
// where (current time - createdAt) > 2592000 seconds.
// This keeps the collection from growing unbounded.
gpsLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

const GpsLog = mongoose.model('GpsLog', gpsLogSchema);
module.exports = GpsLog;
