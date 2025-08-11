const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database path
const dbPath = path.resolve(process.env.DATABASE_PATH || './database.sqlite');

console.log('Starting memory column migration...');
console.log('Database path:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  console.log('Connected to database successfully');
  
  // Check if memory column exists
  db.all("PRAGMA table_info(cameras)", (err, columns) => {
    if (err) {
      console.error('Error checking table info:', err.message);
      db.close();
      process.exit(1);
    }

    console.log('Current cameras table columns:', columns.map(col => col.name));
    
    const hasMemory = columns.some(col => col.name === 'memory');
    console.log('Has memory column:', hasMemory);
    
    if (!hasMemory) {
      console.log('Adding memory column to cameras table...');
      db.run("ALTER TABLE cameras ADD COLUMN memory INTEGER DEFAULT 0", (alterErr) => {
        if (alterErr) {
          console.error('Error adding memory column:', alterErr.message);
          db.close();
          process.exit(1);
        }
        
        console.log('Memory column added successfully');
        
        // Verify the column was added
        db.all("PRAGMA table_info(cameras)", (verifyErr, verifyColumns) => {
          if (verifyErr) {
            console.error('Error verifying memory column:', verifyErr.message);
            db.close();
            process.exit(1);
          }
          
          const hasMemoryAfterAdd = verifyColumns.some(col => col.name === 'memory');
          console.log('Memory column verification:', hasMemoryAfterAdd);
          console.log('Updated cameras table columns:', verifyColumns.map(col => col.name));
          
          if (hasMemoryAfterAdd) {
            console.log('Migration completed successfully!');
          } else {
            console.error('Migration failed - memory column was not added');
            process.exit(1);
          }
          
          db.close();
        });
      });
    } else {
      console.log('Memory column already exists, no migration needed');
      db.close();
    }
  });
});

