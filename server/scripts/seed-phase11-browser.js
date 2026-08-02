import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI || '';
const databaseName = uri.match(/\/([^/?]+)(?:\?|$)/)?.[1] || '';
if (!/^ss_p11_rt_[a-z0-9_]+$/i.test(databaseName)) {
  throw new Error('Browser fixture seeding requires a dedicated ss_p11_rt_* database.');
}

const { connectDatabase } = await import('../src/config/db.js');
const { User } = await import('../src/models/user.model.js');
const { NGO } = await import('../src/models/ngo.model.js');
const { Investigator } = await import('../src/models/investigator.model.js');
const { RecoveryCode } = await import('../src/models/recovery-code.model.js');
const { Complaint } = await import('../src/models/complaint.model.js');
const { NgoAssignment } = await import('../src/models/ngo-assignment.model.js');
const { hashPassword } = await import('../src/services/password.service.js');
const { digestAuthValue, encryptMfaSecret } = await import('../src/utils/auth-crypto.js');

await connectDatabase();
await mongoose.connection.db.dropDatabase();
const passwordHash = await hashPassword('Browser Test Passphrase 2026!');
const users = await User.insertMany([
  {
    name: 'Browser Admin', email: 'browser-admin@example.invalid',
    passwordHash, role: 'admin', isVerified: true, accountState: 'active',
    mfaEnabled: true, mfaSecretEncrypted: encryptMfaSecret('JBSWY3DPEHPK3PXP'),
    mfaEnrolledAt: new Date()
  },
  {
    name: 'Browser NGO', email: 'browser-ngo@example.invalid',
    passwordHash, role: 'ngo', isVerified: true, accountState: 'active'
  },
  {
    name: 'Browser Investigator', email: 'browser-investigator@example.invalid',
    passwordHash, role: 'investigator', isVerified: true, accountState: 'active'
  }
]);
await RecoveryCode.create({
  userId: users[0]._id,
  codeDigest: digestAuthValue('BROWSERRECOVERY2026', 'recovery'),
  generationId: 'browser-fixture-v1',
  purpose: 'mfa_recovery'
});
const ngo = await NGO.create({
  userId: users[1]._id,
  name: 'Browser Test NGO',
  email: users[1].email,
  phone: 'test-only',
  city: 'Test City',
  district: 'Test District',
  verificationStatus: 'approved',
  profileVersion: 1,
  approvedProfileVersion: 1,
  operationalStatus: 'active',
  acceptsNewAssignments: true,
  supportedCategories: ['dowry_harassment'],
  remoteSupport: true
});
await Investigator.create({
  userId: users[2]._id,
  name: 'Browser Test Investigator',
  badgeNumber: 'P11-BROWSER-1',
  agency: 'Test Agency',
  phone: 'test-only',
  isActive: true,
  isEligible: true
});
await Complaint.create({
  anonymousId: 'anon-browser-offer',
  complaintCategory: 'dowry_harassment',
  privacyAcknowledged: true,
  privacyNoticeVersion: 'browser-test-v1',
  consentVersion: 'browser-test-v1',
  routingStatus: 'offer_pending',
  status: 'submitted'
});
await NgoAssignment.create({
  assignmentId: 'asgn-browser-offer',
  complaintId: 'anon-browser-offer',
  ngoPublicId: ngo.publicId,
  state: 'offered',
  source: 'manual',
  routingPolicyVersion: 'browser-test-v1',
  recommendationReasonCodes: ['browser_fixture'],
  offeredAt: new Date(),
  expiresAt: new Date(Date.now() + 60 * 60 * 1000)
});
await Complaint.create({
  anonymousId: 'anon-browser-investigator',
  complaintCategory: 'dowry_harassment',
  privacyAcknowledged: true,
  privacyNoticeVersion: 'browser-test-v1',
  consentVersion: 'browser-test-v1',
  assignedInvestigator: {
    investigatorId: users[2]._id,
    name: 'Browser Investigator',
    badgeNumber: 'P11-BROWSER-1',
    assignedAt: new Date()
  },
  status: 'under-review'
});
await mongoose.disconnect();
process.stdout.write('Guarded browser role fixtures created.\n');
