import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { spawn } from 'child_process';

import ffmpegPath from 'ffmpeg-static';
import sharp from 'sharp';

import { uploadsDirectory } from '../config/paths.js';
import { ApiError } from '../utils/ApiError.js';

const imageFormatMap = {
  'image/jpeg': { extension: '.jpg', format: 'jpeg' },
  'image/png': { extension: '.png', format: 'png' },
  'image/webp': { extension: '.webp', format: 'webp' },
  'image/gif': { extension: '.gif', format: 'gif' }
};

const videoExtensionMap = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov'
};

function createRandomMediaId() {
  return crypto.randomBytes(24).toString('hex');
}

function buildOutputPath(extension) {
  return path.join(uploadsDirectory, `${createRandomMediaId()}${extension}`);
}

async function sanitizeImage(file) {
  const formatConfig = imageFormatMap[file.mimetype];

  if (!formatConfig) {
    throw new ApiError(400, 'Unsupported image format.', { code: 'UPLOAD_UNSUPPORTED_IMAGE' });
  }

  await fs.mkdir(uploadsDirectory, { recursive: true });

  const outputPath = buildOutputPath(formatConfig.extension);
  let pipeline = sharp(file.buffer, {
    animated: file.mimetype === 'image/gif'
  }).rotate();

  pipeline = pipeline.toFormat(formatConfig.format);
  await pipeline.toFile(outputPath);

  return {
    filename: path.basename(outputPath),
    path: outputPath,
    mimetype: file.mimetype
  };
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const process = spawn(ffmpegPath, args, {
      windowsHide: true
    });

    let stderr = '';

    process.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    process.on('error', reject);
    process.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr || `ffmpeg exited with code ${code}`));
    });
  });
}

async function sanitizeVideo(file) {
  const extension = videoExtensionMap[file.mimetype];

  if (!extension) {
    throw new ApiError(400, 'Unsupported video format.', { code: 'UPLOAD_UNSUPPORTED_VIDEO' });
  }

  if (!ffmpegPath) {
    throw new ApiError(500, 'Video sanitization is not available on this server.', {
      code: 'UPLOAD_VIDEO_SANITIZER_UNAVAILABLE',
      expose: false
    });
  }

  await fs.mkdir(uploadsDirectory, { recursive: true });

  const tempInputPath = path.join(os.tmpdir(), `${createRandomMediaId()}${extension}`);
  const outputPath = buildOutputPath(extension);

  try {
    await fs.writeFile(tempInputPath, file.buffer);

    await runFfmpeg([
      '-y',
      '-i',
      tempInputPath,
      '-map',
      '0',
      '-map_metadata',
      '-1',
      '-map_chapters',
      '-1',
      '-c',
      'copy',
      '-movflags',
      '+faststart',
      outputPath
    ]);

    return {
      filename: path.basename(outputPath),
      path: outputPath,
      mimetype: file.mimetype
    };
  } catch (error) {
    await fs.rm(outputPath, { force: true }).catch(() => {});
    throw new ApiError(400, 'Unable to sanitize uploaded video.', {
      code: 'UPLOAD_VIDEO_SANITIZATION_FAILED',
      details: {
        reason: error.message
      }
    });
  } finally {
    await fs.rm(tempInputPath, { force: true }).catch(() => {});
  }
}

export async function sanitizeUploadedMedia(file) {
  if (!file) {
    return null;
  }

  if (file.mimetype.startsWith('image/')) {
    return sanitizeImage(file);
  }

  if (file.mimetype.startsWith('video/')) {
    return sanitizeVideo(file);
  }

  throw new ApiError(400, 'Unsupported upload type.', { code: 'UPLOAD_UNSUPPORTED_TYPE' });
}

