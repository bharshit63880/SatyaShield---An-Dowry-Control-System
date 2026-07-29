import mongoose from 'mongoose';
import multer from 'multer';
import { OpenAIError } from 'openai/error';

import { logEvent } from '../services/logger.service.js';

export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    code: 'ROUTE_NOT_FOUND',
    message: 'Route not found.'
  });
}

export function errorHandler(error, req, res, _next) {
  const statusCode =
    error.statusCode ||
    error.status ||
    (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE' ? 413 : undefined) ||
    (error instanceof multer.MulterError ? 400 : undefined) ||
    (error instanceof SyntaxError && error.status === 400 ? 400 : undefined) ||
    (error instanceof mongoose.Error.ValidationError ? 400 : 500);

  const code =
    error.code ||
    (error instanceof multer.MulterError ? 'UPLOAD_ERROR' : undefined) ||
    (error instanceof SyntaxError && error.status === 400 ? 'INVALID_JSON' : undefined) ||
    (error instanceof OpenAIError ? 'OPENAI_ERROR' : undefined) ||
    'INTERNAL_ERROR';

  const message =
    statusCode >= 500 && error.expose !== true
      ? 'Something went wrong. Please try again later.'
      : error.message || 'Internal server error.';

  logEvent(statusCode >= 500 ? 'error' : 'warn', 'request_failed', {
    requestId: req.requestId,
    statusCode,
    errorCode: code
  });

  res.status(statusCode).json({
    success: false,
    code,
    message,
    requestId: req.requestId,
    ...(statusCode < 500 && error.details ? { details: error.details } : {})
  });
}
