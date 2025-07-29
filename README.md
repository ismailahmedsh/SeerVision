```markdown
# VisLangStream

VisLangStream is a real-time cloud-based platform enabling users to connect video streams from cameras and query visual content using natural language. With capabilities such as analyzing live video feeds and responding to queries (e.g., "Count how many red cars you see"), VisLangStream delivers timely and accurate visual insights updated at configurable intervals.

## Overview

VisLangStream is divided into two main parts: the frontend and the backend.

### Architecture and Technologies

**Frontend:**
- **Framework:** ReactJS
- **Dev Server:** Vite
- **Component Library:** Shadcn-UI with Tailwind CSS
- **Routing:** react-router-dom
- **Folder:** `client/`
- **Port:** 5173

**Backend:**
- **Framework:** Express
- **Database:** MongoDB with Mongoose
- **Authentication:** Token-based (Bearer access and refresh tokens)
- **Folder:** `server/`
- **Port:** 3000

### Project Structure
- **Frontend:**
    - Main app components and pages (`client/src/pages/`, `client/src/components`)
    - API requests mock data (`client/src/api`)
    - Configuration and styles (`client/`)
- **Backend:**
    - REST API implementation (`server/routes/`)
    - Models and services (`server/models/`, `server/services/`)
    - Server configuration (`server/`)

## Features

VisLangStream offers the following features:
- **Camera Management:**
  - Add, edit, delete, and view camera streams.
  - Manage camera connection details and statuses.
- **Live Video Display:**
  - Real-time video feed with controls.
  - Configurable frame rate and timestamp overlay.
- **Visual Analysis:**
  - Natural language prompts for querying visual content.
  - Real-time results with historical data.
  - Smooth, instant updates without page refreshes.
- **User Interactions:**
  - Guided setup for adding new cameras.
  - Prompt management with real-time validation and instructional feedback.
  - Notifications and error handling through toast messages.

## Getting Started

### Requirements

Ensure you have the following installed on your system:
- **Node.js** (v14 or higher)
- **npm** (v6 or higher)
- **MongoDB** (for database support)

### Quickstart

Follow these steps to set up and run the project:

1. **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd vislangstream
    ```

2. **Install dependencies:**
    ```bash
    npm install
    ```

3. **Environment setup:**
    - Create a `.env` file in the `server/` folder with the necessary environment variables (e.g., port numbers, database URIs, JWT secrets).

4. **Start the project:**
    ```bash
    npm run start
    ```

5. **Access the application:**
    - Frontend: `http://localhost:5173`
    - Backend API: `http://localhost:3000/api/`

Your application should now be up and running, and you can start adding cameras, analyzing video streams, and querying for real-time visual insights.

### License

The project is proprietary (not open source), just output the standard Copyright (c) 2024.
```