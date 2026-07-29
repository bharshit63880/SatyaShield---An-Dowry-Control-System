import mongoose from 'mongoose';
import { connectDatabase } from '../src/config/db.js';

await connectDatabase();
try {
  const db = mongoose.connection.db;
  const [rawSessions, rawUserTokens, oldMfa, unverified, privileged] = await Promise.all([
    db.collection('sessions').countDocuments({ refreshToken: { $type: 'string' } }),
    db.collection('users').countDocuments({ $or: [
      { passwordResetToken: { $type: 'string' } },
      { emailVerificationToken: { $type: 'string' } }
    ] }),
    db.collection('users').countDocuments({ $or: [
      { mfaSecret: { $type: 'string' } }, { mfaTempSecret: { $type: 'string' } }
    ] }),
    db.collection('users').countDocuments({ isVerified: { $ne: true } }),
    db.collection('users').countDocuments({ role: { $in: ['admin', 'superadmin'] } })
  ]);
  process.stdout.write(`${JSON.stringify({
    mode: 'read-only', rawSessions, rawUserTokens, oldMfa, unverified, privileged,
    recommendation: 'Invalidate legacy tokens and sessions; require new verification or login.'
  }, null, 2)}\n`);
} finally {
  await mongoose.disconnect();
}
