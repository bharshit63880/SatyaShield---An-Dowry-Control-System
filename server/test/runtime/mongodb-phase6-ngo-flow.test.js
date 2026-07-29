import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';

const runtimeUri = process.env.MONGODB_URI || '';
const databaseName = runtimeUri.match(/\/([^/?]+)(?:\?|$)/)?.[1] || '';
const runtimeEnabled = /^ss_p(?:[6789]|10)_rt_[a-z0-9_]+$/i.test(databaseName);
if (runtimeUri && !runtimeEnabled) {
  throw new Error('Runtime test refused: MONGODB_URI must target a dedicated Phase 6 test database.');
}
process.env.AI_PROCESSING_ENABLED = 'false';
process.env.JWT_SECRET ||= 'p6-test-jwt-secret-at-least-32-characters';
process.env.REPORTER_ACCESS_HMAC_KEY ||= 'p6-test-reporter-hmac-key-at-least-32';
process.env.REPORTER_TOKEN_SECRET ||= 'p6-test-reporter-token-secret-at-least-32';
process.env.STAFF_ACCESS_TOKEN_SECRET ||= 'p6-test-staff-access-secret-at-least-32';
process.env.REFRESH_TOKEN_PEPPER ||= 'p6-test-refresh-pepper-at-least-32';
process.env.VERIFICATION_TOKEN_PEPPER ||= 'p6-test-verify-pepper-at-least-32';
process.env.PASSWORD_RESET_TOKEN_PEPPER ||= 'p6-test-reset-pepper-at-least-32';
process.env.MFA_CHALLENGE_TOKEN_PEPPER ||= 'p6-test-mfa-challenge-at-least-32';
process.env.RECOVERY_CODE_PEPPER ||= 'p6-test-recovery-pepper-at-least-32';
process.env.MFA_ENCRYPTION_KEY ||= 'f'.repeat(64);
process.env.LOCATION_ENCRYPTION_KEY ||= 'p6-test-location-key-at-least-32';
process.env.EVIDENCE_ENCRYPTION_KEY ||= 'd'.repeat(64);

const { connectDatabase } = await import('../../src/config/db.js');
const { User } = await import('../../src/models/user.model.js');
const { NGO } = await import('../../src/models/ngo.model.js');
const { Complaint } = await import('../../src/models/complaint.model.js');
const { NgoAssignment } = await import('../../src/models/ngo-assignment.model.js');
const { encryptSensitiveValue } = await import('../../src/utils/crypto.js');
const {
  acknowledgeAssignment, minimizedOfferPreview, offerAssignment, reassignAssignment,
  rejectAssignment, routingCandidatesForComplaint
} = await import('../../src/services/ngo-assignment.service.js');
const { authorizeComplaintForStaff, COMPLAINT_ACTIONS } =
  await import('../../src/services/authorization.service.js');
const { reviewNgoProfile, submitOwnNgoProfile } =
  await import('../../src/services/ngo-profile.service.js');

test('MongoDB-backed Phase 6 NGO review, routing, assignment and revocation flow',
  { skip: !runtimeEnabled }, async (t) => {
    await connectDatabase();
    await mongoose.connection.dropDatabase();
    t.after(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });

    const [admin, ngoUserA, ngoUserB, ngoUserMismatch, ngoUserFull, ngoUserCapacity] = await User.create([
      { name: 'Admin', email: 'p6-admin@example.invalid', passwordHash: 'x', role: 'admin', isVerified: true },
      { name: 'NGO A', email: 'p6-a@example.invalid', passwordHash: 'x', role: 'ngo', isVerified: true },
      { name: 'NGO B', email: 'p6-b@example.invalid', passwordHash: 'x', role: 'ngo', isVerified: true },
      { name: 'Mismatch', email: 'p6-mismatch@example.invalid', passwordHash: 'x', role: 'ngo', isVerified: true },
      { name: 'Full', email: 'p6-full@example.invalid', passwordHash: 'x', role: 'ngo', isVerified: true },
      { name: 'Capacity', email: 'p6-capacity@example.invalid', passwordHash: 'x', role: 'ngo', isVerified: true }
    ]);
    const profile = (user, suffix, district, capacity = 2) => ({
      userId: user._id, name: `NGO ${suffix}`, email: `ngo-${suffix}@example.invalid`,
      supportedCategories: ['dowry_harassment'], supportedLanguages: ['hindi'],
      coverage: [{ country: 'in', state: 'delhi', district }], remoteSupport: false,
      verificationStatus: 'approved', profileVersion: 1, approvedProfileVersion: 1,
      verificationReviewVersion: 'ngo-review-v1', operationalStatus: 'active',
      acceptsNewAssignments: true, maximumActiveAssignments: capacity
    });
    const submittedA = { ...profile(ngoUserA, 'A', 'central', 1),
      verificationStatus: 'draft', approvedProfileVersion: null,
      operationalStatus: 'inactive', acceptsNewAssignments: false };
    const [ngoA, ngoB, ngoMismatch, ngoFull, ngoCapacity] = await NGO.create([
      submittedA, { ...profile(ngoUserB, 'B', 'south', 2), remoteSupport: true },
      { ...profile(ngoUserMismatch, 'Mismatch', 'north', 2), supportedCategories: ['legal_support'] },
      { ...profile(ngoUserFull, 'Full', 'central', 1), currentActiveAssignments: 1 },
      { ...profile(ngoUserCapacity, 'Capacity', 'west', 1), remoteSupport: true }
    ]);
    const complaint = (id, district) => Complaint.create({
      anonymousId: id, reporterAccessEnabled: true, reporterAccessVersion: 1,
      descriptionEncrypted: encryptSensitiveValue('private case narrative'),
      approximateLocationEncrypted: encryptSensitiveValue(JSON.stringify({ state: 'delhi', district })),
      locationConsent: true, privacyAcknowledged: true, privacyNoticeVersion: 'test',
      consentVersion: 'test', complaintCategory: 'dowry_harassment', preferredLanguage: 'hindi'
    });
    await Promise.all([
      complaint('P6-CASE-A', 'central'), complaint('P6-CASE-B', 'south'),
      complaint('P6-REJECT', 'central'), complaint('P6-EXPIRE', 'central'),
      complaint('P6-CONCURRENT-A', 'central'), complaint('P6-CONCURRENT-B', 'central')
    ]);

    await assert.rejects(() => offerAssignment({
      anonymousId: 'P6-CASE-A', ngoPublicId: ngoA.publicId,
      source: 'routing_recommendation', actor: { id: admin.id, role: 'admin' }
    }));
    await assert.rejects(() => authorizeComplaintForStaff({
      user: ngoUserA, anonymousId: 'P6-CASE-A', action: COMPLAINT_ACTIONS.READ
    }));
    const submittedProfile = await submitOwnNgoProfile(ngoUserA.id);
    assert.equal(submittedProfile.verificationStatus, 'submitted');
    await reviewNgoProfile({
      publicId: ngoA.publicId, action: 'approve', profileVersion: 1,
      reviewerId: admin.id
    });

    const candidates = await routingCandidatesForComplaint('P6-CASE-A');
    assert.equal(candidates.outcome, 'eligible_candidates');
    assert.equal(candidates.candidates[0].ngo.publicId, ngoA.publicId);
    assert.equal(candidates.candidates.some((item) => item.ngo.publicId === ngoMismatch.publicId), false);
    assert.equal(candidates.candidates.some((item) => item.ngo.publicId === ngoFull.publicId), false);

    const offer = await offerAssignment({
      anonymousId: 'P6-CASE-A', ngoPublicId: ngoA.publicId,
      source: 'routing_recommendation', actor: { id: admin.id, role: 'admin' }
    });
    const preview = await minimizedOfferPreview(offer.assignmentId, ngoUserA);
    assert.deepEqual(Object.keys(preview).sort(),
      ['approximateAreaShared', 'assignmentId', 'category', 'expiresAt', 'state'].sort());
    await assert.rejects(() => minimizedOfferPreview(offer.assignmentId, ngoUserB));

    await acknowledgeAssignment({ assignmentId: offer.assignmentId, user: ngoUserA });
    await assert.doesNotReject(() => authorizeComplaintForStaff({
      user: ngoUserA, anonymousId: 'P6-CASE-A', action: COMPLAINT_ACTIONS.READ
    }));
    for (const action of [
      COMPLAINT_ACTIONS.EVIDENCE_READ, COMPLAINT_ACTIONS.EVIDENCE_UPLOAD,
      COMPLAINT_ACTIONS.CHAT_READ, COMPLAINT_ACTIONS.CHAT_SEND
    ]) {
      await assert.doesNotReject(() => authorizeComplaintForStaff({
        user: ngoUserA, anonymousId: 'P6-CASE-A', action
      }));
    }
    await assert.rejects(() => authorizeComplaintForStaff({
      user: ngoUserA, anonymousId: 'P6-CASE-B', action: COMPLAINT_ACTIONS.READ
    }));
    assert.equal((await NGO.findOne({ publicId: ngoA.publicId })).currentActiveAssignments, 1);

    const reassigned = await reassignAssignment({
      anonymousId: 'P6-CASE-A', assignmentId: offer.assignmentId,
      ngoPublicId: ngoB.publicId, actor: { id: admin.id, role: 'admin' }
    });
    await assert.rejects(() => authorizeComplaintForStaff({
      user: ngoUserA, anonymousId: 'P6-CASE-A', action: COMPLAINT_ACTIONS.READ
    }));
    await assert.rejects(() => authorizeComplaintForStaff({
      user: ngoUserB, anonymousId: 'P6-CASE-A', action: COMPLAINT_ACTIONS.READ
    }));
    await acknowledgeAssignment({ assignmentId: reassigned.next.assignmentId, user: ngoUserB });
    await assert.doesNotReject(() => authorizeComplaintForStaff({
      user: ngoUserB, anonymousId: 'P6-CASE-A', action: COMPLAINT_ACTIONS.READ
    }));

    const rejectedOffer = await offerAssignment({
      anonymousId: 'P6-REJECT', ngoPublicId: ngoA.publicId,
      source: 'routing_recommendation', actor: { id: admin.id, role: 'admin' }
    });
    await rejectAssignment({
      assignmentId: rejectedOffer.assignmentId, user: ngoUserA, reasonCategory: 'unable_to_accept'
    });
    assert.equal((await NgoAssignment.findOne({ assignmentId: rejectedOffer.assignmentId })).state, 'rejected');

    const expiredOffer = await offerAssignment({
      anonymousId: 'P6-EXPIRE', ngoPublicId: ngoA.publicId,
      source: 'routing_recommendation', actor: { id: admin.id, role: 'admin' }
    });
    await NgoAssignment.updateOne({ assignmentId: expiredOffer.assignmentId }, { expiresAt: new Date(0) });
    await assert.rejects(() => acknowledgeAssignment({
      assignmentId: expiredOffer.assignmentId, user: ngoUserA
    }));
    assert.equal((await NgoAssignment.findOne({ assignmentId: expiredOffer.assignmentId })).state, 'expired');

    const concurrency = await Promise.allSettled([
      offerAssignment({ anonymousId: 'P6-CONCURRENT-A', ngoPublicId: ngoCapacity.publicId,
        source: 'routing_recommendation', actor: { id: admin.id, role: 'admin' } }),
      offerAssignment({ anonymousId: 'P6-CONCURRENT-B', ngoPublicId: ngoCapacity.publicId,
        source: 'routing_recommendation', actor: { id: admin.id, role: 'admin' } })
    ]);
    assert.deepEqual(concurrency.map((item) => item.status).sort(), ['fulfilled', 'rejected']);
    assert.equal((await NGO.findOne({ publicId: ngoCapacity.publicId })).currentActiveAssignments, 1);

    await reviewNgoProfile({
      publicId: ngoB.publicId, action: 'suspend', profileVersion: 1,
      reasonCategory: 'security_concern', notes: 'Runtime lifecycle verification.',
      reviewerId: admin.id
    });
    await assert.rejects(() => authorizeComplaintForStaff({
      user: ngoUserB, anonymousId: 'P6-CASE-A', action: COMPLAINT_ACTIONS.READ
    }));
    const closed = await NgoAssignment.findOne({ assignmentId: reassigned.next.assignmentId }).lean();
    assert.equal(closed.isCurrent, false);
    assert.equal((await NGO.findOne({ publicId: ngoB.publicId })).currentActiveAssignments, 0);

    const storedComplaint = await Complaint.findOne({ anonymousId: 'P6-CASE-A' }).lean();
    assert.equal(storedComplaint.assignedNgo?.ngoId, undefined);
    assert.equal(await NgoAssignment.countDocuments({ complaintId: 'P6-CASE-A', isCurrent: true }), 0);
    const assignmentRecords = await NgoAssignment.find({}).lean();
    const assignmentJson = JSON.stringify(assignmentRecords);
    for (const forbidden of [
      'private case narrative', 'descriptionEncrypted', 'reporterAccessSecret',
      'operationalContact', 'registrationReference', 'reviewNotes'
    ]) assert.equal(assignmentJson.includes(forbidden), false);
    assert.ok(assignmentRecords.every((item) =>
      !item.assignedByRef || /^[a-f0-9]{24}$/.test(item.assignedByRef)));
  });
