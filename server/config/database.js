const sqlite3 = require('sqlite3').verbose();
const path = require('path');

let db = null;

const connectDB = async () => {
  return new Promise((resolve, reject) => {
    try {
      const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'database.sqlite');
      console.log(`[DATABASE] Connecting to database at: ${dbPath}`);

      db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('[DATABASE] Error connecting to database:', err.message);
          reject(err);
        } else {
          console.log('[DATABASE] Connected to SQLite database');
          initializeTables()
            .then(() => resolve())
            .catch(reject);
        }
      });
    } catch (error) {
      console.error('[DATABASE] CRITICAL ERROR in connectDB:', error);
      reject(error);
    }
  });
};

const initializeTables = async () => {
  return new Promise((resolve, reject) => {
    console.log('[DATABASE] Initializing database tables...');

    const queries = [
      // Users table
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Cameras table
      `CREATE TABLE IF NOT EXISTS cameras (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        streamUrl TEXT NOT NULL,
        userId INTEGER NOT NULL,
        status TEXT DEFAULT 'disconnected',
        lastSeen DATETIME,
        recordingEnabled BOOLEAN DEFAULT 0,
        motionDetection BOOLEAN DEFAULT 0,
        alertsEnabled BOOLEAN DEFAULT 1,
        analysisInterval INTEGER DEFAULT 30,
        resolution TEXT DEFAULT '1920x1080',
        frameRate INTEGER DEFAULT 30,
        bitrate TEXT DEFAULT '2000kbps',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
      )`,

      // Video analysis sessions table
      `CREATE TABLE IF NOT EXISTS video_analysis (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        streamId TEXT UNIQUE NOT NULL,
        cameraId INTEGER NOT NULL,
        userId INTEGER NOT NULL,
        prompt TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        analysisInterval INTEGER DEFAULT 30,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cameraId) REFERENCES cameras (id) ON DELETE CASCADE,
        FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
      )`
    ];

    let completed = 0;
    const total = queries.length;

    queries.forEach((query, index) => {
      db.run(query, (err) => {
        if (err) {
          console.error(`[DATABASE] Error creating table ${index + 1}:`, err.message);
          reject(err);
        } else {
          completed++;
          console.log(`[DATABASE] Table ${index + 1}/${total} created successfully`);

          if (completed === total) {
            console.log('[DATABASE] All tables initialized successfully');
            // Run migrations after tables are created
            runMigrations()
              .then(() => resolve())
              .catch(reject);
          }
        }
      });
    });
  });
};

const runMigrations = async () => {
  return new Promise((resolve, reject) => {
    console.log('[DATABASE] Running database migrations...');

    // First check if analysis_results table exists at all
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='analysis_results'", (err, row) => {
      if (err) {
        console.error('[DATABASE] Error checking if analysis_results table exists:', err.message);
        reject(err);
        return;
      }

      if (!row) {
        console.log('[DATABASE] analysis_results table does not exist, creating it...');
        // Create the table with correct schema
        const createQuery = `CREATE TABLE analysis_results (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          streamId TEXT NOT NULL,
          answer TEXT NOT NULL,
          accuracyScore REAL DEFAULT 0.75,
          timestamp TEXT NOT NULL,
          rawJson TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (streamId) REFERENCES video_analysis (streamId) ON DELETE CASCADE
        )`;

        db.run(createQuery, (createErr) => {
          if (createErr) {
            console.error('[DATABASE] Error creating analysis_results table:', createErr.message);
            reject(createErr);
          } else {
            console.log('[DATABASE] analysis_results table created successfully');
            resolve();
          }
        });
        return;
      }

      console.log('[DATABASE] analysis_results table exists, checking schema...');

      // Check if analysis_results table has streamId column
      db.all("PRAGMA table_info(analysis_results)", (pragmaErr, columns) => {
        if (pragmaErr) {
          console.error('[DATABASE] Error checking table info:', pragmaErr.message);
          reject(pragmaErr);
          return;
        }

        const hasStreamIdColumn = columns.some(col => col.name === 'streamId');
        console.log('[DATABASE] analysis_results table columns:', columns.map(c => c.name));
        console.log('[DATABASE] Has streamId column:', hasStreamIdColumn);

        if (!hasStreamIdColumn) {
          console.log('[DATABASE] Migrating analysis_results table - recreating with correct schema');
          
          // Drop and recreate the analysis_results table with correct schema
          const migrationQueries = [
            'DROP TABLE IF EXISTS analysis_results',
            `CREATE TABLE analysis_results (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              streamId TEXT NOT NULL,
              answer TEXT NOT NULL,
              accuracyScore REAL DEFAULT 0.75,
              timestamp TEXT NOT NULL,
              rawJson TEXT,
              createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (streamId) REFERENCES video_analysis (streamId) ON DELETE CASCADE
            )`
          ];

          let migrationCompleted = 0;
          const migrationTotal = migrationQueries.length;

          migrationQueries.forEach((query, index) => {
            db.run(query, (migrationErr) => {
              if (migrationErr) {
                console.error(`[DATABASE] Error in migration query ${index + 1}:`, migrationErr.message);
                reject(migrationErr);
              } else {
                migrationCompleted++;
                console.log(`[DATABASE] Migration query ${index + 1}/${migrationTotal} completed`);

                if (migrationCompleted === migrationTotal) {
                  console.log('[DATABASE] Migration completed successfully');
                  resolve();
                }
              }
            });
          });
        } else {
          console.log('[DATABASE] No migration needed - analysis_results table already has correct schema');
          resolve();
        }
      });
    });
  });
};

const getDb = () => {
  if (!db) {
    console.error('[DATABASE] Database connection not established');
    return null;
  }
  return db;
};

const closeDB = async () => {
  return new Promise((resolve, reject) => {
    if (db) {
      console.log('[DATABASE] Closing database connection...');
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