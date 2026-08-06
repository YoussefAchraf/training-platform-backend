import { csrfCheckPasses } from '../../infrastructure/security/CookieSessionService';

function extractBearerToken(req): string | null {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

export default function authMiddleware({ tokenService, userRepository }) {
  return async function (req, res, next) {
    try {
      // Two supported auth paths: the httpOnly session cookie (the browser
      // frontend) or a Bearer token (non-browser, server-to-server callers
      // that hold their own copy of a token - e.g. the n8n chatbot, which
      // gets one from GET /auth/service-token and forwards it on every tool
      // call it makes on a user's behalf). A Bearer header is never attached
      
      
      
      const cookieToken = req.cookies?.accessToken;
      const token = cookieToken || extractBearerToken(req);
      if (!token) {
        return res.status(401).json({ error: 'Missing or expired session' });
      }

      const decoded = tokenService.verifyAccessToken(token);
      const user = await userRepository.findById(decoded.userId);
      if (!user || !user.isApproved()) {
        return res.status(401).json({ error: 'Account not found or not approved' });
      }

      
      
      
      if (cookieToken && !csrfCheckPasses(req)) {
        return res.status(403).json({ error: 'Invalid CSRF token' });
      }

      req.user = user;
      next();
    } catch (_err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
};
