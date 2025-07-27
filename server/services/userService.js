const User = require('../models/User');

class UserService {
  static async createUser(userData) {
    try {
      console.log('[USER_SERVICE] Creating user with email:', userData.email);
      const user = await User.create(userData);
      console.log('[USER_SERVICE] User created successfully:', user.id);
      return user;
    } catch (error) {
      console.error('[USER_SERVICE] Error creating user:', error.message);
      throw error;
    }
  }

  static async getUserById(id) {
    try {
      console.log('[USER_SERVICE] Getting user by ID:', id);
      const user = await User.findById(id);
      console.log('[USER_SERVICE] User found:', user ? 'Yes' : 'No');
      return user;
    } catch (error) {
      console.error('[USER_SERVICE] Error getting user by ID:', error.message);
      throw error;
    }
  }

  static async getUserByEmail(email) {
    try {
      console.log('[USER_SERVICE] Getting user by email:', email);
      const user = await User.findByEmail(email);
      console.log('[USER_SERVICE] User found:', user ? 'Yes' : 'No');
      return user;
    } catch (error) {
      console.error('[USER_SERVICE] Error getting user by email:', error.message);
      throw error;
    }
  }

  static async authenticateUser(email, password) {
    try {
      console.log('[USER_SERVICE] Authenticating user:', email);
      const user = await User.authenticate(email, password);
      console.log('[USER_SERVICE] Authentication result:', user ? 'Success' : 'Failed');
      return user;
    } catch (error) {
      console.error('[USER_SERVICE] Error authenticating user:', error.message);
      throw error;
    }
  }

  static async getUserByRefreshToken(refreshToken) {
    try {
      console.log('[USER_SERVICE] Getting user by refresh token');
      const user = await User.findByRefreshToken(refreshToken);
      console.log('[USER_SERVICE] User found by refresh token:', user ? 'Yes' : 'No');
      return user;
    } catch (error) {
      console.error('[USER_SERVICE] Error getting user by refresh token:', error.message);
      throw error;
    }
  }

  static async updateRefreshToken(userId, refreshToken) {
    try {
      console.log('[USER_SERVICE] Updating refresh token for user:', userId);
      await User.updateRefreshToken(userId, refreshToken);
      console.log('[USER_SERVICE] Refresh token updated successfully');
    } catch (error) {
      console.error('[USER_SERVICE] Error updating refresh token:', error.message);
      throw error;
    }
  }

  static async clearRefreshToken(refreshToken) {
    try {
      console.log('[USER_SERVICE] Clearing refresh token');
      await User.clearRefreshToken(refreshToken);
      console.log('[USER_SERVICE] Refresh token cleared successfully');
    } catch (error) {
      console.error('[USER_SERVICE] Error clearing refresh token:', error.message);
      throw error;
    }
  }

  static async updateLastLogin(userId) {
    try {
      console.log('[USER_SERVICE] Updating last login for user:', userId);
      await User.updateLastLogin(userId);
      console.log('[USER_SERVICE] Last login updated successfully');
    } catch (error) {
      console.error('[USER_SERVICE] Error updating last login:', error.message);
      throw error;
    }
  }

  static async updateUser(id, updateData) {
    try {
      console.log('[USER_SERVICE] Updating user:', id);
      const user = await User.update(id, updateData);
      console.log('[USER_SERVICE] User updated successfully');
      return user;
    } catch (error) {
      console.error('[USER_SERVICE] Error updating user:', error.message);
      throw error;
    }
  }

  static async deleteUser(id) {
    try {
      console.log('[USER_SERVICE] Deleting user:', id);
      await User.delete(id);
      console.log('[USER_SERVICE] User deleted successfully');
    } catch (error) {
      console.error('[USER_SERVICE] Error deleting user:', error.message);
      throw error;
    }
  }

  static async getAllUsers() {
    try {
      console.log('[USER_SERVICE] Getting all users');
      const users = await User.findAll();
      console.log('[USER_SERVICE] Retrieved users:', users.length);
      return users;
    } catch (error) {
      console.error('[USER_SERVICE] Error getting all users:', error.message);
      throw error;
    }
  }
}

module.exports = UserService;