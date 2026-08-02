import crypto from 'node:crypto';

import { LegalContent } from '../models/legal-content.model.js';
import { ApiError } from '../utils/ApiError.js';

const digest = (value) => crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 24);
const stripUnsafeMarkup = (value) => String(value)
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
  .replace(/\son\w+\s*=\s*(["']).*?\1/gi, '')
  .replace(/javascript:/gi, '');

export async function createLegalContent(input, actor) {
  if (!input.citations?.length && input.category !== 'emergency_non_dispatch') {
    throw new ApiError(400, 'Authoritative citations are required.', { code: 'LEGAL_CITATIONS_REQUIRED' });
  }
  return LegalContent.create({
    ...input,
    title: stripUnsafeMarkup(input.title),
    body: stripUnsafeMarkup(input.body),
    state: 'draft',
    reviewerType: 'none',
    createdByRef: digest(actor.id)
  });
}

export async function transitionLegalContent(record, { action, reviewerType = 'internal', reviewDueAt }, now = new Date()) {
  const transitions = {
    submit_review: ['draft', 'under_review'],
    approve: ['under_review', 'approved'],
    publish: ['approved', 'published'],
    withdraw: ['published', 'withdrawn'],
    archive: ['withdrawn', 'archived']
  };
  const transition = transitions[action];
  if (!transition || record.state !== transition[0]) {
    throw new ApiError(409, 'Content lifecycle transition is not allowed.', { code: 'LEGAL_STATE_CONFLICT' });
  }
  if (action === 'approve' && reviewerType === 'none') {
    throw new ApiError(400, 'A reviewer type is required.', { code: 'LEGAL_REVIEW_REQUIRED' });
  }
  if (action === 'publish') {
    if (!record.reviewedAt || !record.citations.length || !record.reviewDueAt || record.reviewDueAt <= now) {
      throw new ApiError(409, 'Reviewed content with current citations is required.', { code: 'LEGAL_PUBLICATION_BLOCKED' });
    }
    record.publishedAt = now;
  }
  record.state = transition[1];
  if (action === 'approve') {
    record.reviewerType = reviewerType;
    record.reviewedAt = now;
    record.lastReviewedAt = now;
    record.reviewDueAt = new Date(reviewDueAt);
  }
  await record.save();
  return record;
}

export async function listPublishedLegalContent({ language = 'en', jurisdiction = 'IN' }, now = new Date()) {
  await LegalContent.updateMany(
    { state: 'published', reviewDueAt: { $lte: now } },
    { $set: { state: 'review_due' } }
  );
  return LegalContent.find({ state: 'published', language, jurisdiction, reviewDueAt: { $gt: now } })
    .select('contentKey version language category jurisdiction title body citations lastReviewedAt reviewDueAt')
    .sort({ category: 1, version: -1 })
    .lean();
}
