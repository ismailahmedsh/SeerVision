const sqlite3 = require('sqlite3').verbose();
const path = require('path');

let db = null;

const connectDB = async () => {
  return new Promise((resolve, reject) => {
    try {
      console.log('[DATABASE] Attempting to connect to database...');
      const dbPath = path.resolve(process.env.DATABASE_PATH);
      console.log('[DATABASE] Database path:', dbPath);

      db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('[DATABASE] Connection error:', err.message);
          reject(err);
        } else {
          console.log('[DATABASE] Connected to SQLite database successfully');
          
          // Initialize tables after connection
          initializeTables()
            .then(() => {
              console.log('[DATABASE] Tables initialized successfully');
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
      console.log('[DATABASE] Starting table initialization');

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
        console.log('[DATABASE] Creating users table...');
        db.run(createUsersTable, (err) => {
          if (err) {
            console.error('[DATABASE] Error creating users table:', err.message);
            reject(err);
            return;
          }
          console.log('[DATABASE] Users table created successfully');
        });

        console.log('[DATABASE] Creating cameras table...');
        db.run(createCamerasTable, (err) => {
          if (err) {
            console.error('[DATABASE] Error creating cameras table:', err.message);
            reject(err);
            return;
          }
          console.log('[DATABASE] Cameras table created successfully');
        });

        console.log('[DATABASE] Creating video_analysis table...');
        db.run(createVideoAnalysisTable, (err) => {
          if (err) {
            console.error('[DATABASE] Error creating video_analysis table:', err.message);
            reject(err);
            return;
          }
          console.log('[DATABASE] Video analysis table created successfully');
        });

        console.log('[DATABASE] Creating analysis_results table...');
        db.run(createAnalysisResultsTable, (err) => {
          if (err) {
            console.error('[DATABASE] Error creating analysis_results table:', err.message);
            reject(err);
            return;
          }
          console.log('[DATABASE] Analysis results table created successfully');
          
          console.log('[DATABASE] Creating live_results table...');
          db.run(createLiveResultsTable, (err) => {
            if (err) {
              console.error('[DATABASE] Error creating live_results table:', err.message);
              reject(err);
              return;
            }
            console.log('[DATABASE] Live results table created successfully');
            
            // Create indices for live_results table for better analytics performance
            console.log('[DATABASE] Creating indices for live_results table...');
            db.run("CREATE INDEX IF NOT EXISTS idx_live_results_ts ON live_results(ts)", (err) => {
              if (err) {
                console.error('[DATABASE] Error creating ts index:', err.message);
              } else {
                console.log('[DATABASE] ts index created successfully');
              }
            });
            
            db.run("CREATE INDEX IF NOT EXISTS idx_live_results_camera_ts ON live_results(cameraId, ts)", (err) => {
              if (err) {
                console.error('[DATABASE] Error creating cameraId+ts index:', err.message);
              } else {
                console.log('[DATABASE] cameraId+ts index created successfully');
              }
            });
            
            db.run("CREATE INDEX IF NOT EXISTS idx_live_results_prompt_ts ON live_results(promptId, ts)", (err) => {
              if (err) {
                console.error('[DATABASE] Error creating promptId+ts index:', err.message);
              } else {
                console.log('[DATABASE] promptId+ts index created successfully');
              }
            });
            
            // Run migrations after all tables are created
            runMigrations()
              .then(() => {
                console.log('[DATABASE] All tables and migrations completed successfully');
                // Ensure memory column exists as a fallback
                return ensureMemoryColumnExists();
              })
              .then(() => {
                console.log('[DATABASE] Memory column verification completed');
                
                // Log Memory subsystem readiness
                console.log('[MEMORY_SUBSYSTEM] Memory subsystem ready');
                console.log('[MEMORY_SUBSYSTEM] Buffer idle timeout: 5 minutes');
                console.log('[MEMORY_SUBSYSTEM] Buffer size formula:');
                console.log('[MEMORY_SUBSYSTEM] - ≥120s interval: 80 entries');
                console.log('[MEMORY_SUBSYSTEM] - ≥60s interval: 50 entries');
                console.log('[MEMORY_SUBSYSTEM] - <10s interval: max(15, min(20, 2×interval))');
                console.log('[MEMORY_SUBSYSTEM] - 10-119s interval: 20 + (interval-10) × (30/50)');
                console.log('[MEMORY_SUBSYSTEM] Memory subsystem initialization complete');
                
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

const runMigrations = async () => {
  return new Promise((resolve, reject) => {
    try {
      console.log('[DATABASE] Running migrations...');

      // Check if jsonOption column exists in video_analysis table
      db.all("PRAGMA table_info(video_analysis)", (err, columns) => {
        if (err) {
          console.error('[DATABASE] Error checking table info:', err.message);
          reject(err);
          return;
        }

        const hasJsonOption = columns.some(col => col.name === 'jsonOption');
        const hasVideoAnalysisMemory = columns.some(col => col.name === 'memory');
        
        if (!hasJsonOption) {
          console.log('[DATABASE] Adding jsonOption column to video_analysis table...');
          db.run("ALTER TABLE video_analysis ADD COLUMN jsonOption INTEGER DEFAULT 0", (alterErr) => {
            if (alterErr) {
              console.error('[DATABASE] Error adding jsonOption column:', alterErr.message);
              reject(alterErr);
              return;
            }
            console.log('[DATABASE] jsonOption column added successfully');
            
            // Continue with video_analysis memory column check
            checkVideoAnalysisMemoryColumn();
          });
        } else {
          console.log('[DATABASE] jsonOption column already exists');
          checkVideoAnalysisMemoryColumn();
        }

        function checkVideoAnalysisMemoryColumn() {
          if (!hasVideoAnalysisMemory) {
            console.log('[DATABASE] Adding memory column to video_analysis table...');
            db.run("ALTER TABLE video_analysis ADD COLUMN memory INTEGER DEFAULT 0", (alterErr) => {
              if (alterErr) {
                console.error('[DATABASE] Error adding memory column to video_analysis:', alterErr.message);
                reject(alterErr);
                return;
              }
              console.log('[DATABASE] memory column added to video_analysis successfully');
              
              // Continue with cameras table memory column check
              checkCamerasMemoryColumn();
            });
          } else {
            console.log('[DATABASE] memory column already exists in video_analysis');
            checkCamerasMemoryColumn();
          }
        }

        function checkCamerasMemoryColumn() {
          // Check if memory column exists in cameras table
          db.all("PRAGMA table_info(cameras)", (err, cameraColumns) => {
            if (err) {
              console.error('[DATABASE] Error checking cameras table info:', err.message);
              reject(err);
              return;
            }

            const hasCamerasMemory = cameraColumns.some(col => col.name === 'memory');
            console.log('[DATABASE] Cameras table columns:', cameraColumns.map(col => col.name));
            console.log('[DATABASE] Has memory column in cameras:', hasCamerasMemory);
            
            if (!hasCamerasMemory) {
              console.log('[DATABASE] Adding memory column to cameras table...');
              db.run("ALTER TABLE cameras ADD COLUMN memory INTEGER DEFAULT 0", (alterErr) => {
                if (alterErr) {
                  console.error('[DATABASE] Error adding memory column to cameras:', alterErr.message);
                  reject(err);
                  return;
                }
                console.log('[DATABASE] memory column added to cameras successfully');
                
                // Continue with users table schema check
                checkUsersTableSchema();
              });
            } else {
              console.log('[DATABASE] memory column already exists in cameras table');
              // Continue with users table schema check
              checkUsersTableSchema();
            }
          });
        }

        function checkUsersTableSchema() {
          // Check if users table has the correct schema
          db.all("PRAGMA table_info(users)", (err, userColumns) => {
            if (err) {
              console.error('[DATABASE] Error checking users table info:', err.message);
              reject(err);
              return;
            }

            console.log('[DATABASE] Users table columns:', userColumns.map(col => col.name));
            
            const hasLastLoginAt = userColumns.some(col => col.name === 'lastLoginAt');
            const hasIsActive = userColumns.some(col => col.name === 'isActive');
            
            // Fix lastLogin column name if needed
            if (!hasLastLoginAt) {
              console.log('[DATABASE] Fixing users table schema - adding lastLoginAt column...');
              db.run("ALTER TABLE users ADD COLUMN lastLoginAt DATETIME", (alterErr) => {
                if (alterErr) {
                  console.error('[DATABASE] Error adding lastLoginAt column:', alterErr.message);
                } else {
                  console.log('[DATABASE] lastLoginAt column added successfully');
                }
                
                // Continue with isActive column check
                checkIsActiveColumn();
              });
            } else {
              console.log('[DATABASE] lastLoginAt column already exists');
              checkIsActiveColumn();
            }

            function checkIsActiveColumn() {
              if (!hasIsActive) {
                console.log('[DATABASE] Adding isActive column to users table...');
                db.run("ALTER TABLE users ADD COLUMN isActive INTEGER DEFAULT 1", (alterErr) => {
                  if (alterErr) {
                    console.error('[DATABASE] Error adding isActive column:', alterErr.message);
                  } else {
                    console.log('[DATABASE] isActive column added successfully');
                  }
                  
                  // Migration complete
                  resolve();
                });
              } else {
                console.log('[DATABASE] isActive column already exists');
                resolve();
              }
            }
          });
        }
      });

    } catch (error) {
      console.error('[DATABASE] Critical error in runMigrations:', error);
      reject(error);
    }
  });
};

const ensureMemoryColumnExists = async () => {
  return new Promise((resolve, reject) => {
    try {
      console.log('[DATABASE] Ensuring memory column exists in cameras table...');
      
      db.all("PRAGMA table_info(cameras)", (err, columns) => {
        if (err) {
          console.error('[DATABASE] Error checking cameras table info:', err.message);
          reject(err);
          return;
        }

        const hasMemory = columns.some(col => col.name === 'memory');
        console.log('[DATABASE] Cameras table columns:', columns.map(col => col.name));
        console.log('[DATABASE] Has memory column:', hasMemory);
        
        if (!hasMemory) {
          console.log('[DATABASE] Adding memory column to cameras table...');
          db.run("ALTER TABLE cameras ADD COLUMN memory INTEGER DEFAULT 0", (alterErr) => {
            if (alterErr) {
              console.error('[DATABASE] Error adding memory column:', alterErr.message);
              reject(alterErr);
              return;
            }
            console.log('[DATABASE] Memory column added successfully');
            resolve();
          });
        } else {
          console.log('[DATABASE] Memory column already exists');
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

const closeDB = () => {
  return new Promise((resolve, reject) => {
    if (db) {
      db.close((err) => {
        if (err) {
          console.error('[DATABASE] Error closing database:', err.message);
          reject(err);
        } else {
          console.log('[DATABASE] Database connection closed');
          db = null;
          resolve();
        }
      });
    } else {
      resolve();
    }
  });
};

module.exports = {
  connectDB,
  getDb,
  closeDB,
  ensureMemoryColumnExists
};