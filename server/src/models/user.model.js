import mongoose from 'mongoose';

const deviceSchema = new mongoose.Schema({
  category: {
    type: String,
    enum: ['desktop', 'mobile', 'tablet', 'unknown'],
    default: 'unknown'
  },
  // Legacy fields remain unreadable so older records can be migrated without
  // accidentally returning their high-cardinality telemetry.
  ip: { type: String, select: false },
  userAgent: { type: String, select: false },
  lastLoginAt: {
    type: Date,
    default: Date.now
  }
});

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: false,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    passwordHistory: {
      type: [String],
      default: [],
      select: false
    },
    role: {
      type: String,
      enum: ['user', 'ngo', 'investigator', 'admin', 'superadmin'],
      default: 'user'
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    accountState: {
      type: String,
      enum: ['active', 'suspended', 'disabled', 'tombstoned'],
      default: 'active',
      index: true
    },
    authVersion: { type: Number, default: 1 },
    passwordChangedAt: { type: Date, default: Date.now },
    mfaEnabled: {
      type: Boolean,
      default: false
    },
    mfaSecretEncrypted: { type: String, default: null, select: false },
    mfaPendingSecretEncrypted: { type: String, default: null, select: false },
    mfaLastAcceptedStep: { type: Number, default: null, select: false },
    mfaEnrolledAt: { type: Date, default: null },
    accountLocked: {
      type: Boolean,
      default: false
    },
    failedLoginAttempts: {
      type: Number,
      default: 0
    },
    lockUntil: {
      type: Date,
      default: null
    },
    lastLoginAt: {
      type: Date,
      default: null
    },
    devices: [deviceSchema]
  },
  {
    timestamps: true
  }
);

export const User = mongoose.model('User', userSchema);
