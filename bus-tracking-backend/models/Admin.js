/**
 * models/Admin.js
 * ─────────────────────────────────────────────────────────────
 * WHY SEPARATE FROM USER?
 *   Admins manage the entire system (buses, routes, drivers, users).
 *   Keeping them in their own collection means passenger queries
 *   (e.g. "list all users") never accidentally include admin accounts,
 *   and admin-specific fields (permissions, department) stay isolated.
 *
 * WHO CREATES ADMINS?
 *   In v1.0, admin accounts are seeded directly into the database
 *   (via a seed script) or created by an existing "superadmin".
 *   There is no public registration route for admins — this is
 *   intentional and critical for security.
 *
 * RELATIONSHIPS:
 *   Admin → Driver  (one-to-many: admin creates/manages many drivers)
 *   Admin → Bus     (one-to-many: admin adds/manages many buses)
 *   Admin → Route   (one-to-many: admin creates/manages many routes)
 * ─────────────────────────────────────────────────────────────
 */

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');

const adminSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
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
      match: [/^[6-9]\d{9}$/, 'Invalid 10-digit Indian mobile number'],
    },

    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },

    role: {
      type: String,
      enum: {
        values: ['admin', 'superadmin'],
        message: 'Role must be admin or superadmin',
      },
      default: 'admin',
    },

    // ── Permissions (Future-proofing for granular access control) ─────────────
    // Even though v1.0 treats all admins equally, this lets you later restrict
    // specific admins to specific capabilities without a schema migration.
    permissions: {
      canManageBuses: { type: Boolean, default: true },
      canManageRoutes: { type: Boolean, default: true },
      canManageDrivers: { type: Boolean, default: true },
      canManageUsers: { type: Boolean, default: true },
      canViewAnalytics: { type: Boolean, default: true },
      canBroadcastNotifications: { type: Boolean, default: true },
    },

    department: {
      type: String,
      default: 'Operations',
      trim: true,
    },

    profilePhoto: {
      type: String,
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    lastLogin: {
      type: Date,
      default: null,
    },

    // Password reset fields (same pattern as User and Driver)
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
adminSchema.index({ role: 1 });
adminSchema.index({ isActive: 1 });

// ── Pre-Save Middleware ───────────────────────────────────────────────────────
adminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ── Instance Methods ──────────────────────────────────────────────────────────
adminSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

adminSchema.methods.createPasswordResetToken = function () {
  const rawToken = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  return rawToken;
};

const Admin = mongoose.model('Admin', adminSchema);
module.exports = Admin;
