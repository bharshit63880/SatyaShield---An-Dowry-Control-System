export class ApiError extends Error {
  constructor(statusCode, message, options = {}) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = options.code ?? 'API_ERROR';
    this.details = options.details;
    this.expose = options.expose ?? statusCode < 500;
  }
}
