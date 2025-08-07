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
      console.log('[DATABASE] Starting table initialization...');

      // Users table
      const createUsersTable = `
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          name TEXT DEFAULT '',
          role TEXT DEFAULT 'user',
          refreshToken TEXT,
          lastLogin DATETIME,
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
          
          // Run migrations after all tables are created
          runMigrations()
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
        
        if (!hasJsonOption) {
          console.log('[DATABASE] Adding jsonOption column to video_analysis table...');
          db.run("ALTER TABLE video_analysis ADD COLUMN jsonOption INTEGER DEFAULT 0", (alterErr) => {
            if (alterErr) {
              console.error('[DATABASE] Error adding jsonOption column:', alterErr.message);
              reject(alterErr);
              return;
            }
            console.log('[DATABASE] jsonOption column added successfully');
            resolve();
          });
        } else {
          console.log('[DATABASE] jsonOption column already exists');
          resolve();
        }
      });

    } catch (error) {
      console.error('[DATABASE] Critical error in runMigrations:', error);
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
  closeDB
};