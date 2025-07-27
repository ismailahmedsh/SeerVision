const jwt = require('jsonwebtoken');

const generateAccessToken = (user) => {
  console.log('[AUTH_UTILS] Generating access token for user:', user);
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role || 'user'
  };
  console.log('[AUTH_UTILS] Access token payload:', payload);
  
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' });
};

const generateRefreshToken = (user) => {
  console.log('[AUTH_UTILS] Generating refresh token for user:', user);
  const payload = {
    id: user.id,
    email: user.email
  };
  console.log('[AUTH_UTILS] Refresh token payload:', payload);
  
  return jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });
};

module.exports = {
  generateAccessToken,
  generateRefreshToken
};