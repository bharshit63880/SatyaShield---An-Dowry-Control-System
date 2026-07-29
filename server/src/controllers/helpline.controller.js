import { asyncHandler } from '../utils/asyncHandler.js';
import { sendCreated, sendSuccess } from '../utils/apiResponse.js';
import { createAuditLog } from '../services/audit.service.js';
import {
  createHelplineDraft, listVerifiedHelplines, reviewHelpline, serializeHelpline
} from '../services/helpline.service.js';

export const listHelplines = asyncHandler(async (req, res) => {
  const entries = await listVerifiedHelplines({
    country: req.query.country,
    region: req.query.region,
    category: req.query.category
  });
  return sendSuccess(res, {
    message: 'Verified helpline directory fetched.',
    data: {
      entries: entries.map(serializeHelpline),
      unavailable: entries.length === 0,
      notice: 'SatyaShield has not contacted these services. Availability can change; use deliberate user action to contact an entry.'
    }
  });
});

export const createDraft = asyncHandler(async (req, res) => {
  const entry = await createHelplineDraft(req.body, req.user);
  return sendCreated(res, {
    message: 'Helpline draft created for review.',
    data: { entry: { ...serializeHelpline(entry), reviewStatus: entry.reviewStatus,
      reviewVersion: entry.reviewVersion } }
  });
});

export const reviewEntry = asyncHandler(async (req, res) => {
  const entry = await reviewHelpline({
    helplineId: req.params.helplineId,
    expectedVersion: req.body.version,
    action: req.body.action,
    actor: req.user
  });
  await createAuditLog({
    userId: req.user.id, role: req.user.role,
    action: req.body.action === 'deactivate'
      ? 'helpline_entry_deactivated' : 'helpline_entry_reviewed',
    resourceType: 'system', resourceRef: entry.helplineId,
    details: { stateTo: entry.reviewStatus }, req
  });
  return sendSuccess(res, {
    message: 'Helpline review completed.',
    data: { entry: { ...serializeHelpline(entry), reviewStatus: entry.reviewStatus,
      reviewVersion: entry.reviewVersion } }
  });
});
