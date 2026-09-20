import helmet from 'helmet';

const shared = {
  crossOriginResourcePolicy: { policy: 'cross-origin' as const },
  hsts: { maxAge: 15552000, includeSubDomains: false },
  referrerPolicy: { policy: 'no-referrer' as const },
};

const apiHeaders = helmet({
  ...shared,
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
});

const docsHeaders = helmet({ ...shared, contentSecurityPolicy: false });

export default function securityHeadersMiddleware(req, res, next) {
  const handler = req.path.startsWith('/api-docs') ? docsHeaders : apiHeaders;
  return handler(req, res, next);
}
