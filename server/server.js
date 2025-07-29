// Load environment variables
require("dotenv").config();

// Add comprehensive error logging at the very start
console.log('[SERVER] Starting server initialization...');
console.log('[SERVER] Environment variables check:');
console.log('[SERVER] - PORT:', process.env.PORT);
console.log('[SERVER] - DATABASE_PATH:', process.env.DATABASE_PATH);
console.log('[SERVER] - JWT_SECRET:', process.env.JWT_SECRET ? 'Set' : 'Not set');
console.log('[SERVER] - REFRESH_TOKEN_SECRET:', process.env.REFRESH_TOKEN_SECRET ? 'Set' : 'Not set');

const express = require("express");
const session = require("express-session");

// Add try-catch around route imports to catch any import errors
let basicRoutes, authRoutes, userRoutes, cameraRoutes, videoAnalysisRoutes;
try {
  console.log('[SERVER] Loading route modules...');
  basicRoutes = require("./routes/index");
  console.log('[SERVER] - Basic routes loaded');
  authRoutes = require("./routes/authRoutes");
  console.log('[SERVER] - Auth routes loaded');
  userRoutes = require("./routes/userRoutes");
  console.log('[SERVER] - User routes loaded');
  cameraRoutes = require("./routes/cameraRoutes");
  console.log('[SERVER] - Camera routes loaded');
  videoAnalysisRoutes = require("./routes/videoAnalysisRoutes");
  console.log('[SERVER] - Video analysis routes loaded');
} catch (error) {
  console.error('[SERVER] CRITICAL ERROR loading route modules:', error);
  console.error('[SERVER] Error stack:', error.stack);
  process.exit(1);
}

// Add try-catch around database import
let connectDB;
try {
  console.log('[SERVER] Loading database module...');
  const dbModule = require("./config/database");
  connectDB = dbModule.connectDB;
  console.log('[SERVER] - Database module loaded');
} catch (error) {
  console.error('[SERVER] CRITICAL ERROR loading database module:', error);
  console.error('[SERVER] Error stack:', error.stack);
  process.exit(1);
}

const cors = require("cors");

if (!process.env.DATABASE_PATH) {
  console.error("Error: DATABASE_PATH variable in .env missing.");
  process.exit(-1);
}

const app = express();
const port = process.env.PORT || 3000;

// Pretty-print JSON responses
app.enable('json spaces');
// We want to be consistent with URL paths, so we enable strict routing
app.enable('strict routing');

app.use(cors({}));

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`[SERVER] ${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log(`[SERVER] Headers:`, req.headers);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log(`[SERVER] Body:`, req.body);
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection with enhanced error handling
console.log('[SERVER] Attempting database connection...');
connectDB().then(() => {
  console.log('[SERVER] Database connection successful');
}).catch((error) => {
  console.error('[SERVER] CRITICAL ERROR: Database connection failed:', error);
  console.error('[SERVER] Error stack:', error.stack);
  process.exit(1);
});

app.on("error", (error) => {
  console.error(`[SERVER] Express app error: ${error.message}`);
  console.error('[SERVER] Error stack:', error.stack);
});

// Add error handling for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('[SERVER] UNCAUGHT EXCEPTION:', error);
  console.error('[SERVER] Error stack:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[SERVER] UNHANDLED REJECTION at:', promise, 'reason:', reason);
  process.exit(1);
});

// Basic Routes
try {
  console.log('[SERVER] Registering basic routes...');
  app.use(basicRoutes);
  console.log('[SERVER] - Basic routes registered');
} catch (error) {
  console.error('[SERVER] Error registering basic routes:', error);
  console.error('[SERVER] Error stack:', error.stack);
}

// Authentication Routes
try {
  console.log('[SERVER] Registering auth routes at /api/auth...');
  app.use('/api/auth', authRoutes);
  console.log('[SERVER] - Auth routes registered');
} catch (error) {
  console.error('[SERVER] Error registering auth routes:', error);
  console.error('[SERVER] Error stack:', error.stack);
}

// User Management Routes
try {
  console.log('[SERVER] Registering user routes at /api/users...');
  app.use('/api/users', userRoutes);
  console.log('[SERVER] - User routes registered');
} catch (error) {
  console.error('[SERVER] Error registering user routes:', error);
  console.error('[SERVER] Error stack:', error.stack);
}

// Camera Management Routes
try {
  console.log('[SERVER] Registering camera routes at /api/cameras...');
  app.use('/api/cameras', cameraRoutes);
  console.log('[SERVER] - Camera routes registered');
} catch (error) {
  console.error('[SERVER] Error registering camera routes:', error);
  console.error('[SERVER] Error stack:', error.stack);
}

// Video Analysis Routes
try {
  console.log('[SERVER] Registering video analysis routes at /api/video-analysis...');
  app.use('/api/video-analysis', videoAnalysisRoutes);
  console.log('[SERVER] - Video analysis routes registered');
} catch (error) {
  console.error('[SERVER] Error registering video analysis routes:', error);
  console.error('[SERVER] Error stack:', error.stack);
}

// If no routes handled the request, it's a 404
app.use((req, res, next) => {
  console.log(`[SERVER] 404 - Route not found: ${req.method} ${req.url}`);
  res.status(404).send("Page not found.");
});

// Error handling
app.use((err, req, res, next) => {
  console.error(`[SERVER] Unhandled application error: ${err.message}`);
  console.error('[SERVER] Error stack:', err.stack);
  res.status(500).send("There was an error serving your request.");
});

// Enhanced server startup with error handling
try {
  console.log('[SERVER] Starting HTTP server...');
  app.listen(port, () => {
    console.log(`[SERVER] Server running at http://localhost:${port}`);
    console.log(`[SERVER] Routes registered:`);
    console.log(`[SERVER] - Basic routes: /`);
    console.log(`[SERVER] - Auth routes: /api/auth`);
    console.log(`[SERVER] - User routes: /api/users`);
    console.log(`[SERVER] - Camera routes: /api/cameras`);
    console.log(`[SERVER] - Video analysis routes: /api/video-analysis`);
    console.log('[SERVER] Server startup complete!');
  });
} catch (error) {
  console.error('[SERVER] CRITICAL ERROR starting server:', error);
  console.error('[SERVER] Error stack:', error.stack);
  process.exit(1);
}