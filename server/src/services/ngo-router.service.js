import { env } from '../config/env.js';
import { NGO } from '../models/ngo.model.js';
import { NgoConflict } from '../models/ngo-conflict.model.js';
import { decryptSensitiveValue } from '../utils/crypto.js';

export function normalizeCoverageValue(value, max = 120) {
  const normalized = String(value ?? '').trim().toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s+/g, ' ').slice(0, max);
  return normalized || null;
}

export function normalizeNgoProfileInput(input) {
  const categories = [...new Set((input.supportedCategories || []).map((value) => normalizeCoverageValue(value)))]
    .filter((value) => ['dowry_harassment', 'domestic_violence', 'legal_support', 'safety_planning'].includes(value));
  const languages = [...new Set((input.supportedLanguages || []).map((value) =>
    normalizeCoverageValue(value, 40)).filter(Boolean))];
  const coverage = (input.coverage || []).slice(0, 100).map((entry) => ({
    country: normalizeCoverageValue(entry.country, 2) || 'in',
    state: normalizeCoverageValue(entry.state),
    district: normalizeCoverageValue(entry.district),
    city: normalizeCoverageValue(entry.city)
  })).filter((entry) => entry.state || entry.district || entry.city);
  if (!categories.length || (!coverage.length && !input.remoteSupport)) {
    throw new Error('At least one supported category and coverage area are required.');
  }
  const maximumActiveAssignments = Number(input.maximumActiveAssignments);
  if (!Number.isInteger(maximumActiveAssignments) || maximumActiveAssignments < 1 ||
      maximumActiveAssignments > 10000) throw new Error('Capacity is invalid.');
  return {
    organizationType: input.organizationType,
    registrationReference: String(input.registrationReference || '').trim().slice(0, 200) || null,
    registrationJurisdiction: normalizeCoverageValue(input.registrationJurisdiction),
    website: String(input.website || '').trim().slice(0, 300) || null,
    publicContact: String(input.publicContact || '').trim().slice(0, 200) || null,
    operationalContact: String(input.operationalContact || '').trim().slice(0, 200) || null,
    supportedCategories: categories,
    supportedLanguages: languages,
    coverage,
    remoteSupport: Boolean(input.remoteSupport),
    serviceHours: {
      timezone: String(input.serviceHours?.timezone || 'Asia/Kolkata').slice(0, 80),
      summary: String(input.serviceHours?.summary || '').trim().slice(0, 200) || null
    },
    emergencySupportCapability: Boolean(input.emergencySupportCapability),
    maximumActiveAssignments,
    acceptsNewAssignments: Boolean(input.acceptsNewAssignments)
  };
}

function complaintLocation(complaint) {
  if (!complaint.locationConsent || !complaint.approximateLocationEncrypted) return {};
  try {
    const value = JSON.parse(decryptSensitiveValue(complaint.approximateLocationEncrypted));
    return {
      state: normalizeCoverageValue(value.state),
      district: normalizeCoverageValue(value.district),
      city: normalizeCoverageValue(value.city)
    };
  } catch {
    return {};
  }
}

export function hardEligibility(ngo, now = new Date()) {
  const eligible = ngo.verificationStatus === 'approved' &&
    ngo.approvedProfileVersion === ngo.profileVersion &&
    ngo.operationalStatus === 'active' &&
    ngo.acceptsNewAssignments === true &&
    (!ngo.temporaryUnavailableUntil || ngo.temporaryUnavailableUntil <= now) &&
    (!env.ngoCapacityEnforcementEnabled ||
      ngo.currentActiveAssignments < ngo.maximumActiveAssignments);
  return eligible;
}

function scoreCandidate(ngo, complaint) {
  const location = complaintLocation(complaint);
  let coverageScore = 0;
  let coverageReason = null;
  for (const item of ngo.coverage || []) {
    if (location.district && item.district === location.district) {
      coverageScore = Math.max(coverageScore, 300);
      coverageReason = 'exact_region_match';
    } else if (location.city && item.city === location.city && coverageScore < 300) {
      coverageScore = 280;
      coverageReason = 'exact_region_match';
    } else if (location.state && item.state === location.state && coverageScore < 280) {
      coverageScore = 200;
      coverageReason = 'state_coverage_match';
    }
  }
  if (!coverageScore && env.ngoRemoteCoverageEnabled && ngo.remoteSupport) {
    coverageScore = 100;
    coverageReason = 'remote_coverage_match';
  }
  const languageMatch = !complaint.preferredLanguage ||
    ngo.supportedLanguages.includes(normalizeCoverageValue(complaint.preferredLanguage, 40));
  const capacityRatio =
    (ngo.maximumActiveAssignments - ngo.currentActiveAssignments) / ngo.maximumActiveAssignments;
  return {
    coverageScore, coverageReason, languageMatch, capacityRatio,
    reasonCodes: [
      coverageReason,
      'category_match',
      ...(complaint.preferredLanguage ? ['language_match'] : []),
      'capacity_available'
    ].filter(Boolean)
  };
}

export async function evaluateRoutingCandidates(complaint) {
  if (!complaint.complaintCategory || complaint.complaintCategory === 'unknown') {
    return { outcome: 'no_eligible_ngo', policyVersion: env.ngoRoutingPolicyVersion, candidates: [] };
  }
  const [profiles, conflicts] = await Promise.all([
    NGO.find({
      verificationStatus: 'approved',
      operationalStatus: 'active',
      acceptsNewAssignments: true,
      supportedCategories: complaint.complaintCategory
    }).lean(),
    NgoConflict.find({ complaintId: complaint.anonymousId, active: true }).lean()
  ]);
  const excluded = new Set(conflicts.map((item) => item.ngoPublicId));
  const candidates = profiles
    .filter((ngo) => hardEligibility(ngo) && !excluded.has(ngo.publicId))
    .map((ngo) => ({ ngo, ...scoreCandidate(ngo, complaint) }))
    .filter((item) => item.coverageScore > 0 && item.languageMatch)
    .sort((left, right) =>
      right.coverageScore - left.coverageScore ||
      right.capacityRatio - left.capacityRatio ||
      new Date(left.ngo.lastAssignedAt || 0) - new Date(right.ngo.lastAssignedAt || 0) ||
      left.ngo.publicId.localeCompare(right.ngo.publicId)
    );
  return {
    outcome: candidates.length ? 'eligible_candidates' : 'no_eligible_ngo',
    policyVersion: env.ngoRoutingPolicyVersion,
    candidates: candidates.map(({ ngo, reasonCodes }) => ({ ngo, reasonCodes }))
  };
}

// Phase 1 compatibility export: Phase 6 never auto-assigns.
export async function assignNgoForComplaint() {
  return null;
}
