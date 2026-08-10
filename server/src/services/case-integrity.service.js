import crypto from 'crypto';

import { env } from '../config/env.js';
import { CaseIntegrityAssessment } from '../models/case-integrity-assessment.model.js';
import { CaseLink } from '../models/case-link.model.js';

const MINIMUM_FINGERPRINT_LENGTH = 20;
const MAXIMUM_CANDIDATES = 20;

export function normalizeNarrativeForIntegrity(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase('en')
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function createNarrativeFingerprint(value, {
  key = env.caseIntegrityHmacKey,
  version = env.caseIntegrityFingerprintVersion
} = {}) {
  const normalized = normalizeNarrativeForIntegrity(value);
  if (normalized.length < MINIMUM_FINGERPRINT_LENGTH) return null;
  return crypto.createHmac('sha256', key)
    .update(`case-integrity:narrative:${version}:${normalized}`)
    .digest('hex');
}

export function classifyInitialIntegrityAssessment(candidateCount) {
  const boundedCount = Math.max(0, Math.min(MAXIMUM_CANDIDATES, Number(candidateCount) || 0));
  if (boundedCount === 0) {
    return { status: 'normal', riskBand: 'none', signalCodes: [], reviewRequired: false };
  }
  return {
    status: 'duplicate_review',
    riskBand: 'review_required',
    signalCodes: ['exact_narrative_match'],
    reviewRequired: true
  };
}

export async function createInitialIntegrityAssessment(complaint, narrative, {
  assessmentModel = CaseIntegrityAssessment,
  caseLinkModel = CaseLink,
  now = new Date()
} = {}) {
  const fingerprint = createNarrativeFingerprint(narrative);
  const cutoff = new Date(now.getTime() - env.caseIntegrityDuplicateWindowDays * 86400000);
  let candidates = [];
  if (fingerprint) {
    candidates = await assessmentModel.find({
      narrativeFingerprint: fingerprint,
      isCurrent: true,
      generatedAt: { $gte: cutoff },
      complaintId: { $ne: complaint.anonymousId }
    }).select('assessmentId complaintId').sort({ generatedAt: -1 }).limit(MAXIMUM_CANDIDATES).lean();
  }

  const classification = fingerprint
    ? classifyInitialIntegrityAssessment(candidates.length)
    : { status: 'not_evaluated', riskBand: 'none', signalCodes: [], reviewRequired: false };
  const expiresAt = complaint.retentionEligibleAt ?? new Date(
    now.getTime() + env.complaintRetentionDays * 86400000
  );
  let assessment;
  try {
    assessment = await assessmentModel.create({
      complaintId: complaint.anonymousId,
      assessmentVersion: 1,
      isCurrent: true,
      ...classification,
      signalSnapshot: {
        exactNarrativeCandidateCount: candidates.length,
        duplicateWindowDays: env.caseIntegrityDuplicateWindowDays,
        fingerprintVersion: fingerprint ? env.caseIntegrityFingerprintVersion : null
      },
      narrativeFingerprint: fingerprint,
      modelOrRuleVersion: env.caseIntegrityPolicyVersion,
      generatedAt: now,
      expiresAt,
      reviewDeadlineAt: classification.reviewRequired
        ? new Date(now.getTime() + 24 * 60 * 60 * 1000)
        : null,
      retentionPolicyVersion: env.retentionPolicyVersion
    });

    if (candidates.length) {
      await caseLinkModel.insertMany(candidates.map((candidate) => ({
        sourceComplaintId: complaint.anonymousId,
        candidateComplaintId: candidate.complaintId,
        linkType: 'exact_narrative',
        similarityReason: 'normalized_hmac_match',
        confidenceBand: 'exact',
        createdByCategory: 'system',
        policyVersion: env.caseIntegrityPolicyVersion
      })));
    }

    complaint.currentIntegrityAssessmentId = assessment.assessmentId;
    complaint.currentIntegrityVersion = 1;
    complaint.currentIntegrityStatus = classification.status;
    complaint.currentIntegrityReviewRequired = classification.reviewRequired;
    await complaint.save();
    return assessment;
  } catch (error) {
    await Promise.all([
      assessmentModel.deleteMany({ complaintId: complaint.anonymousId }),
      caseLinkModel.deleteMany({ sourceComplaintId: complaint.anonymousId })
    ]).catch(() => {});
    throw error;
  }
}
