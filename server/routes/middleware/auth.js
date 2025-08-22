const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    console.error('[AUTH_MIDDLEWARE] No token provided');
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('[AUTH_MIDDLEWARE] Token verification failed:', error.message);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    } else {
      return res.status(401).json({ error: 'Token verification failed' });
    }
  }
};

module.exports = { authenticateToken };