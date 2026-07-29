import mongoose from 'mongoose';

const recoveryCodeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    codeDigest: { type: String, required: true, unique: true, select: false },
    generationId: { type: String, required: true, index: true },
    usedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    purpose: { type: String, default: 'mfa_recovery' }
  },
  { timestamps: true }
);

export const RecoveryCode = mongoose.model('RecoveryCode', recoveryCodeSchema);
