export function noStore(_req, res, next) {
  res.setHeader('Cache-Control', 'no-store');
  next();
}

export function cacheReady({ maxAgeSeconds = 60, privateCache = false } = {}) {
  return (_req, res, next) => {
    const visibility = privateCache ? 'private' : 'public';
    res.setHeader('Cache-Control', `${visibility}, max-age=${maxAgeSeconds}`);
    next();
  };
}

