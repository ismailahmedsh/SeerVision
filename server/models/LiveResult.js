const { getDb } = require('../config/database');

class LiveResult {
  static async create(resultData) {
    return new Promise((resolve, reject) => {
      try {
        const db = getDb();
        if (!db) {
          throw new Error('Database connection is not available');
        }

        const { cameraId, promptId, promptText, success, confidence, meta } = resultData;

        const query = `
          INSERT INTO live_results (cameraId, promptId, promptText, success, confidence, meta, ts)
          VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;

        db.run(query, [cameraId, promptId, promptText, success ? 1 : 0, confidence, meta ? JSON.stringify(meta) : null], function(err) {
          if (err) {
            console.error('Error creating live result:', err.message);
            reject(err);
          } else {

            resolve({
              id: this.lastID,
              cameraId,
              promptId,
              promptText,
              success,
              confidence,
              meta,
              ts: new Date().toISOString()
            });
          }
        });
      } catch (error) {
        console.error('Error in create:', error.message);
        reject(error);
      }
    });
  }



  static async getSummary(from, to, userId) {
    return new Promise((resolve, reject) => {
      try {
        const db = getDb();
        if (!db) {
          throw new Error('Database connection not available');
        }

        const query = `
          SELECT 
            COUNT(*) as totalDetections,
            AVG(lr.confidence) as averageConfidence,
            COUNT(DISTINCT lr.cameraId) as activeCameras
          FROM live_results lr
          JOIN cameras c ON lr.cameraId = c.id
          WHERE lr.success = 1 
          AND datetime(lr.ts) BETWEEN datetime(?) AND datetime(?)
          AND c.userId = ?
        `;

        db.get(query, [from, to, userId], (err, row) => {
          if (err) {
            console.error('Error getting summary:', err.message);
            reject(err);
          } else {
            resolve(row);
          }
        });
      } catch (error) {
        console.error('Error in getSummary:', error.message);
        reject(error);
      }
    });
  }

  static async getTopQueries(from, to, limit = 5, userId) {
    return new Promise((resolve, reject) => {
      try {
        const db = getDb();
        if (!db) {
          throw new Error('Database connection not available');
        }

        const query = `
          SELECT 
            COALESCE(lr.promptText, 'Unknown Query') as query,
            COUNT(*) as count,
            AVG(lr.confidence) as confidence,
            MIN(lr.ts) as firstUsed,
            MAX(lr.ts) as lastUsed
          FROM live_results lr
          JOIN cameras c ON lr.cameraId = c.id
          WHERE lr.success = 1 
          AND datetime(lr.ts) BETWEEN datetime(?) AND datetime(?)
          AND c.userId = ?
          GROUP BY lr.promptText
          ORDER BY count DESC
          LIMIT ?
        `;

        db.all(query, [from, to, userId, limit], (err, rows) => {
          if (err) {
            console.error('Error getting top queries:', err.message);
            reject(err);
          } else {
            resolve(rows);
          }
        });
      } catch (error) {
        console.error('Error in getTopQueries:', error.message);
        reject(error);
      }
    });
  }

  static async getCameraPerformance(from, to, userId) {
    return new Promise((resolve, reject) => {
      try {
        const db = getDb();
        if (!db) {
          throw new Error('Database connection not available');
        }

        const query = `
          SELECT 
            c.id as cameraId,
            c.name,
            COUNT(*) as detections,
            AVG(lr.confidence) as confidence
          FROM live_results lr
          JOIN cameras c ON lr.cameraId = c.id
          WHERE lr.success = 1 
          AND datetime(lr.ts) BETWEEN datetime(?) AND datetime(?)
          AND c.userId = ?
          GROUP BY lr.cameraId, c.name
          ORDER BY detections DESC
        `;

        db.all(query, [from, to, userId], (err, rows) => {
          if (err) {
            console.error('Error getting camera performance:', err.message);
            reject(err);
          } else {
            resolve(rows);
          }
        });
      } catch (error) {
        console.error('Error in getCameraPerformance:', error.message);
        reject(error);
      }
    });
  }

  static async getTimeseriesDetections(from, to, timeRange = '7d') {
    return new Promise((resolve, reject) => {
      try {
        const db = getDb();
        if (!db) {
          throw new Error('Database connection not available');
        }

        const query = this._generateTimeseriesQuery(timeRange, 'detections');
        
        db.all(query, [from, to], (err, rows) => {
          if (err) {
            console.error('Error getting timeseries detections:', err.message);
            reject(err);
          } else {
            resolve(rows);
          }
        });
      } catch (error) {
        console.error('Error in getTimeseriesDetections:', error.message);
        reject(error);
      }
    });
  }

  static async getTimeseriesConfidence(from, to, timeRange = '7d') {
    return new Promise((resolve, reject) => {
      try {
        const db = getDb();
        if (!db) {
          throw new Error('Database connection not available');
        }

        const query = this._generateTimeseriesQuery(timeRange, 'confidence');
        
        db.all(query, [from, to], (err, rows) => {
          if (err) {
            console.error('Error getting timeseries confidence:', err.message);
            reject(err);
          } else {
            resolve(rows);
          }
        });
      } catch (error) {
        console.error('Error in getTimeseriesConfidence:', error.message);
        reject(error);
      }
    });
  }

  // Helper function to generate timeseries queries - eliminates massive code duplication
  static _generateTimeseriesQuery(timeRange, queryType) {
    // Define time bucket configurations
    const timeConfigs = {
      '1h': { interval: '+1 minute', format: '%Y-%m-%d %H:%M:00' },
      '6h': { interval: '+5 minutes', format: '%Y-%m-%d %H:%M:00' },
      '24h': { interval: '+15 minutes', format: '%Y-%m-%d %H:%M:00' },
      '7d': { interval: '+1 hour', format: '%Y-%m-%d %H:00:00' },
      '30d': { interval: '+1 day', format: '%Y-%m-%d' }
    };

    const config = timeConfigs[timeRange] || timeConfigs['7d'];
    
    if (queryType === 'detections') {
      return `
        WITH RECURSIVE time_buckets AS (
          SELECT datetime(?) as bucket_start
          UNION ALL
          SELECT datetime(bucket_start, '${config.interval}')
          FROM time_buckets
          WHERE bucket_start < datetime(?)
        ),
        detections_per_bucket AS (
          SELECT 
            strftime('${config.format}', tb.bucket_start) as bucket,
            COUNT(lr.id) as detections
          FROM time_buckets tb
          LEFT JOIN live_results lr ON 
            strftime('${config.format}', lr.ts) = strftime('${config.format}', tb.bucket_start)
            AND lr.success = 1
          GROUP BY tb.bucket_start
        )
        SELECT 
          bucket as t,
          COALESCE(detections, 0) as detections
        FROM detections_per_bucket
        ORDER BY bucket
      `;
    } else if (queryType === 'confidence') {
      return `
        WITH RECURSIVE time_buckets AS (
          SELECT datetime(?) as bucket_start
          UNION ALL
          SELECT datetime(bucket_start, '${config.interval}')
          FROM time_buckets
          WHERE bucket_start < datetime(?)
        ),
        confidence_per_bucket AS (
          SELECT 
            strftime('${config.format}', tb.bucket_start) as bucket,
            AVG(lr.confidence) as avgConfidence,
            COUNT(lr.id) as count
          FROM time_buckets tb
          LEFT JOIN live_results lr ON 
            strftime('${config.format}', lr.ts) = strftime('${config.format}', tb.bucket_start)
            AND lr.success = 1
          GROUP BY tb.bucket_start
        )
        SELECT 
          bucket as t,
          CASE 
            WHEN count > 0 THEN avgConfidence
            ELSE NULL
          END as avgConfidence
        FROM confidence_per_bucket
        ORDER BY bucket
      `;
    }
  }
}

module.exports = LiveResult;

