export function safeInternalPath(candidate, fallback = '/dashboard') {
  if (typeof candidate !== 'string') return fallback;
  if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.includes('\\')) {
    return fallback;
  }
  try {
    const parsed = new URL(candidate, 'https://satyashield.invalid');
    return parsed.origin === 'https://satyashield.invalid'
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : fallback;
  } catch {
    return fallback;
  }
}
