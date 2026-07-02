export function sendSuccess(res, { statusCode = 200, message = 'Request completed successfully.', data = {}, meta = undefined } = {}) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    ...(meta ? { meta } : {})
  });
}

export function sendCreated(res, options = {}) {
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Resource created successfully.',
    ...options
  });
}

