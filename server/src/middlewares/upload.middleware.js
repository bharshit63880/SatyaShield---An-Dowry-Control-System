import multer from 'multer';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

const uploader = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fields: 10,
    fileSize: env.evidenceMaxFileSize
  }
}).single('media');

export function uploadComplaintMedia(req, res, next) {
  uploader(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) return next(error);
    return next(new ApiError(400, 'The multipart evidence upload is malformed.', {
      code: 'EVIDENCE_MULTIPART_INVALID'
    }));
  });
}
