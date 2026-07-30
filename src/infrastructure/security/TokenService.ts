import jwt from 'jsonwebtoken';

class TokenService {
  signAccessToken(payload) {
    return jwt.sign(payload, process.env.JWT_SECRET, {
      
      
      expiresIn: (process.env.JWT_EXPIRES_IN || '8h') as any,
    });
  }

  verifyAccessToken(token) {
    return jwt.verify(token, process.env.JWT_SECRET);
  }
}

export { TokenService };
