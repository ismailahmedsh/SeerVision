const { getDb } = require('../config/database');

class Camera {
  static async create(cameraData) {
    return new Promise((resolve, reject) => {
      try {
        const db = getDb();
        if (!db) {
          throw new Error('Database connection is not available');
        }

        const { name, type, streamUrl, userId } = cameraData;

        console.log('[CAMERA_MODEL] Creating camera:', { name, type, streamUrl, userId });

        const query = `
          INSERT INTO cameras (name, type, streamUrl, userId, status, lastSeen, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, 'connected', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `;

        db.run(query, [name, type, streamUrl, userId], function(err) {
          if (err) {
            console.error('[CAMERA_MODEL] Error creating camera:', err.message);
            console.error('[CAMERA_MODEL] Error stack:', err.stack);
            reject(err);
          } else {
            console.log('[CAMERA_MODEL] Camera created with ID:', this.lastID);
            Camera.findById(this.lastID)
              .then(camera => resolve(camera))
              .catch(findErr => {
                console.error('[CAMERA_MODEL] Error finding created camera:', findErr);
                reject(findErr);
              });
          }
        });
      } catch (error) {
        console.error('[CAMERA_MODEL] CRITICAL ERROR in create:', error.message);
        console.error('[CAMERA_MODEL] Error stack:', error.stack);
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

        console.log('[CAMERA_MODEL] Finding all cameras for user:', userId);

        const query = `
          SELECT id as _id, name, type, streamUrl, status, lastSeen,
                 recordingEnabled, motionDetection, alertsEnabled, analysisInterval,
                 resolution, frameRate, bitrate, createdAt, updatedAt
          FROM cameras
          WHERE userId = ?
          ORDER BY createdAt DESC
        `;

        db.all(query, [userId], (err, rows) => {
          if (err) {
            console.error('[CAMERA_MODEL] Error finding cameras:', err.message);
            console.error('[CAMERA_MODEL] Error stack:', err.stack);
            reject(err);
          } else {
            console.log('[CAMERA_MODEL] Found cameras:', rows.length);
            resolve(rows);
          }
        });
      } catch (error) {
        console.error('[CAMERA_MODEL] CRITICAL ERROR in findAll:', error.message);
        console.error('[CAMERA_MODEL] Error stack:', error.stack);
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

        console.log('[CAMERA_MODEL] Finding camera by ID:', id, 'for user:', userId);

        let query = `
          SELECT id as _id, name, type, streamUrl, status, lastSeen,
                 recordingEnabled, motionDetection, alertsEnabled, analysisInterval,
                 resolution, frameRate, bitrate, createdAt, updatedAt, userId
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
            console.error('[CAMERA_MODEL] Error finding camera:', err.message);
            console.error('[CAMERA_MODEL] Error stack:', err.stack);
            reject(err);
          } else {
            console.log('[CAMERA_MODEL] Found camera:', row ? 'Yes' : 'No');
            resolve(row);
          }
        });
      } catch (error) {
        console.error('[CAMERA_MODEL] CRITICAL ERROR in findById:', error.message);
        console.error('[CAMERA_MODEL] Error stack:', error.stack);
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

        console.log('[CAMERA_MODEL] Updating camera:', id, 'with data:', updateData);

        const allowedFields = ['name', 'type', 'streamUrl', 'status', 'recordingEnabled',
                             'motionDetection', 'alertsEnabled', 'analysisInterval',
                             'resolution', 'frameRate', 'bitrate'];

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

        db.run(query, values, function(err) {
          if (err) {
            console.error('[CAMERA_MODEL] Error updating camera:', err.message);
            console.error('[CAMERA_MODEL] Error stack:', err.stack);
            reject(err);
          } else if (this.changes === 0) {
            console.log('[CAMERA_MODEL] No camera found to update');
            reject(new Error('Camera not found or access denied'));
          } else {
            console.log('[CAMERA_MODEL] Camera updated successfully');
            Camera.findById(id, userId)
              .then(camera => resolve(camera))
              .catch(findErr => {
                console.error('[CAMERA_MODEL] Error finding updated camera:', findErr);
                reject(findErr);
              });
          }
        });
      } catch (error) {
        console.error('[CAMERA_MODEL] CRITICAL ERROR in update:', error.message);
        console.error('[CAMERA_MODEL] Error stack:', error.stack);
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

        console.log('[CAMERA_MODEL] Deleting camera:', id, 'for user:', userId);

        const query = 'DELETE FROM cameras WHERE id = ? AND userId = ?';

        db.run(query, [id, userId], function(err) {
          if (err) {
            console.error('[CAMERA_MODEL] Error deleting camera:', err.message);
            console.error('[CAMERA_MODEL] Error stack:', err.stack);
            reject(err);
          } else if (this.changes === 0) {
            console.log('[CAMERA_MODEL] No camera found to delete');
            reject(new Error('Camera not found or access denied'));
          } else {
            console.log('[CAMERA_MODEL] Camera deleted successfully');
            resolve({ success: true, deletedId: id });
          }
        });
      } catch (error) {
        console.error('[CAMERA_MODEL] CRITICAL ERROR in delete:', error.message);
        console.error('[CAMERA_MODEL] Error stack:', error.stack);
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

        console.log('[CAMERA_MODEL] Updating camera status:', id, 'to:', status);

        const query = `
          UPDATE cameras
          SET status = ?, lastSeen = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP
          WHERE id = ?
        `;

        db.run(query, [status, id], function(err) {
          if (err) {
            console.error('[CAMERA_MODEL] Error updating camera status:', err.message);
            console.error('[CAMERA_MODEL] Error stack:', err.stack);
            reject(err);
          } else {
            console.log('[CAMERA_MODEL] Camera status updated');
            resolve({ success: true });
          }
        });
      } catch (error) {
        console.error('[CAMERA_MODEL] CRITICAL ERROR in updateStatus:', error.message);
        console.error('[CAMERA_MODEL] Error stack:', error.stack);
        reject(error);
      }
    });
  }
}

module.exports = Camera;