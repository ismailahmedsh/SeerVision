const express = require('express');
const UserService = require('../services/userService.js');
const { requireUser } = require('./middleware/auth.js');

const router = express.Router();

// Add middleware to log all requests to user routes
router.use((req, res, next) => {
  console.log(`[USER ROUTES] ${req.method} ${req.originalUrl}`);
  console.log(`[USER ROUTES] Headers:`, req.headers);
  console.log(`[USER ROUTES] Body:`, req.body);
  next();
});

// Get all users
router.get('/', async (req, res) => {
  console.log('[USER ROUTES] GET / - Getting all users');

  try {
    console.log('[USER ROUTES] Calling UserService.list()');
    const users = await UserService.list();
    console.log('[USER ROUTES] Retrieved', users.length, 'users');

    const response = {
      success: true,
      data: users.map(user => user.toObject())
    };
    console.log('[USER ROUTES] Sending response with', users.length, 'users');

    res.status(200).json(response);
  } catch (error) {
    console.error('[USER ROUTES] Error getting users:', error.message);
    console.error('[USER ROUTES] Error stack:', error.stack);
    res.status(500).json({
      message: 'Internal server error while retrieving users'
    });
  }
});

// Create a new user
router.post('/', async (req, res) => {
  console.log('[USER ROUTES] POST / - Creating new user');
  console.log('[USER ROUTES] Request body:', JSON.stringify(req.body, null, 2));

  try {
    const { email, password, name, role } = req.body;

    console.log('[USER ROUTES] Extracted fields:', { email, password: password ? '[PROVIDED]' : '[MISSING]', name, role });

    if (!email || !password) {
      console.log('[USER ROUTES] Missing required fields: email or password');
      return res.status(400).json({
        message: 'Email and password are required'
      });
    }

    const userData = {
      email,
      password,
      name: name || '',
      role: role || 'user'
    };

    console.log('[USER ROUTES] Calling UserService.create with:', { ...userData, password: '[HIDDEN]' });
    const user = await UserService.create(userData);
    console.log('[USER ROUTES] User created successfully:', user.email);

    const response = {
      success: true,
      data: user.toObject()
    };
    console.log('[USER ROUTES] Sending response:', JSON.stringify(response, null, 2));

    res.status(201).json(response);
  } catch (error) {
    console.error('[USER ROUTES] Error creating user:', error.message);
    console.error('[USER ROUTES] Error stack:', error.stack);
    res.status(400).json({
      message: error.message
    });
  }
});

// Get user by ID
router.get('/:id', async (req, res) => {
  console.log('[USER ROUTES] GET /:id - Getting user by ID:', req.params.id);

  try {
    const { id } = req.params;

    if (!id) {
      console.log('[USER ROUTES] Missing user ID parameter');
      return res.status(400).json({
        message: 'User ID is required'
      });
    }

    console.log('[USER ROUTES] Calling UserService.get with ID:', id);
    const user = await UserService.get(id);

    if (!user) {
      console.log('[USER ROUTES] User not found with ID:', id);
      return res.status(404).json({
        message: 'User not found'
      });
    }

    console.log('[USER ROUTES] User retrieved successfully:', user.email);
    const response = {
      success: true,
      data: user.toObject()
    };
    console.log('[USER ROUTES] Sending response:', JSON.stringify(response, null, 2));
    
    res.status(200).json(response);
  } catch (error) {
    console.error('[USER ROUTES] Error getting user:', error.message);
    console.error('[USER ROUTES] Error stack:', error.stack);
    res.status(500).json({
      message: 'Internal server error while retrieving user'
    });
  }
});

module.exports = router;