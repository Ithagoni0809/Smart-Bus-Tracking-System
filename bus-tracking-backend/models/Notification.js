/**
 * models/Notification.js
 * ─────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS:
 *   Stores every notification sent to a passenger so they have a
 *   persistent notification history/inbox (not just a toast that
 *   disappears). Also used to track read/unread state.
 *
 * RELATIONSHIPS:
 *   Notification → User  (many-to-one: many notifications belong to one user)
 *   Notification → Bus   (many-to-one: optionally tied to a specific bus)
 *   Notification → Route (many-to-one: optionally tied to a specific route)
 * ─────────────────────────────────────────────────────────────
 */

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Notification must have a recipient'],
    },

    type: {
      type: String,
      enum: {
        values: [
          'bus-arriving',
          'bus-delayed',
          'bus-cancelled',
          'emergency-alert',
          'route-changed',
          'trip-started',
          'general',
        ],
        message: 'Invalid notification type',
      },
      required: [true, 'Notification type is required'],
    },

    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },

    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
      maxlength: [500, 'Message cannot exceed 500 characters'],
    },

    // ── Related Entities (Optional context) ────────────────────────────────
    relatedBus: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bus',
      default: null,
    },

    relatedRoute: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Route',
      default: null,
    },

    relatedTrip: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip',
      default: null,
    },

    // ── State ───────────────────────────────────────────────────────────────
    isRead: {
      type: Boolean,
      default: false,
    },

    readAt: {
      type: Date,
      default: null,
    },

    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'critical'],
      default: 'normal',
      // 'critical' is used for emergency-alert type
    },
  },
  {
    timestamps: true,
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
// Compound index: "get all unread notifications for user X, newest first"
// This is the exact query the notification bell icon runs
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

// Auto-delete notifications older than 90 days to keep collection lean
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 days

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;
