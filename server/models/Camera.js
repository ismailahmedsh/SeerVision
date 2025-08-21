const { getDb } = require('../config/database');

class Camera {
  static async create(cameraData) {
    return new Promise((resolve, reject) => {
      try {
        const db = getDb();
        if (!db) {
          throw new Error('Database connection is not available');
        }

        const { name, type, streamUrl, userId, analysisInterval } = cameraData;

        const query = `
          INSERT INTO cameras (name, type, streamUrl, userId, analysisInterval, status, lastSeen, memory, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, 'connected', CURRENT_TIMESTAMP, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `;

        db.run(query, [name, type, streamUrl, userId, analysisInterval || 30], function(err) {
          if (err) {
            console.error('Error creating camera:', err.message);
            reject(err);
          } else {
            Camera.findById(this.lastID)
              .then(camera => resolve(camera))
              .catch(findErr => {
                console.error('Error finding created camera:', findErr);
                reject(findErr);
              });
          }
        });
      } catch (error) {
        console.error('Error in create:', error.message);
        reject(error);
      }
    });
  }

  static async findAll(userId) {
    return new Promise((resolve, reject) => {
      try {
        const db = getDb();
        if (!db) {
          throw new Error('Database connection is not available');
        }

        const query = `
          SELECT id as _id, name, type, streamUrl, status, lastSeen,
                 recordingEnabled, motionDetection, alertsEnabled, analysisInterval,
                 resolution, frameRate, bitrate, 
                 COALESCE(memory, 0) as memory, 
                 createdAt, updatedAt
          FROM cameras
          WHERE userId = ?
          ORDER BY createdAt DESC
        `;

        db.all(query, [userId], (err, rows) => {
          if (err) {
            console.error('Database error:', err.message);
            reject(err);
          } else {
            resolve(rows || []);
          }
        });
      } catch (error) {
        console.error('Error in findAll:', error.message);
        reject(error);
      }
    });
  }

  static async findById(id, userId = null) {
    return new Promise((resolve, reject) => {
      try {
        const db = getDb();
        if (!db) {
          throw new Error('Database connection is not available');
        }

        let query = `
          SELECT id as _id, name, type, streamUrl, status, lastSeen,
                 recordingEnabled, motionDetection, alertsEnabled, analysisInterval,
                 resolution, frameRate, bitrate, 
                 COALESCE(memory, 0) as memory, 
                 createdAt, updatedAt, userId
          FROM cameras
          WHERE id = ?
        `;
        let params = [id];

        if (userId) {
          query += ' AND userId = ?';
          params.push(userId);
        }

        db.get(query, params, (err, row) => {
          if (err) {
            console.error('Error finding camera:', err.message);
            reject(err);
          } else {
            resolve(row);
          }
        });
      } catch (error) {
        console.error('Error in findById:', error.message);
        reject(error);
      }
    });
  }

  static async update(id, updateData, userId) {
    return new Promise((resolve, reject) => {
      try {
        const db = getDb();
        if (!db) {
          throw new Error('Database connection is not available');
        }

        const allowedFields = ['name', 'type', 'streamUrl', 'status', 'recordingEnabled',
                             'motionDetection', 'alertsEnabled', 'analysisInterval',
                             'resolution', 'frameRate', 'bitrate', 'memory'];

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

        updates.push('updatedAt = CURRENT_TIMESTAMP');
        values.push(id, userId);

        const query = `
          UPDATE cameras
          SET ${updates.join(', ')}
          WHERE id = ? AND userId = ?
        `;

        console.log('[CAMERA_MODEL] Update query:', query);
        console.log('[CAMERA_MODEL] Update values:', values);

        db.run(query, values, function(err) {
          if (err) {
            console.error('Error updating camera:', err.message);
            reject(err);
          } else if (this.changes === 0) {
            reject(new Error('Camera not found or access denied'));
          } else {
            console.log('[CAMERA_MODEL] Camera updated successfully, changes:', this.changes);
            Camera.findById(id, userId)
              .then(camera => resolve(camera))
              .catch(findErr => {
                console.error('Error finding updated camera:', findErr);
                reject(findErr);
              });
          }
        });
      } catch (error) {
        console.error('Error in update:', error.message);
        reject(error);
      }
    });
  }

  static async delete(id, userId) {
    return new Promise((resolve, reject) => {
      try {
        const db = getDb();
        if (!db) {
          throw new Error('Database connection is not available');
        }

        const query = 'DELETE FROM cameras WHERE id = ? AND userId = ?';

        db.run(query, [id, userId], function(err) {
          if (err) {
            console.error('Error deleting camera:', err.message);
            reject(err);
          } else if (this.changes === 0) {
            reject(new Error('Camera not found or access denied'));
          } else {
            resolve({ success: true, deletedId: id });
          }
        });
      } catch (error) {
        console.error('Error in delete:', error.message);
        reject(error);
      }
    });
  }

  static async updateStatus(id, status) {
    return new Promise((resolve, reject) => {
      try {
        const db = getDb();
        if (!db) {
          throw new Error('Database connection is not available');
        }

        const query = `
          UPDATE cameras
          SET status = ?, lastSeen = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP
          WHERE id = ?
        `;

        db.run(query, [status, id], function(err) {
          if (err) {
            console.error('Error updating camera status:', err.message);
            reject(err);
          } else {
            resolve({ success: true });
          }
        });
      } catch (error) {
        console.error('Error in updateStatus:', error.message);
        reject(error);
      }
    });
  }
}

module.exports = Camera;