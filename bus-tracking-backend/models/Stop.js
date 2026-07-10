/**
 * models/Stop.js
 * ─────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS:
 *   A "Stop" is a physical bus stop with a fixed GPS location.
 *   Stops are created once by admin and then referenced (not
 *   duplicated) inside many different Routes.
 *
 * WHY A SEPARATE COLLECTION INSTEAD OF EMBEDDING IN ROUTE?
 *   The same physical stop (e.g., "Ameerpet X Roads") is shared
 *   across MANY different routes. If we embedded stop data directly
 *   inside each route document, updating that stop's GPS coordinates
 *   would require updating it in every route — a data integrity risk.
 *   Storing stops separately and referencing by ObjectId means: update once,
 *   reflected everywhere.
 *
 * GEOSPATIAL INDEXING:
 *   We use MongoDB's native 2dsphere index, which allows queries like
 *   "find all stops within 2km of my GPS position" — essential for
 *   the "nearby stops" passenger feature.
 *
 * RELATIONSHIPS:
 *   Stop ←→ Route (many-to-many: a stop can appear on many routes,
 *                   a route has many stops)
 * ─────────────────────────────────────────────────────────────
 */

const mongoose = require('mongoose');

const stopSchema = new mongoose.Schema(
  {
    stopName: {
      type: String,
      required: [true, 'Stop name is required'],
      trim: true,
      maxlength: [100, 'Stop name cannot exceed 100 characters'],
    },

    // Human-readable code shown on boards (e.g., "AMP-01")
    stopCode: {
      type: String,
      required: [true, 'Stop code is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },

    // ── GeoJSON Location (required format for MongoDB geospatial queries) ─────
    // MongoDB requires this EXACT structure for 2dsphere indexing:
    // { type: 'Point', coordinates: [longitude, latitude] }
    // NOTE: GeoJSON order is [lng, lat] — opposite of how we usually say "lat, lng"!
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: [true, 'Coordinates are required'],
        validate: {
          validator: function (coords) {
            return (
              coords.length === 2 &&
              coords[0] >= -180 && coords[0] <= 180 && // longitude range
              coords[1] >= -90  && coords[1] <= 90      // latitude range
            );
          },
          message: 'Coordinates must be [longitude, latitude] within valid ranges',
        },
      },
    },

    address: {
      type: String,
      trim: true,
      default: '',
    },

    landmark: {
      type: String,
      trim: true,
      default: '',  // e.g., "Near Apollo Hospital"
    },

    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
    },

    // Facilities available at this stop (helps passengers plan)
    facilities: {
      hasShelter: { type: Boolean, default: false },
      hasSeating: { type: Boolean, default: false },
      hasDigitalDisplay: { type: Boolean, default: false },
      isWheelchairAccessible: { type: Boolean, default: false },
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
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
// 2dsphere index enables geospatial queries: $near, $geoWithin, etc.
// This is what powers "find stops near me" functionality.
stopSchema.index({ location: '2dsphere' });
stopSchema.index({ stopCode: 1 });
stopSchema.index({ city: 1 });

const Stop = mongoose.model('Stop', stopSchema);
module.exports = Stop;
