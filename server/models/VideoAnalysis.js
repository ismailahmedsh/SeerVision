const { getDb } = require('../config/database');

class VideoAnalysis {
  static async create(analysisData) {
    return new Promise((resolve, reject) => {
      try {
        const db = getDb();
        if (!db) {
          throw new Error('Database connection is not available');
        }

        const { streamId, cameraId, userId, prompt, status, analysisInterval } = analysisData;

        console.log('[VIDEO_ANALYSIS_MODEL] Creating analysis session:', { streamId, cameraId, userId, prompt });

        const query = `
          INSERT INTO video_analysis (streamId, cameraId, userId, prompt, status, analysisInterval, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `;

        db.run(query, [streamId, cameraId, userId, prompt, status, analysisInterval], function(err) {
          if (err) {
            console.error('[VIDEO_ANALYSIS_MODEL] Error creating analysis:', err.message);
            reject(err);
          } else {
            console.log('[VIDEO_ANALYSIS_MODEL] Analysis created with ID:', this.lastID);
            VideoAnalysis.findById(this.lastID)
              .then(analysis => resolve(analysis))
              .catch(findErr => reject(findErr));
          }
        });
      } catch (error) {
        console.error('[VIDEO_ANALYSIS_MODEL] CRITICAL ERROR in create:', error.message);
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
          SELECT id as _id, streamId, cameraId, userId, prompt, status, analysisInterval,
                 createdAt, updatedAt
          FROM video_analysis
          WHERE id = ?
        `;

        db.get(query, [id], (err, row) => {
          if (err) {
            console.error('[VIDEO_ANALYSIS_MODEL] Error finding analysis:', err.message);
            reject(err);
          } else {
            resolve(row);
          }
        });
      } catch (error) {
        console.error('[VIDEO_ANALYSIS_MODEL] CRITICAL ERROR in findById:', error.message);
        reject(error);
      }
    });
  }

  static async findByStreamId(streamId) {
    return new Promise((resolve, reject) => {
      try {
        const db = getDb();
        if (!db) {
          throw new Error('Database connection is not available');
        }

        const query = `
          SELECT id as _id, streamId, cameraId, userId, prompt, status, analysisInterval,
                 createdAt, updatedAt
          FROM video_analysis
          WHERE streamId = ?
        `;

        db.get(query, [streamId], (err, row) => {
          if (err) {
            console.error('[VIDEO_ANALYSIS_MODEL] Error finding analysis by streamId:', err.message);
            reject(err);
          } else {
            resolve(row);
          }
        });
      } catch (error) {
        console.error('[VIDEO_ANALYSIS_MODEL] CRITICAL ERROR in findByStreamId:', error.message);
        reject(error);
      }
    });
  }

  static async updateStatus(streamId, status) {
    return new Promise((resolve, reject) => {
      try {
        const db = getDb();
        if (!db) {
          throw new Error('Database connection is not available');
        }

        const query = `
          UPDATE video_analysis
          SET status = ?, updatedAt = CURRENT_TIMESTAMP
          WHERE streamId = ?
        `;

        db.run(query, [status, streamId], function(err) {
          if (err) {
            console.error('[VIDEO_ANALYSIS_MODEL] Error updating status:', err.message);
            reject(err);
          } else {
            console.log('[VIDEO_ANALYSIS_MODEL] Analysis status updated');
            resolve({ success: true });
          }
        });
      } catch (error) {
        console.error('[VIDEO_ANALYSIS_MODEL] CRITICAL ERROR in updateStatus:', error.message);
        reject(error);
      }
    });
  }

  static async createResult(resultData) {
    return new Promise((resolve, reject) => {
      try {
        const db = getDb();
        if (!db) {
          throw new Error('Database connection is not available');
        }

        const { streamId, answer, accuracyScore, timestamp, rawJson } = resultData;

        const query = `
          INSERT INTO analysis_results (streamId, answer, accuracyScore, timestamp, rawJson, createdAt)
          VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;

        db.run(query, [streamId, answer, accuracyScore, timestamp, rawJson], function(err) {
          if (err) {
            console.error('[VIDEO_ANALYSIS_MODEL] Error creating result:', err.message);
            reject(err);
          } else {
            console.log('[VIDEO_ANALYSIS_MODEL] Analysis result created with ID:', this.lastID);
            resolve({ _id: this.lastID, ...resultData });
          }
        });
      } catch (error) {
        console.error('[VIDEO_ANALYSIS_MODEL] CRITICAL ERROR in createResult:', error.message);
        reject(error);
      }
    });
  }

  static async getResults(streamId, limit = 10) {
    return new Promise((resolve, reject) => {
      try {
        const db = getDb();
        if (!db) {
          throw new Error('Database connection is not available');
        }

        const query = `
          SELECT id as _id, streamId, answer, accuracyScore, timestamp, rawJson, createdAt
          FROM analysis_results
          WHERE streamId = ?
          ORDER BY createdAt DESC
          LIMIT ?
        `;

        db.all(query, [streamId, limit], (err, rows) => {
          if (err) {
            console.error('[VIDEO_ANALYSIS_MODEL] Error getting results:', err.message);
            reject(err);
          } else {
            resolve(rows);
          }
        });
      } catch (error) {
        console.error('[VIDEO_ANALYSIS_MODEL] CRITICAL ERROR in getResults:', error.message);
        reject(error);
      }
    });
  }
}

module.exports = VideoAnalysis;