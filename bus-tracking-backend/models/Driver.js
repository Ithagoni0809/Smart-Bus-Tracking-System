/**
 * models/Driver.js
 * ─────────────────────────────────────────────────────────────
 * WHY SEPARATE FROM USER?
 *   Drivers have completely different fields (license, employeeId,
 *   currentBus, tripStatus) that don't belong in the passenger User model.
 *   Separate collections = cleaner queries and smaller documents.
 *
 * RELATIONSHIPS:
 *   Driver → Bus     (one-to-one: a driver is assigned to one bus at a time)
 *   Driver → Trip    (one-to-many: a driver can have many trips)
 *
 * WHO CREATES DRIVERS?
 *   ONLY admins can create driver accounts. Drivers cannot self-register.
 *   The admin sets their initial password and shares credentials with them.
 * ─────────────────────────────────────────────────────────────
 */

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const driverSchema = new mongoose.Schema(
  {
    // ── Identity ─────────────────────────────────────────────────────────────
    name: {
      type: String,
      required: [true, 'Driver name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Invalid email'],
    },

    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      match: [/^[6-9]\d{9}$/, 'Invalid 10-digit Indian mobile number'],
    },

    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },

    // Role is always 'driver' — hardcoded for safety
    role: {
      type: String,
      default: 'driver',
      immutable: true, // Cannot be changed after creation
    },

    // ── Professional Details ──────────────────────────────────────────────────
    employeeId: {
      type: String,
      required: [true, 'Employee ID is required'],
      unique: true,
      uppercase: true,  // e.g., "EMP001"
      trim: true,
    },

    licenseNumber: {
      type: String,
      required: [true, 'Driver license number is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },

    licenseExpiry: {
      type: Date,
      required: [true, 'License expiry date is required'],
    },

    // ── Assignment (Populated from Bus collection) ────────────────────────────
    // Which bus is this driver currently assigned to?
    // null = not assigned to any bus yet
    assignedBus: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bus',
      default: null,
    },

    // Which route is this driver currently driving?
    assignedRoute: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Route',
      default: null,
    },

    // ── Trip Status ───────────────────────────────────────────────────────────
    // Is the driver currently on an active trip?
    isOnTrip: {
      type: Boolean,
      default: false,
    },

    // The current trip they're running (if isOnTrip is true)
    currentTrip: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip',
      default: null,
    },

    // ── Live Location ─────────────────────────────────────────────────────────
    // The most recent GPS coordinates received from this driver
    // Updated every 5 seconds when on a trip
    lastKnownLocation: {
      latitude: {
        type: Number,
        min: [-90, 'Latitude must be between -90 and 90'],
        max: [90, 'Latitude must be between -90 and 90'],
        default: null,
      },
      longitude: {
        type: Number,
        min: [-180, 'Longitude must be between -180 and 180'],
        max: [180, 'Longitude must be between -180 and 180'],
        default: null,
      },
      updatedAt: {
        type: Date,
        default: null,
      },
    },

    // ── Statistics ────────────────────────────────────────────────────────────
    totalTrips: {
      type: Number,
      default: 0,
    },

    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
      set: (val) => Math.round(val * 10) / 10, // Round to 1 decimal: 4.567 → 4.6
    },

    totalRatings: {
      type: Number,
      default: 0,
    },

    // ── Account Status ────────────────────────────────────────────────────────
    isActive: {
      type: Boolean,
      default: true,  // Admin can deactivate driver accounts
    },

    // Track when admin created this account
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // Reference to the Admin who created this driver
      required: true,
    },

    // Password reset fields (same pattern as User model)
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
driverSchema.index({ employeeId: 1 });
driverSchema.index({ isActive: 1 });
driverSchema.index({ isOnTrip: 1 });       // Quick query: "how many drivers are on a trip?"
driverSchema.index({ assignedBus: 1 });    // Quick lookup: "which driver is on bus X?"

// ── Virtual: Is license expired? ─────────────────────────────────────────────
driverSchema.virtual('isLicenseExpired').get(function () {
  return this.licenseExpiry < new Date();
});

// ── Pre-Save Middleware ───────────────────────────────────────────────────────
driverSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ── Instance Methods ──────────────────────────────────────────────────────────
driverSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// ── Static Methods ────────────────────────────────────────────────────────────
// Called on the Model itself, not an instance: Driver.getActiveDrivers()
driverSchema.statics.getActiveDrivers = function () {
  return this.find({ isActive: true, isOnTrip: true })
    .populate('assignedBus', 'busNumber vehicleNumber')
    .populate('assignedRoute', 'routeNumber routeName');
};

const Driver = mongoose.model('Driver', driverSchema);
module.exports = Driver;
