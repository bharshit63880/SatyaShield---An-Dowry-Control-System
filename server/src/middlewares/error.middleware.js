import mongoose from 'mongoose';
import multer from 'multer';
import { OpenAIError } from 'openai/error';

import { isProduction } from '../config/env.js';

export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
}

export function errorHandler(error, req, res, _next) {
  const statusCode =
    error.statusCode ||
    error.status ||
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
    statusCode >= 500 && isProduction && error.expose !== true
      ? 'Something went wrong. Please try again later.'
      : error.message || 'Internal server error.';

  res.status(statusCode).json({
    success: false,
    code,
    message,
    requestId: req.requestId,
    ...(error.details ? { details: error.details } : {}),
    ...(isProduction ? {} : { stack: error.stack })
  });
}
