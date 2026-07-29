import crypto from 'crypto';
import { env } from '../config/env.js';

import { COMPLAINT_RISK_LEVELS, COMPLAINT_STATUSES, Complaint } from '../models/complaint.model.js';
import { CaseHistory } from '../models/case-history.model.js';
import { analyzeComplaintRisk } from './complaint-risk.service.js';
import { createInitialTriageAssessment, getCurrentAssessment, reporterTriageView } from './triage.service.js';
import { ApiError } from '../utils/ApiError.js';
import { decryptSensitiveValue, encryptSensitiveValue } from '../utils/crypto.js';
import { buildPaginationMeta } from '../utils/query.js';
import {
  generateReporterAccessSecret,
  hashReporterAccessSecret,
  signReporterCaseToken,
  verifyReporterAccessSecret
} from '../utils/reporter-access.js';
import {
  assertAdministrativeWorkflow,
  buildComplaintListScope
} from './authorization.service.js';

function generateAnonymousId() {
  return `anon-${crypto.randomUUID()}`;
}

export function buildApproximateLocationLabel(location) {
  if (!location) {
    return null;
  }

  const parts = [location.city, location.district].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

function parseApproximateLocation(encryptedValue) {
  if (!encryptedValue) {
    return null;
  }

  const decryptedValue = decryptSensitiveValue(encryptedValue);
  return JSON.parse(decryptedValue);
}

export function serializeComplaintForAdmin(complaint) {
  const { description, approximateLocation } = getDecryptedComplaintFields(complaint);

  return {
    anonymousId: complaint.anonymousId,
    mediaType: complaint.mediaType,
    description,
    triage: complaint.currentTriageSeverity ? {
      severity: complaint.currentTriageSeverity,
      reviewState: complaint.currentTriageReviewState,
      assessmentId: complaint.currentTriageAssessmentId,
      version: complaint.currentTriageVersion
    } : { severity: 'moderate', reviewState: 'review_required', legacyUnreviewed: true },
    assignedNgo: complaint.assignedNgo?.name
      ? {
          name: complaint.assignedNgo.name,
          city: complaint.assignedNgo.city ?? null,
          district: complaint.assignedNgo.district ?? null,
          coverageLabel: complaint.assignedNgo.coverageLabel ?? null,
          contactPhone: complaint.assignedNgo.contactPhone ?? null,
          contactEmail: complaint.assignedNgo.contactEmail ?? null,
          assignmentSource: complaint.assignedNgo.assignmentSource ?? null,
          matchedOn: complaint.assignedNgo.matchedOn ?? null,
          assignedAt: complaint.assignedNgo.assignedAt ?? null
        }
      : null,
    assignedInvestigator: complaint.assignedInvestigator?.name
      ? {
          name: complaint.assignedInvestigator.name,
          badgeNumber: complaint.assignedInvestigator.badgeNumber ?? null,
          assignedAt: complaint.assignedInvestigator.assignedAt ?? null
        }
      : null,
    timestamp: complaint.timestamp || complaint.createdAt,
    status: complaint.status,
    supportRoutingStatus: complaint.routingStatus ?? 'pending_admin_review',
    locationConsent: complaint.locationConsent,
    approximateLocation
  };
}

function getDecryptedComplaintFields(complaint) {
  const description =
    (complaint.descriptionEncrypted
      ? decryptSensitiveValue(complaint.descriptionEncrypted)
      : complaint.description) ?? '';
  const approximateLocation = complaint.locationConsent
    ? buildApproximateLocationLabel(parseApproximateLocation(complaint.approximateLocationEncrypted))
    : null;

  return { description, approximateLocation };
}

export function serializeComplaintForReporter(complaint) {
  const { description, approximateLocation } = getDecryptedComplaintFields(complaint);
  const assignedNgo = complaint.assignedNgo?.name
    ? {
        name: complaint.assignedNgo.name,
        coverageLabel: complaint.assignedNgo.coverageLabel ?? null
      }
    : null;

  return {
    caseId: complaint.anonymousId,
    description,
    status: complaint.status,
    supportRoutingStatus: complaint.routingStatus ?? 'pending_admin_review',
    triage: complaint.currentTriageSeverity ? {
      severity: complaint.currentTriageSeverity,
      reviewState: complaint.currentTriageReviewState
    } : { severity: 'moderate', reviewState: 'review_required' },
    mediaType: complaint.mediaType ?? 'none',
    locationConsent: Boolean(complaint.locationConsent),
    approximateLocation,
    assignedNgo,
    submittedAt: complaint.timestamp || complaint.createdAt
  };
}

export function serializeComplaintForNGO(complaint) {
  const { description, approximateLocation } = getDecryptedComplaintFields(complaint);
  return {
    anonymousId: complaint.anonymousId,
    description,
    status: complaint.status,
    triage: complaint.currentTriageSeverity ? {
      severity: complaint.currentTriageSeverity,
      reviewState: complaint.currentTriageReviewState
    } : { severity: 'moderate', reviewState: 'review_required' },
    mediaType: complaint.mediaType ?? 'none',
    locationConsent: Boolean(complaint.locationConsent),
    approximateLocation,
    assignedNgo: complaint.assignedNgo?.name
      ? {
          name: complaint.assignedNgo.name,
          coverageLabel: complaint.assignedNgo.coverageLabel ?? null,
          assignedAt: complaint.assignedNgo.assignedAt ?? null,
          acknowledgedAt: complaint.assignedNgo.acknowledgedAt ?? null
        }
      : null,
    timestamp: complaint.timestamp || complaint.createdAt
  };
}

export function serializeComplaintForInvestigator(complaint) {
  const { description, approximateLocation } = getDecryptedComplaintFields(complaint);
  return {
    anonymousId: complaint.anonymousId,
    description,
    status: complaint.status,
    triage: complaint.currentTriageSeverity ? {
      severity: complaint.currentTriageSeverity,
      reviewState: complaint.currentTriageReviewState
    } : { severity: 'moderate', reviewState: 'review_required' },
    mediaType: complaint.mediaType ?? 'none',
    locationConsent: Boolean(complaint.locationConsent),
    approximateLocation,
    assignedNgo: complaint.assignedNgo?.name
      ? {
          name: complaint.assignedNgo.name,
          coverageLabel: complaint.assignedNgo.coverageLabel ?? null
        }
      : null,
    assignedInvestigator: complaint.assignedInvestigator?.name
      ? {
          name: complaint.assignedInvestigator.name,
          badgeNumber: complaint.assignedInvestigator.badgeNumber ?? null,
          assignedAt: complaint.assignedInvestigator.assignedAt ?? null
        }
      : null,
    timestamp: complaint.timestamp || complaint.createdAt
  };
}

export function serializeComplaintForRole(complaint, role) {
  if (role === 'ngo') {
    return serializeComplaintForNGO(complaint);
  }
  if (role === 'investigator') {
    return serializeComplaintForInvestigator(complaint);
  }
  if (['admin', 'superadmin'].includes(role)) {
    return serializeComplaintForAdmin(complaint);
  }
  throw new ApiError(403, 'Complaint serialization is not allowed for this role.', {
    code: 'RESOURCE_ACCESS_DENIED'
  });
}

export async function createComplaint({
  description,
  mediaUrl,
  mediaType,
  locationConsent,
  approximateLocation,
  privacyAcknowledged,
  privacyNoticeVersion,
  consentVersion,
  aiConsent,
  aiDisclosureVersion,
  complaintCategory,
  preferredLanguage,
  triageInput
}) {
  const accessSecret = generateReporterAccessSecret();

  const complaint = await Complaint.create({
    anonymousId: generateAnonymousId(),
    reporterAccessSecretHash: hashReporterAccessSecret(accessSecret),
    reporterAccessVersion: 1,
    reporterAccessEnabled: true,
    descriptionEncrypted: description ? encryptSensitiveValue(description.trim()) : null,
    mediaUrl: mediaUrl ?? null,
    mediaType: mediaType ?? 'none',
    locationConsent: Boolean(locationConsent),
    approximateLocationEncrypted: approximateLocation
      ? encryptSensitiveValue(JSON.stringify(approximateLocation))
      : null,
    privacyAcknowledged,
    privacyNoticeVersion,
    consentVersion,
    aiConsent: Boolean(aiConsent),
    aiProcessing: {
      used: false, provider: 'disabled', model: null,
      disclosureVersion: aiConsent ? aiDisclosureVersion : null,
      consentVersion: aiConsent ? consentVersion : null,
      consentedAt: null, resultValidationState: 'local'
    },
    complaintCategory,
    preferredLanguage,
    assignedNgo: {},
    routingStatus: 'pending_admin_review',
    status: 'submitted',
    retentionPolicyVersion: env.retentionPolicyVersion,
    retentionEligibleAt: new Date(Date.now() + env.complaintRetentionDays * 86400000),
    timestamp: new Date()
  });
  try {
    await createInitialTriageAssessment(complaint, triageInput);
  } catch (error) {
    await Complaint.deleteOne({ _id: complaint._id });
    throw error;
  }

  // Track initial history log
  await CaseHistory.create({
    complaintId: complaint.anonymousId,
    action: 'complaint_created',
    description: 'Complaint submitted anonymously in the system.',
    newStatus: 'submitted'
  });

  return { complaint, accessSecret };
}

export async function getRecentComplaints(limit = 8) {
  const complaints = await Complaint.find()
    .select('+approximateLocationEncrypted +descriptionEncrypted')
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();

  return complaints.map(serializeComplaintForAdmin);
}

// Advanced search and filters implementation
export async function listComplaints({
  user,
  status,
  riskLevel,
  assignedNgoId,
  assignedInvestigatorId,
  search,
  page = 1,
  limit = 10,
  skip = 0,
  sort = { timestamp: -1 }
}) {
  const { actor, query: scopeQuery } = await buildComplaintListScope(user);
  const query = { ...scopeQuery };

  if (status && status !== 'all') {
    query.status = status;
  }
  if (riskLevel && riskLevel !== 'all') {
    query.currentTriageSeverity = riskLevel;
  }
  if (assignedNgoId && ['admin', 'superadmin'].includes(actor.role)) {
    query['assignedNgo.ngoId'] = assignedNgoId;
  }
  if (assignedInvestigatorId && ['admin', 'superadmin'].includes(actor.role)) {
    query['assignedInvestigator.investigatorId'] = assignedInvestigatorId;
  }

  if (search) {
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$or = [
      { anonymousId: { $regex: escapedSearch, $options: 'i' } },
      { 'assignedNgo.name': { $regex: escapedSearch, $options: 'i' } },
      { 'assignedInvestigator.name': { $regex: escapedSearch, $options: 'i' } }
    ];
  }

  const total = await Complaint.countDocuments(query);
  let complaints = await Complaint.find(query)
    .select('+approximateLocationEncrypted +descriptionEncrypted')
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .lean();

  const serialized = complaints.map((complaint) =>
    serializeComplaintForRole(complaint, actor.role)
  );

  return {
    complaints: serialized,
    pagination: buildPaginationMeta({ total, page, limit })
  };
}

export async function getComplaintStatusSummary() {
  const counts = await Complaint.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const summary = Object.fromEntries(COMPLAINT_STATUSES.map((status) => [status, 0]));

  for (const item of counts) {
    summary[item._id] = item.count;
  }

  return summary;
}

export async function getComplaintRiskSummary() {
  const counts = await Complaint.aggregate([
    {
      $group: {
        _id: '$currentTriageSeverity',
        count: { $sum: 1 }
      }
    }
  ]);

  const summary = Object.fromEntries(['low', 'moderate', 'high', 'critical'].map((level) => [level, 0]));

  for (const item of counts) {
    summary[item._id] = item.count;
  }

  return summary;
}

export async function getComplaintTrend(days = 7) {
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  startDate.setDate(startDate.getDate() - (days - 1));

  const counts = await Complaint.aggregate([
    {
      $match: {
        createdAt: {
          $gte: startDate
        }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: '%Y-%m-%d',
            date: '$createdAt'
          }
        },
        count: { $sum: 1 }
      }
    }
  ]);

  const countMap = new Map(counts.map((item) => [item._id, item.count]));
  const trend = [];

  for (let offset = 0; offset < days; offset += 1) {
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + offset);
    const isoDate = currentDate.toISOString().slice(0, 10);

    trend.push({
      date: isoDate,
      label: currentDate.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short'
      }),
      count: countMap.get(isoDate) ?? 0
    });
  }

  return trend;
}

export async function getComplaintHeatmapData(limit = 12) {
  const complaints = await Complaint.find({ locationConsent: true })
    .select('+approximateLocationEncrypted currentTriageSeverity')
    .lean();

  const buckets = new Map();

  for (const complaint of complaints) {
    const location = parseApproximateLocation(complaint.approximateLocationEncrypted);
    const label = buildApproximateLocationLabel(location);

    if (!label) {
      continue;
    }

    const existingBucket = buckets.get(label) ?? {
      label,
      city: location?.city ?? null,
      district: location?.district ?? null,
      count: 0,
      highRiskCount: 0
    };

    existingBucket.count += 1;
    if (['high', 'critical'].includes(complaint.currentTriageSeverity)) {
      existingBucket.highRiskCount += 1;
    }

    buckets.set(label, existingBucket);
  }

  return Array.from(buckets.values())
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return right.highRiskCount - left.highRiskCount;
    })
    .slice(0, limit);
}

export async function updateComplaintStatusByAnonymousId(anonymousId, status, user = null) {
  assertAdministrativeWorkflow(user);
  if (!COMPLAINT_STATUSES.includes(status)) {
    throw new ApiError(400, 'Invalid complaint status.');
  }

  const oldComplaint = await Complaint.findOne({ anonymousId }).select('status').lean();
  if (!oldComplaint) {
    throw new ApiError(404, 'Complaint not found.');
  }

  const complaint = await Complaint.findOneAndUpdate(
    { anonymousId },
    { status },
    { new: true }
  )
    .select('+approximateLocationEncrypted +descriptionEncrypted')
    .lean();

  // Create Case History Log
  await CaseHistory.create({
    complaintId: anonymousId,
    userId: user?.id || null,
    userName: user?.name || 'System',
    userRole: user?.role || 'operator',
    action: 'status_update',
    description: `Status updated from ${oldComplaint.status} to ${status}.`,
    previousStatus: oldComplaint.status,
    newStatus: status
  });

  return serializeComplaintForAdmin(complaint);
}

// Assign Investigator
export async function assignInvestigatorToComplaint(anonymousId, investigator, user = null) {
  assertAdministrativeWorkflow(user);
  const complaint = await Complaint.findOneAndUpdate(
    { anonymousId },
    {
      assignedInvestigator: {
        investigatorId: investigator.userId,
        name: investigator.name,
        badgeNumber: investigator.badgeNumber,
        assignedAt: new Date()
      }
    },
    { new: true }
  )
    .select('+approximateLocationEncrypted +descriptionEncrypted')
    .lean();

  if (!complaint) {
    throw new ApiError(404, 'Complaint not found.');
  }

  await CaseHistory.create({
    complaintId: anonymousId,
    userId: user?.id || null,
    userName: user?.name || 'System',
    userRole: user?.role || 'operator',
    action: 'investigator_assigned',
    description: `Assigned investigator ${investigator.name} (Badge: ${investigator.badgeNumber})`
  });

  return serializeComplaintForAdmin(complaint);
}

const INVALID_REPORTER_SECRET_HASH = '0'.repeat(64);

export async function exchangeReporterAccessCredentials(
  { caseId, accessSecret },
  complaintModel = Complaint
) {
  const complaint = await complaintModel.findOne({ anonymousId: caseId })
    .select('anonymousId +reporterAccessSecretHash reporterAccessEnabled reporterAccessVersion')
    .lean();

  const storedHash = complaint?.reporterAccessSecretHash ?? INVALID_REPORTER_SECRET_HASH;
  const secretMatches = verifyReporterAccessSecret(accessSecret, storedHash);
  const accessEnabled =
    complaint?.reporterAccessEnabled === true &&
    complaint?.reporterAccessVersion === 1 &&
    Boolean(complaint?.reporterAccessSecretHash);

  if (!secretMatches || !accessEnabled) {
    throw new ApiError(401, 'Case access credentials are invalid.', {
      code: 'REPORTER_ACCESS_INVALID'
    });
  }

  return {
    accessToken: signReporterCaseToken(complaint.anonymousId),
    tokenType: 'Bearer'
  };
}
