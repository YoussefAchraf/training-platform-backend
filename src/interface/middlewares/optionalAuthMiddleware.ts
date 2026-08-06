







export default function optionalAuthMiddleware({ tokenService, userRepository }) {
  return async function (req, _res, next) {
    try {
      const token = req.cookies?.accessToken;
      if (!token) return next();

      const decoded = tokenService.verifyAccessToken(token);
      const user = await userRepository.findById(decoded.userId);
      if (user && user.isApproved()) {
        req.user = user;
      }
    } catch (_err) {
      
      
      req.user = undefined;
    }
    next();
  };
};
