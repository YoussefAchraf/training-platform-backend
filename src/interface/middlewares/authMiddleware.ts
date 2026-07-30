export default function authMiddleware({ tokenService, userRepository }) {
  return async function (req, res, next) {
    try {
      const header = req.headers.authorization || '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : null;
      if (!token) {
        return res.status(401).json({ error: 'Missing or malformed Authorization header' });
      }

      const decoded = tokenService.verifyAccessToken(token);
      const user = await userRepository.findById(decoded.userId);
      if (!user || !user.isApproved()) {
        return res.status(401).json({ error: 'Account not found or not approved' });
      }

      req.user = user; 
      next();
    } catch (_err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
};
