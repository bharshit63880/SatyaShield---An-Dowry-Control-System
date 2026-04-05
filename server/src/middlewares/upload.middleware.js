import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/quicktime'
]);

function fileFilter(_req, file, callback) {
  if (!allowedMimeTypes.has(file.mimetype)) {
    callback(new ApiError(400, 'Only image and video uploads are allowed.'));
    return;
  }

  callback(null, true);
}

export const uploadComplaintMedia = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: 30 * 1024 * 1024
  }
}).single('media');
