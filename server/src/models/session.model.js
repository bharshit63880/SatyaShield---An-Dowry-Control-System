import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sessionId: { type: String, required: true, unique: true, index: true },
    familyId: { type: String, required: true, index: true },
    tokenDigest: { type: String, required: true, unique: true, select: false },
    tokenVersion: { type: Number, default: 1 },
    status: {
      type: String,
      enum: ['active', 'consumed', 'revoked'],
      default: 'active',
      index: true
    },
    deviceCategory: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet', 'unknown'],
      default: 'unknown'
    },
    label: { type: String, default: 'Staff session' },
    authVersion: { type: Number, required: true },
    lastUsedAt: { type: Date, default: Date.now },
    consumedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    revokeReason: { type: String, default: null },
    expiresAt: { type: Date, required: true },
    // Insecure legacy fields are inventory-only and are never selected.
    refreshToken: { type: String, select: false },
    ipAddress: { type: String, select: false },
    userAgent: { type: String, select: false },
    isValid: { type: Boolean, select: false }
  },
  { timestamps: true }
);

sessionSchema.index({ familyId: 1, status: 1 });
sessionSchema.index({ userId: 1, status: 1 });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session = mongoose.model('Session', sessionSchema);
