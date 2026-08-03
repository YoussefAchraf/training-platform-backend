export default function requireRole(allowedRoles) {
  return function (req, res, next) {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    
    
    
    if (req.user.isSuperAdmin()) {
      return next();
    }
    if (!allowedRoles.includes(req.user.roleName)) {
      return res.status(403).json({ error: `This action requires one of: ${allowedRoles.join(', ')}` });
    }
    next();
  };
};
