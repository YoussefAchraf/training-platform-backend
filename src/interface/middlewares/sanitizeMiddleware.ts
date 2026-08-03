import xssFilter from 'xss';

const SKIP_KEYS = new Set(['password', 'refreshToken']);

function sanitizeString(value) {
  return xssFilter(value.trim(), { whiteList: {}, stripIgnoreTag: true, stripIgnoreTagBody: ['script'] });
}

function sanitizeValue(value) {
  if (typeof value === 'string') {
    return sanitizeString(value);
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value && typeof value === 'object') {
    return sanitizeObject(value);
  }
  return value;
}

function sanitizeObject(obj) {
  const result = {};
  for (const key of Object.keys(obj)) {
    result[key] = SKIP_KEYS.has(key) ? obj[key] : sanitizeValue(obj[key]);
  }
  return result;
}





export default function sanitizeMiddleware(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  next();
}
