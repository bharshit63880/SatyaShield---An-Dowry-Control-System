import { LegalContent } from '../models/legal-content.model.js';
import { createLegalContent, listPublishedLegalContent, transitionLegalContent } from '../services/legal-content.service.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';

export const listPublicLegalContent = asyncHandler(async (req, res) => sendSuccess(res, {
  message: 'Reviewed public information fetched.',
  data: { entries: await listPublishedLegalContent({ language: req.query.language, jurisdiction: req.query.jurisdiction }) }
}));

export const createLegalContentEntry = asyncHandler(async (req, res) => {
  const entry = await createLegalContent(req.body, req.user);
  return sendSuccess(res, { statusCode: 201, message: 'Draft content created.', data: { entry } });
});

export const transitionLegalContentEntry = asyncHandler(async (req, res) => {
  const entry = await LegalContent.findById(req.params.id);
  if (!entry) throw new ApiError(404, 'Content entry was not found.', { code: 'LEGAL_CONTENT_NOT_FOUND' });
  await transitionLegalContent(entry, req.body);
  return sendSuccess(res, { message: 'Content lifecycle updated.', data: { entry } });
});
