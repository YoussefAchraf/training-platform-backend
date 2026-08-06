function extractBearerToken(req): string | null {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

// csrfCheckPasses is injected rather than imported directly - this is the
// interface layer, which isn't allowed to depend on infrastructure


export default function authMiddleware({ tokenService, userRepository, csrfCheckPasses }) {
  return async function (req, res, next) {
    try {
      
      
      
      
      
      
      
      
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
