const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  console.log('[AUTH_MIDDLEWARE] Authenticating request');
  
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    console.log('[AUTH_MIDDLEWARE] No token provided');
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    console.log('[AUTH_MIDDLEWARE] Verifying token');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('[AUTH_MIDDLEWARE] Decoded token:', decoded);
    
    // Extract user ID from token - handle both 'id' and 'sub' properties
    const userId = decoded.id || decoded.sub;
    console.log('[AUTH_MIDDLEWARE] Extracted user ID:', userId);
    
    if (!userId) {
      console.error('[AUTH_MIDDLEWARE] No user ID found in token');
      return res.status(403).json({ error: 'Invalid token structure' });
    }
    
    req.user = {
      id: userId,
      email: decoded.email,
      role: decoded.role
    };
    
    console.log('[AUTH_MIDDLEWARE] Token verified for user:', req.user.id);
    next();
  } catch (error) {
    console.error('[AUTH_MIDDLEWARE] Token verification failed:', error.message);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

module.exports = {
  authenticateToken
};