// Load environment variables
require("dotenv").config();

const express = require("express");
const session = require("express-session");

// Load route modules
let basicRoutes, authRoutes, userRoutes, cameraRoutes, videoAnalysisRoutes, analyticsRoutes, webhookRoutes;
try {
  basicRoutes = require("./routes/index");
  authRoutes = require("./routes/authRoutes");
  userRoutes = require("./routes/userRoutes");
  cameraRoutes = require("./routes/cameraRoutes");
  videoAnalysisRoutes = require("./routes/videoAnalysisRoutes");
  analyticsRoutes = require("./routes/analyticsRoutes");
  webhookRoutes = require("./routes/webhookRoutes");
} catch (error) {
  console.error('[SERVER] Error loading route modules:', error);
  process.exit(1);
}

// Load database module
let connectDB;
try {
  const dbModule = require("./config/database");
  connectDB = dbModule.connectDB;
} catch (error) {
  console.error('[SERVER] Error loading database module:', error);
  process.exit(1);
}

const cors = require("cors");

if (!process.env.DATABASE_PATH) {
  console.error("Error: DATABASE_PATH variable in .env missing.");
  process.exit(-1);
}

if (!process.env.JWT_SECRET) {
  console.error("Error: JWT_SECRET variable in .env missing.");
  process.exit(-1);
}

if (!process.env.REFRESH_TOKEN_SECRET) {
  console.error("Error: REFRESH_TOKEN_SECRET variable in .env missing.");
  process.exit(-1);
}

const app = express();
const port = process.env.PORT || 3000;

// Pretty-print JSON responses
app.enable('json spaces');
app.enable('strict routing');

app.use(cors({}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection
connectDB().then(() => {
  console.log('[SERVER] Database connected');
}).catch((error) => {
  console.error('[SERVER] Database connection failed:', error);
  process.exit(1);
});

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('[SERVER] Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[SERVER] Unhandled rejection:', reason);
});

// Register routes
app.use(basicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/cameras', cameraRoutes);
app.use('/api/video-analysis', videoAnalysisRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/webhooks', webhookRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).send("Page not found.");
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(`[SERVER] Application error: ${err.message}`);
  res.status(500).send("There was an error serving your request.");
});

// Start server
const server = app.listen(port, () => {
  console.log(`[SERVER] Server running at http://localhost:${port}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`[SERVER] Port ${port} is already in use.`);
    process.exit(1);
  } else {
    console.error('[SERVER] Server error:', error);
    process.exit(1);
  }
});