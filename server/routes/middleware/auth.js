const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  console.log('[AUTH_MIDDLEWARE] ===== AUTHENTICATE TOKEN START =====');
  console.log('[AUTH_MIDDLEWARE] Request URL:', req.url);
  console.log('[AUTH_MIDDLEWARE] Request method:', req.method);
  console.log('[AUTH_MIDDLEWARE] Request headers:', req.headers);

  const authHeader = req.headers['authorization'];
  console.log('[AUTH_MIDDLEWARE] Authorization header:', authHeader);

  const token = authHeader && authHeader.split(' ')[1];
  console.log('[AUTH_MIDDLEWARE] Extracted token:', token ? 'Present' : 'Missing');

  if (!token) {
    console.error('[AUTH_MIDDLEWARE] No token provided');
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    console.log('[AUTH_MIDDLEWARE] Verifying token...');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('[AUTH_MIDDLEWARE] Token verified successfully');
    console.log('[AUTH_MIDDLEWARE] Decoded user:', decoded);

    req.user = decoded;
    console.log('[AUTH_MIDDLEWARE] User set in request:', req.user);
    console.log('[AUTH_MIDDLEWARE] ===== AUTHENTICATE TOKEN SUCCESS =====');
    next();
  } catch (error) {
    console.error('[AUTH_MIDDLEWARE] ===== AUTHENTICATE TOKEN ERROR =====');
    console.error('[AUTH_MIDDLEWARE] Token verification failed:', error.message);
    console.error('[AUTH_MIDDLEWARE] Error details:', error);
    
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