const { getDb } = require('../config/database');
const { hashPassword, validatePassword } = require('../utils/password');

class User {
  static async create(userData) {
    return new Promise((resolve, reject) => {
      try {
        const db = getDb();
        if (!db) {
          throw new Error('Database connection is not available');
        }

        const { email, password, name = '', role = 'user' } = userData;

        // Hash the password before storing
        hashPassword(password).then(hashedPassword => {
          const query = `
            INSERT INTO users (email, password, name, role, createdAt, lastLoginAt, isActive)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1)
          `;

          db.run(query, [email, hashedPassword, name, role], function(err) {
            if (err) {
              console.error('[USER_MODEL] Error creating user:', err.message);
              if (err.message.includes('UNIQUE constraint failed')) {
                reject(new Error('User with this email already exists'));
              } else {
                reject(err);
              }
            } else {
              User.findById(this.lastID)
                .then(user => resolve(user))
                .catch(findErr => {
                  console.error('[USER_MODEL] Error finding created user:', findErr);
                  reject(findErr);
                });
            }
          });
        }).catch(hashErr => {
          console.error('[USER_MODEL] Error hashing password:', hashErr);
          reject(hashErr);
        });
      } catch (error) {
        console.error('[USER_MODEL] CRITICAL ERROR in create:', error.message);
        reject(error);
      }
    });
  }

  static async findById(id) {
    return new Promise((resolve, reject) => {
      try {
        const db = getDb();
        if (!db) {
          throw new Error('Database connection is not available');
        }

        const query = `
          SELECT id, email, name, role, createdAt, lastLoginAt, isActive
          FROM users
          WHERE id = ?
        `;

        db.get(query, [id], (err, row) => {
          if (err) {
            console.error('[USER_MODEL] Error finding user by ID:', err.message);
            reject(err);
          } else {
            resolve(row);
          }
        });
      } catch (error) {
        console.error('[USER_MODEL] CRITICAL ERROR in findById:', error.message);
        reject(error);
      }
    });
  }

  static async findByEmail(email) {
    return new Promise((resolve, reject) => {
      try {
        const db = getDb();
        if (!db) {
          throw new Error('Database connection is not available');
        }

        const query = `
          SELECT id, email, password, name, role, createdAt, lastLoginAt, isActive
          FROM users
          WHERE email = ?
        `;

        db.get(query, [email], (err, row) => {
          if (err) {
            console.error('[USER_MODEL] Error finding user by email:', err.message);
            reject(err);
          } else {
            resolve(row);
          }
        });
      } catch (error) {
        console.error('[USER_MODEL] CRITICAL ERROR in findByEmail:', error.message);
        reject(error);
      }
    });
  }

  static async authenticate(email, password) {
    return new Promise(async (resolve, reject) => {
      try {
        const user = await User.findByEmail(email);
        if (!user) {
          resolve(null);
          return;
        }

        if (!user.isActive) {
          resolve(null);
          return;
        }

        const isValidPassword = await validatePassword(password, user.password);
        if (isValidPassword) {
          // Return user without password
          const { password: _, ...userWithoutPassword } = user;
          resolve(userWithoutPassword);
        } else {
          resolve(null);
        }
      } catch (error) {
        console.error('[USER_MODEL] Error authenticating user:', error.message);
        reject(error);
      }
    });
  }

  static async findByRefreshToken(refreshToken) {
    return new Promise((resolve, reject) => {
      try {
        const db = getDb();
        if (!db) {
          throw new Error('Database connection is not available');
        }

        const query = `
          SELECT id, email, name, role, createdAt, lastLoginAt, isActive
          FROM users
          WHERE refreshToken = ?
        `;

        db.get(query, [refreshToken], (err, row) => {
          if (err) {
            console.error('[USER_MODEL] Error finding user by refresh token:', err.message);
            reject(err);
          } else {
            resolve(row);
          }
        });
      } catch (error) {
        console.error('[USER_MODEL] CRITICAL ERROR in findByRefreshToken:', error.message);
        reject(error);
      }
    });
  }

  static async updateRefreshToken(userId, refreshToken) {
    return new Promise((resolve, reject) => {
      try {
        const db = getDb();
        if (!db) {
          throw new Error('Database connection is not available');
        }

        const query = `
          UPDATE users
          SET refreshToken = ?
          WHERE id = ?
        `;

        db.run(query, [refreshToken, userId], function(err) {
          if (err) {
            console.error('[USER_MODEL] Error updating refresh token:', err.message);
            reject(err);
          } else {
            resolve();
          }
        });
      } catch (error) {
        console.error('[USER_MODEL] CRITICAL ERROR in updateRefreshToken:', error.message);
        reject(error);
      }
    });
  }

  static async clearRefreshToken(refreshToken) {
    return new Promise((resolve, reject) => {
      try {
        const db = getDb();
        if (!db) {
          throw new Error('Database connection is not available');
        }

        const query = `
          UPDATE users
          SET refreshToken = NULL
          WHERE refreshToken = ?
        `;

        db.run(query, [refreshToken], function(err) {
          if (err) {
            console.error('[USER_MODEL] Error clearing refresh token:', err.message);
            reject(err);
          } else {
            resolve();
          }
        });
      } catch (error) {
        console.error('[USER_MODEL] CRITICAL ERROR in clearRefreshToken:', error.message);
        reject(error);
      }
    });
  }

  static async updateLastLogin(userId) {
    return new Promise((resolve, reject) => {
      try {
        const db = getDb();
        if (!db) {
          throw new Error('Database connection is not available');
        }

        const query = `
          UPDATE users
          SET lastLoginAt = CURRENT_TIMESTAMP
          WHERE id = ?
        `;

        db.run(query, [userId], function(err) {
          if (err) {
            console.error('[USER_MODEL] Error updating last login:', err.message);
            reject(err);
          } else {
            resolve();
          }
        });
      } catch (error) {
        console.error('[USER_MODEL] CRITICAL ERROR in updateLastLogin:', error.message);
        reject(error);
      }
    });
  }

  static async findAll() {
    return new Promise((resolve, reject) => {
      try {
        const db = getDb();
        if (!db) {
          throw new Error('Database connection is not available');
        }

        const query = `
          SELECT id, email, name, role, createdAt, lastLoginAt, isActive
          FROM users
          ORDER BY createdAt DESC
        `;

        db.all(query, [], (err, rows) => {
          if (err) {
            console.error('[USER_MODEL] Error finding all users:', err.message);
            reject(err);
          } else {
            resolve(rows);
          }
        });
      } catch (error) {
        console.error('[USER_MODEL] CRITICAL ERROR in findAll:', error.message);
        reject(error);
      }
    });
  }

  static async update(id, updateData) {
    return new Promise((resolve, reject) => {
      try {
        const db = getDb();
        if (!db) {
          throw new Error('Database connection is not available');
        }

        const allowedFields = ['name', 'role', 'isActive'];
        const updates = [];
        const values = [];

        Object.keys(updateData).forEach(key => {
          if (allowedFields.includes(key)) {
            updates.push(`${key} = ?`);
            values.push(updateData[key]);
          }
        });

        if (updates.length === 0) {
          return reject(new Error('No valid fields to update'));
        }

        values.push(id);

        const query = `
          UPDATE users
          SET ${updates.join(', ')}
          WHERE id = ?
        `;

        db.run(query, values, function(err) {
          if (err) {
            console.error('[USER_MODEL] Error updating user:', err.message);
            reject(err);
          } else if (this.changes === 0) {
            reject(new Error('User not found'));
          } else {
            User.findById(id)
              .then(user => resolve(user))
              .catch(findErr => {
                console.error('[USER_MODEL] Error finding updated user:', findErr);
                reject(findErr);
              });
          }
        });
      } catch (error) {
        console.error('[USER_MODEL] CRITICAL ERROR in update:', error.message);
        reject(error);
      }
    });
  }

  static async delete(id) {
    return new Promise((resolve, reject) => {
      try {
        const db = getDb();
        if (!db) {
          throw new Error('Database connection is not available');
        }

        const query = 'DELETE FROM users WHERE id = ?';

        db.run(query, [id], function(err) {
          if (err) {
            console.error('[USER_MODEL] Error deleting user:', err.message);
            reject(err);
          } else if (this.changes === 0) {
            reject(new Error('User not found'));
          } else {
            resolve({ success: true, deletedId: id });
          }
        });
      } catch (error) {
        console.error('[USER_MODEL] CRITICAL ERROR in delete:', error.message);
        reject(error);
      }
    });
  }
}

module.exports = User;