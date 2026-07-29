import { env } from '../config/env.js';

const SECRET_KEY = /(authorization|cookie|password|secret|token|credential|mfa|description|message|note|reason|location|filename|hash|storage|path|uri|url|prompt|response|content|case.?id|anonymous.?id|ip|user.?agent)/i;
let sink = (entry) => process.stdout.write(`${JSON.stringify(entry)}\n`);

export function setLogSink(nextSink) {
  sink = nextSink;
}

export function resetLogSink() {
  sink = (entry) => process.stdout.write(`${JSON.stringify(entry)}\n`);
}

export function redact(value, key = '') {
  if (SECRET_KEY.test(key)) return '[REDACTED]';
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [childKey, redact(childValue, childKey)])
    );
  }
  return value;
}

export function durationBucket(milliseconds) {
  if (milliseconds < 50) return 'lt_50ms';
  if (milliseconds < 250) return '50_249ms';
  if (milliseconds < 1000) return '250_999ms';
  return 'gte_1000ms';
}

export function normalizeRoute(req) {
  if (req.route?.path) return `${req.baseUrl || ''}${req.route.path}`;
  return 'unmatched_route';
}

export function logEvent(level, eventName, fields = {}) {
  sink(redact({
    timestamp: new Date().toISOString(),
    environment: env.nodeEnv,
    level,
    event: eventName,
    ...fields
  }));
}

export function operationalRequestLogger(req, res, next) {
  const start = performance.now();
  res.on('finish', () => {
    logEvent('info', 'http_request_completed', {
      requestId: req.requestId,
      method: req.method,
      routeTemplate: normalizeRoute(req),
      statusCode: res.statusCode,
      durationBucket: durationBucket(performance.now() - start)
    });
  });
  next();
}
