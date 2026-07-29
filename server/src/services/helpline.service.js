import { env } from '../config/env.js';
import { HelplineEntry } from '../models/helpline-entry.model.js';
import { ApiError } from '../utils/ApiError.js';
import { safeResourceRef } from './audit.service.js';

function normalizeContact(method, value) {
  const contact = String(value || '').trim();
  if (method === 'website') {
    let parsed;
    try { parsed = new URL(contact); } catch {
      throw new ApiError(422, 'Helpline contact value is invalid.');
    }
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
      throw new ApiError(422, 'Helpline websites must use a safe HTTPS address.');
    }
    return parsed.toString();
  }
  if (!/^\+?[0-9 ()-]{3,30}$/.test(contact)) {
    throw new ApiError(422, 'Helpline contact value is invalid.');
  }
  return contact.replace(/\s+/g, ' ');
}

export async function createHelplineDraft(input, actor) {
  if (input.testFixture === true && env.nodeEnv !== 'test') {
    throw new ApiError(422, 'Test helpline fixtures are unavailable.');
  }
  const sourceReference = String(input.sourceReference || '').trim();
  if (!sourceReference || !String(input.sourceAuthority || '').trim()) {
    throw new ApiError(422, 'An authoritative source reference is required.');
  }
  const now = new Date();
  return HelplineEntry.create({
    directoryVersion: env.helplineDirectoryVersion,
    country: String(input.country || '').trim().toLowerCase(),
    region: String(input.region || '').trim() || null,
    serviceCategory: input.serviceCategory,
    displayName: String(input.displayName || '').trim(),
    contactMethod: input.contactMethod,
    contactValue: normalizeContact(input.contactMethod, input.contactValue),
    availabilityWording: String(input.availabilityWording || '').trim(),
    languages: Array.isArray(input.languages)
      ? input.languages.map((item) => String(item).trim()).filter(Boolean).slice(0, 20)
      : [],
    sourceAuthority: String(input.sourceAuthority).trim(),
    sourceReference,
    sourceVerifiedAt: new Date(input.sourceVerifiedAt || now),
    lastReviewedAt: now,
    reviewStatus: 'draft',
    reverifyAt: new Date(input.reverifyAt),
    active: false,
    geographicApplicability: String(input.geographicApplicability || '').trim(),
    safeDisclaimer: String(input.safeDisclaimer ||
      'This directory entry does not mean SatyaShield contacted this service.').trim(),
    reviewedByRef: safeResourceRef(actor.id),
    testFixture: input.testFixture === true
  });
}

export async function reviewHelpline({
  helplineId, expectedVersion, action, actor, now = new Date()
}) {
  if (!['verify', 'deactivate', 'reject'].includes(action)) {
    throw new ApiError(422, 'Helpline review action is invalid.');
  }
  const entry = await HelplineEntry.findOne({ helplineId })
    .select('+sourceReference +reviewedByRef +testFixture');
  if (!entry) throw new ApiError(404, 'Helpline entry not found.');
  if (entry.reviewVersion !== Number(expectedVersion)) {
    throw new ApiError(409, 'Helpline entry changed. Refresh and try again.', {
      code: 'HELPLINE_VERSION_CONFLICT'
    });
  }
  if (action === 'verify') {
    if (entry.reverifyAt <= now || !entry.sourceReference || !entry.sourceAuthority) {
      throw new ApiError(422, 'The helpline source requires current verification.');
    }
    entry.reviewStatus = 'verified';
    entry.active = true;
    entry.sourceVerifiedAt = now;
  } else {
    entry.reviewStatus = action === 'deactivate' ? 'expired' : 'rejected';
    entry.active = false;
  }
  entry.lastReviewedAt = now;
  entry.reviewVersion += 1;
  entry.reviewedByRef = safeResourceRef(actor.id);
  await entry.save();
  return entry;
}

export async function listVerifiedHelplines({
  country, region = null, category = null, now = new Date()
}) {
  const oldestReview = new Date(
    now.getTime() - env.helplineMaxReviewAgeDays * 86400000
  );
  return HelplineEntry.find({
    directoryVersion: env.helplineDirectoryVersion,
    country: String(country || '').trim().toLowerCase(),
    ...(region ? { $or: [{ region }, { region: null }] } : {}),
    ...(category ? { serviceCategory: category } : {}),
    reviewStatus: 'verified',
    active: true,
    reverifyAt: { $gt: now },
    lastReviewedAt: { $gte: oldestReview }
  }).sort({ serviceCategory: 1, displayName: 1 }).lean();
}

export function serializeHelpline(entry) {
  return {
    helplineId: entry.helplineId,
    country: entry.country,
    region: entry.region,
    serviceCategory: entry.serviceCategory,
    displayName: entry.displayName,
    contactMethod: entry.contactMethod,
    contactValue: entry.contactValue,
    availabilityWording: entry.availabilityWording,
    languages: entry.languages,
    sourceAuthority: entry.sourceAuthority,
    sourceVerifiedAt: entry.sourceVerifiedAt,
    lastReviewedAt: entry.lastReviewedAt,
    reverifyAt: entry.reverifyAt,
    geographicApplicability: entry.geographicApplicability,
    safeDisclaimer: entry.safeDisclaimer,
    deliberateUserActionRequired: true,
    satyaShieldContactedService: false
  };
}
