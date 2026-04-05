function sanitizeValue(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((accumulator, [key, entryValue]) => {
      if (key.startsWith('$') || key.includes('.')) {
        return accumulator;
      }

      accumulator[key] = sanitizeValue(entryValue);
      return accumulator;
    }, {});
  }

  return value;
}

export function sanitizeRequest(req, _res, next) {
  req.body = sanitizeValue(req.body);
  req.query = sanitizeValue(req.query);
  req.params = sanitizeValue(req.params);
  next();
}

