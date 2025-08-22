const express = require('express');
const UserService = require('../services/userService.js');
const { authenticateToken } = require('./middleware/auth.js');

const router = express.Router();

// Get all users
router.get('/', async (req, res) => {
  try {
    const users = await UserService.getAllUsers();

    const response = {
      success: true,
      data: users
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('[USER ROUTES] Error getting users:', error.message);
    res.status(500).json({
      message: 'Internal server error while retrieving users'
    });
  }
});

// Create a new user
router.post('/', async (req, res) => {
  try {
    const { email, password, name, role } = req.body;

    if (!email || !password) {
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

    const user = await UserService.createUser(userData);

    const response = {
      success: true,
      data: user
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('[USER ROUTES] Error creating user:', error.message);
    res.status(400).json({
      message: error.message
    });
  }
});

// Update user profile (authenticated)
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;

    if (name === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Name is required'
      });
    }

    const updatedUser = await UserService.updateUser(req.user.id, { name });

    const response = {
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('[USER ROUTES] Error updating user profile:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error while updating profile'
    });
  }
});

// Get user by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        message: 'User ID is required'
      });
    }

    const user = await UserService.getUserById(id);

    if (!user) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    const response = {
      success: true,
      data: user
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('[USER ROUTES] Error getting user:', error.message);
    res.status(500).json({
      message: 'Internal server error while retrieving user'
    });
  }
});

module.exports = router;