import crypto from 'crypto';

import { COMPLAINT_RISK_LEVELS, COMPLAINT_STATUSES, Complaint } from '../models/complaint.model.js';
import { analyzeComplaintRisk } from './complaint-risk.service.js';
import { assignNgoForComplaint } from './ngo-router.service.js';
import { ApiError } from '../utils/ApiError.js';
import { decryptSensitiveValue, encryptSensitiveValue } from '../utils/crypto.js';

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
  const description =
    (complaint.descriptionEncrypted
      ? decryptSensitiveValue(complaint.descriptionEncrypted)
      : complaint.description) ?? '';
  const location = complaint.locationConsent
    ? buildApproximateLocationLabel(parseApproximateLocation(complaint.approximateLocationEncrypted))
    : null;

  return {
    anonymousId: complaint.anonymousId,
    mediaUrl: complaint.mediaUrl,
    mediaType: complaint.mediaType,
    description,
    detectedKeywords: complaint.detectedKeywords ?? [],
    riskScore: complaint.riskScore ?? 0,
    riskLevel: complaint.riskLevel ?? 'low',
    assignedNgo: complaint.assignedNgo ?? null,
    timestamp: complaint.timestamp,
    status: complaint.status,
    locationConsent: complaint.locationConsent,
    approximateLocation: location
  };
}

export async function createComplaint({
  description,
  mediaUrl,
  mediaType,
  locationConsent,
  approximateLocation,
  submissionFingerprintHash
}) {
  const riskAnalysis = analyzeComplaintRisk(description);
  const assignedNgo = await assignNgoForComplaint({ approximateLocation });

  return Complaint.create({
    anonymousId: generateAnonymousId(),
    descriptionEncrypted: description ? encryptSensitiveValue(description.trim()) : null,
    mediaUrl: mediaUrl ?? null,
    mediaType: mediaType ?? 'none',
    locationConsent: Boolean(locationConsent),
    approximateLocationEncrypted: approximateLocation
      ? encryptSensitiveValue(JSON.stringify(approximateLocation))
      : null,
    submissionFingerprintHash: submissionFingerprintHash ?? null,
    detectedKeywords: riskAnalysis.detectedKeywords,
    riskScore: riskAnalysis.riskScore,
    riskLevel: riskAnalysis.riskLevel,
    assignedNgo,
    status: 'submitted',
    timestamp: new Date()
  });
}

export async function getRecentComplaints(limit = 8) {
  const complaints = await Complaint.find()
    .select('+approximateLocationEncrypted +descriptionEncrypted')
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();

  return complaints.map(serializeComplaintForAdmin);
}

export async function listComplaints({ status }) {
  const query = {};

  if (status && status !== 'all') {
    query.status = status;
  }

  const complaints = await Complaint.find(query)
    .select('+approximateLocationEncrypted +descriptionEncrypted')
    .sort({ timestamp: -1 })
    .lean();

  return complaints.map(serializeComplaintForAdmin);
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
        _id: '$riskLevel',
        count: { $sum: 1 }
      }
    }
  ]);

  const summary = Object.fromEntries(COMPLAINT_RISK_LEVELS.map((level) => [level, 0]));

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
        timestamp: {
          $gte: startDate
        }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: '%Y-%m-%d',
            date: '$timestamp'
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
    .select('+approximateLocationEncrypted riskLevel')
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
    if (complaint.riskLevel === 'high') {
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

export async function updateComplaintStatusByAnonymousId(anonymousId, status) {
  if (!COMPLAINT_STATUSES.includes(status)) {
    throw new ApiError(400, 'Invalid complaint status.');
  }

  const complaint = await Complaint.findOneAndUpdate(
    { anonymousId },
    { status },
    { new: true }
  )
    .select('+approximateLocationEncrypted +descriptionEncrypted')
    .lean();

  if (!complaint) {
    throw new ApiError(404, 'Complaint not found.');
  }

  return serializeComplaintForAdmin(complaint);
}

export async function hasRecentComplaintFingerprint(submissionFingerprintHash, windowMs = 10 * 60 * 1000) {
  if (!submissionFingerprintHash) {
    return false;
  }

  const existingComplaint = await Complaint.findOne({
    submissionFingerprintHash,
    createdAt: {
      $gte: new Date(Date.now() - windowMs)
    }
  })
    .select('_id')
    .lean();

  return Boolean(existingComplaint);
}
