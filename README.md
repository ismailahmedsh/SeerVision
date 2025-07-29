# VisLangStream

A real-time vision-language AI platform that allows users to connect video streams from cameras and query visual content using natural language.

## Features

- **Real-time Video Analysis**: Connect IP cameras, RTSP streams, and USB cameras
- **Natural Language Queries**: Ask questions like "Count how many people you see" and get live answers
- **Live Dashboard**: Monitor multiple camera feeds with real-time analysis results
- **Camera Management**: Easy setup and configuration of camera sources
- **Analysis History**: Track and export analysis results over time
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
4. **Export Data**: Download analysis history as CSV files

## Camera Support

- **IP Cameras**: HTTP/HTTPS video streams
- **RTSP Streams**: Real-time streaming protocol cameras
- **USB Cameras**: Local webcams and USB-connected cameras
- **Video Files**: Direct links to video files (.mp4, .m3u8, etc.)

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