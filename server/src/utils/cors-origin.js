export function normalizeAllowedOrigin(value) {
  const parsed = new URL(String(value).trim());
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error('CORS origins must be HTTP(S) origins without credentials.');
  }
  return parsed.origin;
}

export function isAllowedOrigin(origin, allowedOrigins) {
  if (!origin) return true;
  try {
    return allowedOrigins.includes(normalizeAllowedOrigin(origin));
  } catch {
    return false;
  }
}
