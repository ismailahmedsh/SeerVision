const express = require('express');
const router = express.Router();
const UserService = require('../services/userService');
const { generateAccessToken, generateRefreshToken } = require('../utils/auth');
const jwt = require('jsonwebtoken');

// Register endpoint
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    // Check if user already exists
    const existingUser = await UserService.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        error: 'User with this email already exists'
      });
    }

    // Create new user
    const userData = {
      email,
      password,
      name: name || '',
      role: 'user'
    };

    const user = await UserService.createUser(userData);
    
    // Generate tokens
    const accessToken = generateAccessToken({ id: user.id, email: user.email });
    const refreshToken = generateRefreshToken({ id: user.id, email: user.email });

    // Store refresh token
    await UserService.updateRefreshToken(user.id, refreshToken);
    
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('[AUTH_ROUTES] Error in register:', error.message);
    res.status(500).json({
      error: error.message || 'Registration failed'
    });
  }
});

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    // Authenticate user
    const user = await UserService.authenticateUser(email, password);
    
    if (!user) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    // Generate tokens
    const accessToken = generateAccessToken({ id: user.id, email: user.email });
    const refreshToken = generateRefreshToken({ id: user.id, email: user.email });

    // Store refresh token and update last login
    await UserService.updateRefreshToken(user.id, refreshToken);
    await UserService.updateLastLogin(user.id);
    
    res.json({
      success: true,
      message: 'Login successful',
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('[AUTH_ROUTES] Error in login:', error.message);
    res.status(500).json({
      error: error.message || 'Login failed'
    });
  }
});

// Refresh token endpoint
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        error: 'Refresh token is required'
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    
    // Check if refresh token exists in database
    const user = await UserService.getUserByRefreshToken(refreshToken);
    if (!user) {
      return res.status(403).json({
        error: 'Invalid refresh token'
      });
    }

    // Generate new access token
    const accessToken = generateAccessToken({ id: user.id, email: user.email });

    res.json({
      success: true,
      accessToken
    });
  } catch (error) {
    console.error('[AUTH_ROUTES] Error in refresh:', error.message);
    res.status(403).json({
      error: 'Invalid or expired refresh token'
    });
  }
});

// Logout endpoint
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      // Remove refresh token from database
      await UserService.clearRefreshToken(refreshToken);
    }

    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('[AUTH_ROUTES] Error in logout:', error.message);
    res.status(500).json({
      error: 'Logout failed'
    });
  }
});

// Get user details endpoint
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: 'Access token required'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await UserService.getUserById(decoded.id);

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }
    
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('[AUTH_ROUTES] Error in /me:', error.message);
    res.status(401).json({
      error: 'Invalid or expired token'
    });
  }
});

module.exports = router;