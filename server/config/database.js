const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

class Database {
  constructor() {
    this.db = null;
    console.log('[DATABASE] Database class initialized');
  }

  async connect() {
    console.log('[DATABASE] Starting database connection...');
    return new Promise((resolve, reject) => {
      const dbPath = process.env.DATABASE_PATH || './database.sqlite';
      console.log('[DATABASE] Database path:', dbPath);

      try {
        this.db = new sqlite3.Database(dbPath, (err) => {
          if (err) {
            console.error('[DATABASE] Error opening database:', err.message);
            console.error('[DATABASE] Error stack:', err.stack);
            reject(err);
          } else {
            console.log('[DATABASE] Connected to SQLite database:', dbPath);
            this.initializeTables()
              .then(() => {
                console.log('[DATABASE] Database initialization complete');
                resolve();
              })
              .catch((initError) => {
                console.error('[DATABASE] Error during table initialization:', initError);
                console.error('[DATABASE] Error stack:', initError.stack);
                reject(initError);
              });
          }
        });
      } catch (error) {
        console.error('[DATABASE] CRITICAL ERROR creating database connection:', error);
        console.error('[DATABASE] Error stack:', error.stack);
        reject(error);
      }
    });
  }

  async initializeTables() {
    console.log('[DATABASE] Starting table initialization...');
    return new Promise((resolve, reject) => {
      const createUsersTable = `
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          name TEXT DEFAULT '',
          role TEXT DEFAULT 'user',
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          lastLoginAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          isActive BOOLEAN DEFAULT 1,
          refreshToken TEXT UNIQUE
        )
      `;

      const createCamerasTable = `
        CREATE TABLE IF NOT EXISTS cameras (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          streamUrl TEXT NOT NULL,
          status TEXT DEFAULT 'disconnected',
          lastSeen DATETIME DEFAULT CURRENT_TIMESTAMP,
          userId INTEGER NOT NULL,
          recordingEnabled BOOLEAN DEFAULT 1,
          motionDetection BOOLEAN DEFAULT 0,
          alertsEnabled BOOLEAN DEFAULT 1,
          analysisInterval INTEGER DEFAULT 2,
          resolution TEXT DEFAULT '1920x1080',
          frameRate INTEGER DEFAULT 30,
          bitrate TEXT DEFAULT '2000kbps',
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
        )
      `;

      console.log('[DATABASE] Creating users table...');
      this.db.run(createUsersTable, (err) => {
        if (err) {
          console.error('[DATABASE] Error creating users table:', err.message);
          console.error('[DATABASE] Error stack:', err.stack);
          reject(err);
        } else {
          console.log('[DATABASE] Users table initialized successfully');

          console.log('[DATABASE] Creating cameras table...');
          this.db.run(createCamerasTable, (err) => {
            if (err) {
              console.error('[DATABASE] Error creating cameras table:', err.message);
              console.error('[DATABASE] Error stack:', err.stack);
              reject(err);
            } else {
              console.log('[DATABASE] Cameras table initialized successfully');
              console.log('[DATABASE] All tables initialized');
              resolve();
            }
          });
        }
      });
    });
  }

  getDb() {
    if (!this.db) {
      console.error('[DATABASE] WARNING: getDb() called but database is not connected');
    }
    return this.db;
  }

  async close() {
    console.log('[DATABASE] Closing database connection...');
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            console.error('[DATABASE] Error closing database:', err.message);
            console.error('[DATABASE] Error stack:', err.stack);
          } else {
            console.log('[DATABASE] Database connection closed successfully');
          }
          resolve();
        });
      } else {
        console.log('[DATABASE] No database connection to close');
        resolve();
      }
    });
  }
}

const database = new Database();

const connectDB = async () => {
  try {
    console.log('[DATABASE] Starting database connection process...');
    await database.connect();
    console.log('[DATABASE] Database connection process completed successfully');

    // Graceful shutdown
    process.on('SIGINT', async () => {
      try {
        console.log('[DATABASE] Received SIGINT, closing database connection...');
        await database.close();
        console.log('[DATABASE] Database connection closed through app termination');
        process.exit(0);
      } catch (err) {
        console.error('[DATABASE] Error during database shutdown:', err);
        console.error('[DATABASE] Error stack:', err.stack);
        process.exit(1);
      }
    });

  } catch (error) {
    console.error(`[DATABASE] CRITICAL ERROR: Database connection failed: ${error.message}`);
    console.error('[DATABASE] Error stack:', error.stack);
    throw error; // Re-throw to let server.js handle it
  }
};

module.exports = {
  connectDB,
  getDb: () => {
    const db = database.getDb();
    if (!db) {
      console.error('[DATABASE] CRITICAL ERROR: Attempting to get database but connection is null');
    }
    return db;
  },
};