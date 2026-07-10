/**
 * models/Review.js
 * ─────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS:
 *   Passengers rate a trip after travelling (1-5 stars + optional comment).
 *   These reviews feed into the Bus.averageRating and Driver.averageRating
 *   fields, giving admins a quality signal per vehicle and per driver.
 *
 * WHY LINK A REVIEW TO A SPECIFIC TRIP (NOT JUST A BUS)?
 *   Linking to the Trip means we know EXACTLY which journey is being
 *   rated — preventing duplicate reviews for the same ride and allowing
 *   "did this user actually travel on this trip?" validation.
 *
 * RELATIONSHIPS:
 *   Review → User   (many-to-one: a user can write many reviews, over time)
 *   Review → Trip   (one-to-one per user: one review per user per trip)
 *   Review → Bus    (many-to-one: denormalized for fast bus-rating queries)
 *   Review → Driver (many-to-one: denormalized for fast driver-rating queries)
 * ─────────────────────────────────────────────────────────────
 */

const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Review must belong to a user'],
    },

    trip: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip',
      required: [true, 'Review must be linked to a trip'],
    },

    // Denormalized references — stored directly here (in addition to via Trip)
    // so we can run "average rating for bus X" without an extra lookup through Trip.
    bus: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bus',
      required: true,
    },

    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
      required: true,
    },

    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
    },

    comment: {
      type: String,
      trim: true,
      maxlength: [500, 'Comment cannot exceed 500 characters'],
      default: '',
    },

    // Specific aspect ratings (optional, more granular feedback)
    aspectRatings: {
      cleanliness: { type: Number, min: 1, max: 5, default: null },
      punctuality: { type: Number, min: 1, max: 5, default: null },
      driverBehavior: { type: Number, min: 1, max: 5, default: null },
    },

    isFlagged: {
      type: Boolean,
      default: false, // For moderation: admin can flag inappropriate reviews
    },
  },
  {
    timestamps: true,
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
// Prevents the SAME user from reviewing the SAME trip twice (data integrity)
reviewSchema.index({ user: 1, trip: 1 }, { unique: true });

// "Get all reviews for bus X, newest first" — used on Bus Details page
reviewSchema.index({ bus: 1, createdAt: -1 });

// "Get all reviews for driver X" — used in driver performance analytics
reviewSchema.index({ driver: 1 });

// ── Static Method: Recalculate average rating for a Bus ────────────────────
// Called automatically after a review is saved (see post-save hook below)
reviewSchema.statics.calculateAverageRating = async function (busId) {
  // mongoose aggregation pipeline: group all reviews for this bus, compute avg
  const stats = await this.aggregate([
    { $match: { bus: busId } },
    {
      $group: {
        _id: '$bus',
        averageRating: { $avg: '$rating' },
        totalRatings: { $sum: 1 },
      },
    },
  ]);

  const Bus = mongoose.model('Bus');
  if (stats.length > 0) {
    await Bus.findByIdAndUpdate(busId, {
      averageRating: stats[0].averageRating,
      totalRatings: stats[0].totalRatings,
    });
  } else {
    await Bus.findByIdAndUpdate(busId, { averageRating: 0, totalRatings: 0 });
  }
};

// ── Post-Save Hook: Auto-update Bus rating whenever a review is created ────
reviewSchema.post('save', function () {
  this.constructor.calculateAverageRating(this.bus);
});

const Review = mongoose.model('Review', reviewSchema);
module.exports = Review;
