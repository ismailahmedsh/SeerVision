const jwt = require('jsonwebtoken');

const generateAccessToken = (user) => {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role || 'user'
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' });
};

const generateRefreshToken = (user) => {
  const payload = {
    id: user.id,
    email: user.email
  };
  
  return jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });
};

module.exports = {
  generateAccessToken,
  generateRefreshToken
};