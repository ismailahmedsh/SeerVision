# VisLangStream

A real-time vision-language AI platform that allows users to connect video streams from cameras and query visual content using natural language.

## Features

- **Real-time Video Analysis**: Connect USB cameras for live analysis
- **Natural Language Queries**: Ask questions like "Count how many people you see" and get live answers
- **Live Dashboard**: Monitor multiple camera feeds with real-time analysis results
- **Camera Management**: Easy setup and configuration of camera sources
- **Real-time Analytics**: Monitor AI analysis performance and trends
- **Configurable Intervals**: Set custom analysis frequencies (6-120 seconds)

## Technology Stack

### Frontend
- React with TypeScript
- Vite for development and building
- Tailwind CSS for styling
- Shadcn/ui component library
- React Router for navigation

### Backend
- Node.js with Express
- SQLite database with Mongoose ODM
- JWT authentication
- LLaVA AI model integration via Ollama
- Real-time WebSocket communication

### AI Integration
- LLaVA (Large Language and Vision Assistant) for visual understanding
- Ollama for local AI model execution
- Real-time frame processing and analysis

## Prerequisites

- Node.js 18+ and npm
- Ollama installed and running
- LLaVA model: `ollama pull llava:7b`

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp server/.env.example server/.env
   ```
   Edit `server/.env` with your configuration.

4. Start the development server:
   ```bash
   npm run start
   ```

This will start both the frontend (port 5173) and backend (port 3000) concurrently.

## Usage

1. **Add Cameras**: Navigate to the Cameras page and add your video sources
2. **Live Analysis**: Go to the Dashboard, select a camera, and enter natural language prompts
3. **Monitor Results**: View real-time analysis results and historical data
4. **Real-time Analysis**: Live AI-powered video analysis with natural language queries

## Camera Types

- **USB Cameras**: Direct USB device connection

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh access token

### Cameras
- `GET /api/cameras` - List all cameras
- `POST /api/cameras` - Add new camera
- `PUT /api/cameras/:id` - Update camera
- `DELETE /api/cameras/:id` - Delete camera

### Video Analysis
- `POST /api/video-analysis/stream` - Start analysis stream
- `POST /api/video-analysis/frame` - Analyze single frame
- `GET /api/video-analysis/suggestions/:cameraId` - Get prompt suggestions

## Configuration

### Analysis Intervals
Configure how frequently frames are analyzed (6-120 seconds) in camera settings.

### Model Selection
The system automatically selects the appropriate LLaVA model based on analysis frequency:
- Fast intervals: `llava:7b-q4_0` (optimized for speed)
- Longer intervals: `llava:7b` (optimized for accuracy)

## Development

### Project Structure
```
├── client/          # React frontend application
├── server/          # Express backend API
├── package.json     # Root package configuration
└── README.md        # Project documentation
```

### Running Tests
```bash
npm run test
```

### Building for Production
```bash
npm run build
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License.

# Memory Column Migration Fix

## Issue Description

The API was failing with the error `"SQLITE_ERROR: no such column: memory"` when calling `GET /api/cameras`. This prevented the UI from loading the camera settings panel.

## Root Cause

The `memory` column was missing from the `cameras` table in the SQLite database, causing all camera-related queries to fail.

## Solution Implemented

### 1. Database Migration

- **Enhanced automatic migration** in `server/config/database.js` with better error handling and verification
- **Added safety checks** to ensure the memory column exists before any camera queries
- **Created standalone migration script** `server/migrate-memory-column.js` for manual execution

### 2. Database Model Updates

- **Updated Camera model** (`server/models/Camera.js`) to use `COALESCE(memory, 0)` for backward compatibility
- **Added default memory value** (0/false) when creating new cameras
- **Enhanced error logging** for debugging database operations

### 3. Service Layer Safety

- **Added memory column verification** in `CameraService` before executing queries
- **Graceful fallbacks** for missing memory fields in all camera operations
- **Safe default values** (false) when memory field is missing

### 4. Client-Side Safety

- **Made memory field optional** in all TypeScript interfaces
- **Added nullish coalescing** (`??`) operators for safe fallbacks
- **UI gracefully handles** missing memory values by defaulting to false

### 5. Memory Subsystem with Scene Descriptions (NEW)

The Memory subsystem provides intelligent context management for video analysis by storing **scene descriptions** rather than task-specific outputs. This ensures memory is reusable across different user prompts and analysis tasks.

### Key Features

- **Scene Description Storage**: Stores general scene descriptions (e.g., "Person sitting at desk", "Empty room with chair")
- **Novelty Detection**: Uses parallel requests to detect when scenes change
- **Context Building**: Assembles prompts with recent scene history
- **Non-blocking Operation**: Never blocks main analysis flow

### Recent Fixes (v2.0)

✅ **Fixed First-Frame Seeding**: Previous implementation failed to seed the buffer on first frame, causing memory to never activate. Now uses simplified prompt for first frame.

✅ **Eliminated Negative Context Counters**: Fixed buffer initialization and prompt building logic to prevent negative frame offsets.

✅ **Improved Timeout Handling**: Novelty detection has 500ms timeout and never blocks main analysis.

✅ **Added Queue Contention Logging**: Separate logging for timeouts vs queue contention issues.

✅ **Enhanced Buffer Initialization**: Ensures buffer is properly initialized before context building.

### Memory Flow

1. **First Frame**: Simplified prompt seeds the buffer with any non-empty scene description
2. **Subsequent Frames**: Novelty detection with previous context, only updates buffer on changes
3. **Context Building**: Assembles final prompt with recent scene history
4. **Non-blocking**: Main analysis proceeds regardless of novelty detection status

### Usage

Enable memory for any video analysis stream by setting `memory: true` in the request. The system will automatically:

- Initialize a buffer sized according to analysis interval
- Run parallel novelty detection for each frame
- Build contextual prompts with scene history
- Maintain buffer size limits automatically

See `MEMORY_LOGGING_CONFIG.md` for detailed logging information and troubleshooting.

## How to Apply the Fix

### Option 1: Automatic Migration (Recommended)

1. Restart the server - the enhanced migration will run automatically
2. Check server logs for migration success messages

### Option 2: Manual Migration

If automatic migration fails, run the manual migration script:

```bash
cd server
npm run migrate:memory
```

### Option 3: Database Reset (Last Resort)

If both migrations fail, you can reset the database:

```bash
cd server
rm database.sqlite
# Restart server to recreate database with correct schema
```

## Verification

After migration, verify the fix by:

1. **Check server logs** for successful migration messages
2. **Test API endpoint** `GET /api/cameras` - should return cameras without errors
3. **Verify UI loads** - camera settings panel should be accessible
4. **Check database schema** - `cameras` table should have `memory` column
5. **Test memory logging** - start analysis with `memory=true` and check logs

## Database Schema

The `cameras` table now includes:

```sql
CREATE TABLE cameras (
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
  memory INTEGER DEFAULT 0,  -- NEW COLUMN
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
)
```

## Backward Compatibility

- **Existing cameras** without memory field will default to `false` (0)
- **New cameras** will be created with `memory = false` by default
- **All queries** use `COALESCE` to handle missing columns gracefully
- **UI components** safely handle undefined/null memory values

## Memory Subsystem Features

### Scene Description Storage
- **Stores**: General scene descriptions (e.g., "Person sitting at desk", "Empty room with chair")
- **Does NOT store**: Task-specific answers (e.g., `{"unique_people": 0}`, "Count the objects")
- **Benefit**: Memory context works for any user prompt, not just the original task

### Novelty Detection
- **Parallel request**: For each frame, runs a separate novelty-check model
- **Instruction**: "Describe the scene and what is in the frame in 1–2 sentences maximum. If the same is happening, output: NOTHING_NEW"
- **Non-blocking**: Completes before buffer update logic but doesn't delay main analysis

### Startup Logging
When the server starts, you'll see comprehensive memory subsystem information including buffer formulas and timeouts.

### Request Logging
For each memory-enabled analysis request (`/start` and `/frame` with `memory=true`):
- Stream ID and buffer configuration
- Buffer length before/after operations
- Recent buffer entries (truncated, safe)
- Final assembled prompts (capped, no raw images)
- Novelty detection results (scene descriptions vs NOTHING_NEW)

### Configuration
Control logging frequency with environment variable:
```bash
# Development - log every request
export MEMORY_LOG_SAMPLE_RATE=1

# Production - log every 10th request  
export MEMORY_LOG_SAMPLE_RATE=10
```

### Runtime Control
Adjust logging at runtime via admin endpoints:
```bash
# Set to log every 5th request
curl -X POST http://localhost:3000/api/video-analysis/admin/memory-logging \
  -H "Content-Type: application/json" \
  -d '{"sampleRate": 5}'

# Check current configuration
curl http://localhost:3000/api/video-analysis/admin/memory-logging
```

## Files Modified

- `server/config/database.js` - Enhanced migration logic + memory subsystem startup logging
- `server/models/Camera.js` - Added COALESCE and safety checks
- `server/services/cameraService.js` - Added memory column verification
- `server/services/memoryService.js` - **NEW** comprehensive logging system
- `server/migrate-memory-column.js` - New manual migration script
- `server/package.json` - Added migration script command
- `server/routes/videoAnalysisRoutes.js` - **NEW** memory logging + admin endpoints
- `client/src/components/dashboard/CameraSettingsDialog.tsx` - Safe memory handling
- Various TypeScript interfaces - Made memory field optional
- `MEMORY_LOGGING_CONFIG.md` - **NEW** detailed logging documentation

## Testing

The fix ensures:
1. **API endpoints work** even with missing memory columns
2. **UI renders correctly** with safe fallbacks
3. **Database operations** are backward compatible
4. **Memory logging** provides comprehensive visibility
5. **New features** work as expected
6. **Existing functionality** is preserved

## Privacy & Performance

- **No raw frame data** is ever logged
- **Base64 images** are safely replaced with placeholders
- **Logs are capped** to prevent excessive output
- **Sample rate control** for production tuning
- **Non-blocking design** ensures analysis flow is never interrupted