/**
 * models/User.js
 * ─────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS:
 *   Defines the structure of a "passenger" account in MongoDB.
 *   Every document in the `users` collection follows this schema.
 *
 * RELATIONSHIPS:
 *   User → Route     (many-to-many via favourites array)
 *   User → Review    (one-to-many: a user can write many reviews)
 *   User → Notification (one-to-many)
 *
 * INDEXING STRATEGY:
 *   email — unique index: fastest lookup for login
 *   phone — index: used for search and duplicate check
 *   role  — index: used for admin queries filtering by role
 * ─────────────────────────────────────────────────────────────
 */

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');

const userSchema = new mongoose.Schema(
  {
    // ── Identity Fields ─────────────────────────────────────────────────────
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,                    // Remove leading/trailing whitespace
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,                  // Creates a unique index automatically
      lowercase: true,               // Always store in lowercase: "USER@mail.com" → "user@mail.com"
      trim: true,
      // Regex validates email format. Explains: has chars @ has chars . has chars
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email'],
    },

    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      match: [/^[6-9]\d{9}$/, 'Please enter a valid 10-digit Indian mobile number'],
      // India mobile numbers start with 6, 7, 8, or 9
    },

    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      // select: false means password is NOT returned in any query by default
      // We must explicitly request it: User.findOne({}).select('+password')
      select: false,
    },

    // ── Role & Access ───────────────────────────────────────────────────────
    role: {
      type: String,
      enum: {
        values: ['passenger', 'admin'],
        message: 'Role must be either passenger or admin',
      },
      default: 'passenger', // New registrations are passengers by default
    },

    // ── Email Verification ──────────────────────────────────────────────────
    isEmailVerified: {
      type: Boolean,
      default: false,  // False until user clicks the verification link
    },

    emailVerificationToken: {
      type: String,
      select: false,   // Never returned in queries (security)
    },

    emailVerificationExpires: {
      type: Date,
      select: false,
    },

    // ── Password Reset ──────────────────────────────────────────────────────
    passwordResetToken: {
      type: String,
      select: false,   // Never returned in queries
    },

    passwordResetExpires: {
      type: Date,
      select: false,
    },

    // ── Profile ─────────────────────────────────────────────────────────────
    profilePhoto: {
      type: String,
      default: null,  // URL to profile photo (stored on cloud storage)
    },

    // ── Favourites (Many-to-Many with Route) ────────────────────────────────
    // An array of Route _id references
    // A passenger can save multiple routes as favourites
    favourites: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Route',  // Tells Mongoose this references the Route collection
      },
    ],

    // ── Preferences ─────────────────────────────────────────────────────────
    preferences: {
      darkMode: {
        type: Boolean,
        default: false,
      },
      language: {
        type: String,
        enum: ['en', 'te', 'kn', 'ta', 'hi'],  // Supported languages
        default: 'en',
      },
      notificationsEnabled: {
        type: Boolean,
        default: true,
      },
    },

    // ── Account Status ───────────────────────────────────────────────────────
    isActive: {
      type: Boolean,
      default: true,   // Admin can deactivate accounts
    },

    // Track the last time the user logged in (for analytics + security)
    lastLogin: {
      type: Date,
      default: null,
    },
  },
  {
    // ── Schema Options ───────────────────────────────────────────────────────
    timestamps: true,  // Automatically adds createdAt and updatedAt fields
    toJSON: { virtuals: true },   // Include virtual fields when converting to JSON
    toObject: { virtuals: true }, // Include virtual fields when converting to Object
  }
);

// ── Indexes ──────────────────────────────────────────────────────────────────
// email already has a unique index (from unique: true above)
// Additional compound indexes for common query patterns:
userSchema.index({ role: 1 });         // Filter users by role
userSchema.index({ isActive: 1 });     // Filter active/inactive users
userSchema.index({ createdAt: -1 });   // Sort by newest first

// ── Virtuals ─────────────────────────────────────────────────────────────────
// A virtual is a field computed from existing data — NOT stored in MongoDB.
// It's calculated on the fly when you access it.
userSchema.virtual('favouriteCount').get(function () {
  return this.favourites.length;
});

// ── Pre-Save Middleware ───────────────────────────────────────────────────────
// This function runs BEFORE every .save() call.
// We hash the password here so it's ALWAYS hashed, even if changed via the model.
userSchema.pre('save', async function (next) {
  // 'this' refers to the document being saved

  // ONLY hash if password was actually modified.
  // Without this check, we'd re-hash the already-hashed password every save.
  if (!this.isModified('password')) return next();

  // Hash the password with bcrypt, 12 salt rounds
  // Higher rounds = more secure but slower. 12 is the recommended balance.
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ── Instance Methods ──────────────────────────────────────────────────────────
// Methods that can be called on a user document instance.

/**
 * comparePassword — checks if a plain-text password matches the stored hash
 * @param {string} candidatePassword - The password the user typed at login
 * @returns {boolean} true if passwords match
 *
 * Why bcrypt.compare() and not just re-hash and compare?
 * bcrypt hashes include the salt in the hash string, so compare() extracts the salt
 * automatically and does a time-safe comparison.
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  // Note: 'this.password' is available here because we call .select('+password')
  // in the controller before calling this method
  return await bcrypt.compare(candidatePassword, this.password);
};

/**
 * createEmailVerificationToken — generates a token for email verification
 * HOW IT WORKS:
 *   1. Generate 32 random bytes using Node's crypto module
 *   2. Store the SHA-256 HASH of those bytes in the database (not the raw token)
 *   3. Return the RAW (unhashed) token to the controller
 *   4. Controller puts the raw token in the verification URL sent to user
 *   5. When user clicks the link, we hash the token from URL and compare with DB
 *
 * WHY HASH IT?
 *   If our database is breached, attackers get only the hash, not the token.
 *   Since SHA-256 is one-way, they can't reconstruct the URL to verify as us.
 */
userSchema.methods.createEmailVerificationToken = function () {
  // 1. Generate random bytes and convert to hex string
  const rawToken = crypto.randomBytes(32).toString('hex');

  // 2. Hash it and store in database
  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(rawToken)
    .digest('hex');

  // 3. Set expiry to 24 hours from now
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;

  // 4. Return the RAW token (this goes in the email URL)
  return rawToken;
};

/**
 * createPasswordResetToken — generates a token for password reset emails
 * Same strategy as email verification: store hash, send raw token.
 */
userSchema.methods.createPasswordResetToken = function () {
  const rawToken = crypto.randomBytes(32).toString('hex');

  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(rawToken)
    .digest('hex');

  // Expires in 10 minutes (much shorter than email verification for security)
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  return rawToken;
};

// ── Model Export ──────────────────────────────────────────────────────────────
// mongoose.model('User', userSchema) creates a 'User' model that:
// - Reads/writes to the 'users' collection (Mongoose auto-pluralizes)
// - Validates documents against userSchema before saving
// - Provides: User.find(), User.findOne(), User.create(), etc.
const User = mongoose.model('User', userSchema);

module.exports = User;
