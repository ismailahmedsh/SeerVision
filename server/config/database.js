const sqlite3 = require('sqlite3').verbose();
const path = require('path');

let db = null;

const connectDB = async () => {
  return new Promise((resolve, reject) => {
    try {
      const dbPath = path.resolve(process.env.DATABASE_PATH);

      db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('[DATABASE] Connection error:', err.message);
          reject(err);
        } else {
          console.log('[DATABASE] Connected to SQLite database successfully');
          
          // Initialize tables after connection
          initializeTables()
            .then(() => {
              resolve();
            })
            .catch((initError) => {
              console.error('[DATABASE] Table initialization failed:', initError);
              reject(initError);
            });
        }
      });

      // Handle database errors
      db.on('error', (err) => {
        console.error('[DATABASE] Database error:', err.message);
      });

    } catch (error) {
      console.error('[DATABASE] Critical error in connectDB:', error);
      reject(error);
    }
  });
};

const initializeTables = async () => {
  return new Promise((resolve, reject) => {
    try {
      // Users table
      const createUsersTable = `
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          name TEXT DEFAULT '',
          role TEXT DEFAULT 'user',
          refreshToken TEXT,
          lastLoginAt DATETIME,
          isActive INTEGER DEFAULT 1,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;

      // Cameras table
      const createCamerasTable = `
        CREATE TABLE IF NOT EXISTS cameras (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userId INTEGER NOT NULL,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          streamUrl TEXT NOT NULL,
          status TEXT DEFAULT 'disconnected',
          lastSeen DATETIME,
          recordingEnabled INTEGER DEFAULT 0,
          motionDetection INTEGER DEFAULT 0,
          alertsEnabled INTEGER DEFAULT 0,
          analysisInterval INTEGER DEFAULT 30,
          memory INTEGER DEFAULT 0,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
        )
      `;

      // Video Analysis table
      const createVideoAnalysisTable = `
        CREATE TABLE IF NOT EXISTS video_analysis (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          streamId TEXT UNIQUE NOT NULL,
          cameraId INTEGER NOT NULL,
          userId INTEGER NOT NULL,
          prompt TEXT NOT NULL,
          status TEXT DEFAULT 'active',
          analysisInterval INTEGER DEFAULT 30,
          jsonOption INTEGER DEFAULT 0,
          memory INTEGER DEFAULT 0,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (cameraId) REFERENCES cameras (id) ON DELETE CASCADE,
          FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
        )
      `;

      // Analysis Results table
      const createAnalysisResultsTable = `
        CREATE TABLE IF NOT EXISTS analysis_results (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          streamId TEXT NOT NULL,
          answer TEXT NOT NULL,
          accuracyScore REAL DEFAULT 0.0,
          timestamp TEXT NOT NULL,
          rawJson TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (streamId) REFERENCES video_analysis (streamId) ON DELETE CASCADE
        )
      `;

      // Live Results table for Analytics
      const createLiveResultsTable = `
        CREATE TABLE IF NOT EXISTS live_results (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          cameraId INTEGER NOT NULL,
          promptId TEXT NOT NULL,
          promptText TEXT NOT NULL,
          success INTEGER DEFAULT 1,
          confidence REAL DEFAULT 0.0,
          meta TEXT,
          ts DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (cameraId) REFERENCES cameras (id) ON DELETE CASCADE
        )
      `;

      // Execute table creation queries
      db.serialize(() => {
        db.run(createUsersTable, (err) => {
          if (err) {
            console.error('[DATABASE] Error creating users table:', err.message);
            reject(err);
            return;
          }
        });

        db.run(createCamerasTable, (err) => {
          if (err) {
            console.error('[DATABASE] Error creating cameras table:', err.message);
            reject(err);
            return;
          }
        });

        db.run(createVideoAnalysisTable, (err) => {
          if (err) {
            console.error('[DATABASE] Error creating video_analysis table:', err.message);
            reject(err);
            return;
          }
        });

        db.run(createAnalysisResultsTable, (err) => {
          if (err) {
            console.error('[DATABASE] Error creating analysis_results table:', err.message);
            reject(err);
            return;
          }
          
          db.run(createLiveResultsTable, (err) => {
            if (err) {
              console.error('[DATABASE] Error creating live_results table:', err.message);
              reject(err);
              return;
            }
            
            // Create indices for live_results table for better analytics performance
            db.run("CREATE INDEX IF NOT EXISTS idx_live_results_ts ON live_results(ts)", (err) => {
              if (err) {
                console.error('[DATABASE] Error creating ts index:', err.message);
              }
            });
            
            db.run("CREATE INDEX IF NOT EXISTS idx_live_results_camera_ts ON live_results(cameraId, ts)", (err) => {
              if (err) {
                console.error('[DATABASE] Error creating cameraId+ts index:', err.message);
              }
            });
            
            db.run("CREATE INDEX IF NOT EXISTS idx_live_results_prompt_ts ON live_results(promptId, ts)", (err) => {
              if (err) {
                console.error('[DATABASE] Error creating promptId+ts index:', err.message);
              }
            });
            
            // Run simplified migrations after all tables are created
            runSimplifiedMigrations()
              .then(() => {
                console.log('[DATABASE] All tables and migrations completed successfully');
                resolve();
              })
              .catch((migrationError) => {
                console.error('[DATABASE] Migration failed:', migrationError);
                reject(migrationError);
              });
          });
        });
      });

    } catch (error) {
      console.error('[DATABASE] Critical error in initializeTables:', error);
      reject(error);
    }
  });
};

// Simplified migration function that handles all column additions
const runSimplifiedMigrations = async () => {
  return new Promise((resolve, reject) => {
    try {
      console.log('[DATABASE] Running simplified migrations...');
      
      // Add missing columns with proper error handling (ignore if already exists)
      const migrations = [
        { table: 'video_analysis', column: 'jsonOption', type: 'INTEGER DEFAULT 0' },
        { table: 'video_analysis', column: 'memory', type: 'INTEGER DEFAULT 0' },
        { table: 'cameras', column: 'memory', type: 'INTEGER DEFAULT 0' },
        { table: 'users', column: 'lastLoginAt', type: 'DATETIME' },
        { table: 'users', column: 'isActive', type: 'INTEGER DEFAULT 1' }
      ];

      let completed = 0;
      const total = migrations.length;

      if (total === 0) {
        resolve();
        return;
      }

      migrations.forEach(({ table, column, type }) => {
        const alterQuery = `ALTER TABLE ${table} ADD COLUMN ${column} ${type}`;
        
        db.run(alterQuery, (err) => {
          if (err && !err.message.includes('duplicate column name')) {
            console.error(`[DATABASE] Error adding ${column} to ${table}:`, err.message);
          } else if (!err) {
            console.log(`[DATABASE] Added ${column} column to ${table} table`);
          }
          
          completed++;
          if (completed === total) {
            console.log('[DATABASE] Simplified migrations completed');
            resolve();
          }
        });
      });

    } catch (error) {
      console.error('[DATABASE] Critical error in runSimplifiedMigrations:', error);
      reject(error);
    }
  });
};

const ensureMemoryColumnExists = async () => {
  return new Promise((resolve, reject) => {
    try {
      db.all("PRAGMA table_info(cameras)", (err, columns) => {
        if (err) {
          console.error('[DATABASE] Error checking cameras table info:', err.message);
          reject(err);
          return;
        }

        const hasMemory = columns.some(col => col.name === 'memory');
        
        if (!hasMemory) {
          db.run("ALTER TABLE cameras ADD COLUMN memory INTEGER DEFAULT 0", (alterErr) => {
            if (alterErr) {
              console.error('[DATABASE] Error adding memory column:', alterErr.message);
              reject(alterErr);
              return;
            }
            console.log('[DATABASE] Memory column added to cameras table');
            resolve();
          });
        } else {
          resolve();
        }
      });
    } catch (error) {
      console.error('[DATABASE] Error in ensureMemoryColumnExists:', error);
      reject(error);
    }
  });
};

const getDb = () => {
  if (!db) {
    console.error('[DATABASE] Database connection is not initialized');
    return null;
  }
  return db;
};

module.exports = {
  connectDB,
  getDb,
  ensureMemoryColumnExists
};