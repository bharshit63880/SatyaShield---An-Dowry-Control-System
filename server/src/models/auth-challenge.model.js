import mongoose from 'mongoose';

const authChallengeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    purpose: {
      type: String,
      enum: ['email_verification', 'password_reset', 'mfa_login'],
      required: true,
      index: true
    },
    tokenDigest: { type: String, required: true, unique: true, select: false },
    status: {
      type: String,
      enum: ['active', 'used', 'revoked', 'expired'],
      default: 'active',
      index: true
    },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 6 },
    expiresAt: { type: Date, required: true, index: true },
    usedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    deliveryState: {
      type: String,
      enum: ['queued', 'sent', 'failed', 'skipped_not_configured', 'not_applicable'],
      default: 'not_applicable'
    },
    purposeVersion: { type: Number, default: 1 }
  },
  { timestamps: true }
);

authChallengeSchema.index({ userId: 1, purpose: 1, status: 1 });
export const AuthChallenge = mongoose.model('AuthChallenge', authChallengeSchema);
