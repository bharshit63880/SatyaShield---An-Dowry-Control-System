import mongoose from 'mongoose';

const deviceSchema = new mongoose.Schema({
  ip: String,
  userAgent: String,
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
    role: {
      type: String,
      enum: ['user', 'ngo', 'investigator', 'admin', 'superadmin'],
      default: 'user'
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    emailVerificationToken: {
      type: String,
      default: null
    },
    emailVerificationExpires: {
      type: Date,
      default: null
    },
    passwordResetToken: {
      type: String,
      default: null
    },
    passwordResetExpires: {
      type: Date,
      default: null
    },
    mfaSecret: {
      type: String,
      default: null
    },
    mfaEnabled: {
      type: Boolean,
      default: false
    },
    mfaTempSecret: {
      type: String,
      default: null
    },
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

// Indexes for performance

userSchema.index({ passwordResetToken: 1 });
userSchema.index({ emailVerificationToken: 1 });

export const User = mongoose.model('User', userSchema);
