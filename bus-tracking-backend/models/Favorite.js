/**
 * models/Favorite.js
 * ─────────────────────────────────────────────────────────────
 * WHY A SEPARATE COLLECTION INSTEAD OF JUST THE `favourites` ARRAY ON USER?
 *   The User model already has a `favourites: [ObjectId ref Route]` array,
 *   which is fine for a SIMPLE "save this route" feature. But a dedicated
 *   Favorite collection becomes necessary the moment you want to:
 *     - Favorite a SPECIFIC bus (not just a route)
 *     - Store metadata about WHY it's a favourite (e.g. custom nickname,
 *       "morning commute", notification preference per favourite)
 *     - Query "who has favourited bus X" efficiently (impossible to index
 *       efficiently if it's buried inside arrays on millions of User docs)
 *
 *   This SRS/architecture asks for a distinct `Favorites` collection, so
 *   we model it as first-class: a join entity between User and (Route | Bus).
 *
 * RELATIONSHIPS:
 *   Favorite → User   (many-to-one)
 *   Favorite → Route  (many-to-one, optional)
 *   Favorite → Bus    (many-to-one, optional)
 * ─────────────────────────────────────────────────────────────
 */

const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Favorite must belong to a user'],
    },

    // A favourite is EITHER a route OR a specific bus — at least one required
    route: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Route',
      default: null,
    },

    bus: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bus',
      default: null,
    },

    // User-defined label, e.g. "Morning Commute", "College Route"
    nickname: {
      type: String,
      trim: true,
      maxlength: [50, 'Nickname cannot exceed 50 characters'],
      default: '',
    },

    // Per-favourite notification toggle (some favourites you want alerts for, others not)
    notifyOnArrival: {
      type: Boolean,
      default: true,
    },

    notifyOnDelay: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// ── Validation: must reference EITHER a route OR a bus (not neither) ───────
favoriteSchema.pre('validate', function (next) {
  if (!this.route && !this.bus) {
    return next(new Error('A favourite must reference either a route or a bus'));
  }
  next();
});

// ── Indexes ───────────────────────────────────────────────────────────────────
// Prevent the same user from favouriting the same route twice
favoriteSchema.index({ user: 1, route: 1 }, { unique: true, partialFilterExpression: { route: { $type: 'objectId' } } });
// Prevent the same user from favouriting the same bus twice
favoriteSchema.index({ user: 1, bus: 1 }, { unique: true, partialFilterExpression: { bus: { $type: 'objectId' } } });
// "Get all favourites for user X" — the most common query (passenger's favourites page)
favoriteSchema.index({ user: 1, createdAt: -1 });

const Favorite = mongoose.model('Favorite', favoriteSchema);
module.exports = Favorite;
