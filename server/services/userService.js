const User = require('../models/User');

class UserService {
  static async createUser(userData) {
    try {
      const user = await User.create(userData);
      return user;
    } catch (error) {
      console.error('[USER_SERVICE] Error creating user:', error.message);
      throw error;
    }
  }

  static async getUserById(id) {
    try {
      const user = await User.findById(id);
      return user;
    } catch (error) {
      console.error('[USER_SERVICE] Error getting user by ID:', error.message);
      throw error;
    }
  }

  static async getUserByEmail(email) {
    try {
      const user = await User.findByEmail(email);
      return user;
    } catch (error) {
      console.error('[USER_SERVICE] Error getting user by email:', error.message);
      throw error;
    }
  }

  static async authenticateUser(email, password) {
    try {
      const user = await User.authenticate(email, password);
      return user;
    } catch (error) {
      console.error('[USER_SERVICE] Error authenticating user:', error.message);
      throw error;
    }
  }

  static async getUserByRefreshToken(refreshToken) {
    try {
      const user = await User.findByRefreshToken(refreshToken);
      return user;
    } catch (error) {
      console.error('[USER_SERVICE] Error getting user by refresh token:', error.message);
      throw error;
    }
  }

  static async updateRefreshToken(userId, refreshToken) {
    try {
      await User.updateRefreshToken(userId, refreshToken);
    } catch (error) {
      console.error('[USER_SERVICE] Error updating refresh token:', error.message);
      throw error;
    }
  }

  static async clearRefreshToken(refreshToken) {
    try {
      await User.clearRefreshToken(refreshToken);
    } catch (error) {
      console.error('[USER_SERVICE] Error clearing refresh token:', error.message);
      throw error;
    }
  }

  static async updateLastLogin(userId) {
    try {
      await User.updateLastLogin(userId);
    } catch (error) {
      console.error('[USER_SERVICE] Error updating last login:', error.message);
      throw error;
    }
  }

  static async updateUser(id, updateData) {
    try {
      const user = await User.update(id, updateData);
      return user;
    } catch (error) {
      console.error('[USER_SERVICE] Error updating user:', error.message);
      throw error;
    }
  }

  static async deleteUser(id) {
    try {
      await User.delete(id);
    } catch (error) {
      console.error('[USER_SERVICE] Error deleting user:', error.message);
      throw error;
    }
  }

  static async getAllUsers() {
    try {
      const users = await User.findAll();
      return users;
    } catch (error) {
      console.error('[USER_SERVICE] Error getting all users:', error.message);
      throw error;
    }
  }
}

module.exports = UserService;