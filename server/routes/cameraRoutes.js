const express = require('express');
const router = express.Router();
const CameraService = require('../services/cameraService');
const { authenticateToken } = require('./middleware/auth');
const axios = require('axios');

// Apply authentication middleware to most camera routes
router.use((req, res, next) => {
  // Skip authentication for stream endpoints since video elements can't send auth headers
  if (req.path.includes('/stream')) {
    return next();
  }
  return authenticateToken(req, res, next);
});

// Get all cameras
router.get('/', async (req, res) => {
  try {
    console.log('[CAMERA_ROUTES] GET /api/cameras - User:', req.user.id);
    const cameras = await CameraService.getAllCameras(req.user.id);
    res.json({ cameras });
  } catch (error) {
    console.error('[CAMERA_ROUTES] Error getting cameras:', error.message);
    res.status(500).json({
      error: error.message || 'Failed to retrieve cameras'
    });
  }
});

// Get single camera
router.get('/:id', async (req, res) => {
  try {
    console.log('[CAMERA_ROUTES] GET /api/cameras/:id - Camera:', req.params.id, 'User:', req.user.id);
    const camera = await CameraService.getCameraById(req.params.id, req.user.id);
    res.json({ camera });
  } catch (error) {
    console.error('[CAMERA_ROUTES] Error getting camera:', error.message);
    const statusCode = error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      error: error.message || 'Failed to retrieve camera'
    });
  }
});

// Create new camera
router.post('/', async (req, res) => {
  try {
    console.log('[CAMERA_ROUTES] POST /api/cameras - User:', req.user.id, 'Data:', req.body);
    const camera = await CameraService.createCamera(req.body, req.user.id);
    res.status(201).json({
      success: true,
      message: 'Camera added successfully',
      camera
    });
  } catch (error) {
    console.error('[CAMERA_ROUTES] Error creating camera:', error.message);
    res.status(400).json({
      error: error.message || 'Failed to create camera'
    });
  }
});

// Test camera connection
router.post('/test', async (req, res) => {
  try {
    console.log('[CAMERA_ROUTES] POST /api/cameras/test - Data:', req.body);
    const { streamUrl, type } = req.body;

    if (!streamUrl || !type) {
      return res.status(400).json({
        error: 'Stream URL and type are required'
      });
    }

    const result = await CameraService.testCameraConnection(streamUrl, type);
    res.json(result);
  } catch (error) {
    console.error('[CAMERA_ROUTES] Error testing camera connection:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to test camera connection'
    });
  }
});

// Stream proxy endpoint - NO AUTHENTICATION REQUIRED
router.get('/:id/stream', async (req, res) => {
  let streamResponse = null;
  let streamClosed = false;

  try {
    console.log('[CAMERA_ROUTES] GET /api/cameras/:id/stream - Camera:', req.params.id);

    // Get camera without user restriction for streaming
    const camera = await CameraService.getCameraById(req.params.id);
    if (!camera) {
      console.error('[CAMERA_ROUTES] Camera not found:', req.params.id);
      return res.status(404).send('Camera not found');
    }

    console.log('[CAMERA_ROUTES] Checking stream URL for camera:', camera.name, 'URL:', camera.streamUrl);

    // Check if this is a YouTube URL - RETURN EARLY with simple text
    if (camera.streamUrl.includes('youtube.com') || camera.streamUrl.includes('youtu.be')) {
      console.error('[CAMERA_ROUTES] YouTube URLs are not supported for direct streaming');
      return res.status(400).send('YouTube URLs are not supported for streaming');
    }

    // Check if this is an RTSP URL - RETURN EARLY with simple text
    if (camera.streamUrl.toLowerCase().startsWith('rtsp://')) {
      console.error('[CAMERA_ROUTES] RTSP URLs are not supported for direct browser streaming');
      return res.status(400).send('RTSP streams cannot be played directly in browsers');
    }

    console.log('[CAMERA_ROUTES] Proxying stream for camera:', camera.name);

    // Set appropriate headers for streaming
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Accept-Ranges', 'bytes');

    // Handle client disconnect
    res.on('close', () => {
      console.log('[CAMERA_ROUTES] Client disconnected, cleaning up stream');
      streamClosed = true;
      if (streamResponse && streamResponse.data) {
        try {
          if (typeof streamResponse.data.destroy === 'function') {
            streamResponse.data.destroy();
          }
        } catch (destroyError) {
          console.error('[CAMERA_ROUTES] Error destroying stream:', destroyError.message);
        }
      }
    });

    try {
      // Create a stream request to the camera
      streamResponse = await axios({
        method: 'GET',
        url: camera.streamUrl,
        responseType: 'stream',
        timeout: 30000,
        headers: {
          'User-Agent': 'VisLangStream/1.0',
          'Accept': '*/*',
          'Range': req.headers.range || 'bytes=0-'
        }
      });

      console.log('[CAMERA_ROUTES] Stream response status:', streamResponse.status);
      console.log('[CAMERA_ROUTES] Stream response headers:', streamResponse.headers);

      // Check if client already disconnected
      if (streamClosed) {
        console.log('[CAMERA_ROUTES] Client already disconnected, not piping stream');
        if (streamResponse.data && typeof streamResponse.data.destroy === 'function') {
          streamResponse.data.destroy();
        }
        return;
      }

      // Forward the content type if available
      if (streamResponse.headers['content-type']) {
        res.setHeader('Content-Type', streamResponse.headers['content-type']);
      } else {
        res.setHeader('Content-Type', 'video/mp4');
      }

      // Forward content length if available
      if (streamResponse.headers['content-length']) {
        res.setHeader('Content-Length', streamResponse.headers['content-length']);
      }

      // Handle range requests
      if (streamResponse.status === 206) {
        res.status(206);
        if (streamResponse.headers['content-range']) {
          res.setHeader('Content-Range', streamResponse.headers['content-range']);
        }
      }

      // Set up error handling for the stream before piping
      streamResponse.data.on('error', (error) => {
        console.error('[CAMERA_ROUTES] Stream data error:', error.message);
        streamClosed = true;
        if (!res.headersSent) {
          res.status(500).send('Stream error');
        } else {
          try {
            res.end();
          } catch (endError) {
            console.error('[CAMERA_ROUTES] Error ending response:', endError.message);
          }
        }
      });

      streamResponse.data.on('end', () => {
        console.log('[CAMERA_ROUTES] Stream ended');
        streamClosed = true;
        if (!res.headersSent) {
          res.end();
        }
      });

      // Pipe the stream to the response with error handling
      try {
        streamResponse.data.pipe(res, { end: true });
      } catch (pipeError) {
        console.error('[CAMERA_ROUTES] Error piping stream:', pipeError.message);
        streamClosed = true;
        if (!res.headersSent) {
          res.status(500).send('Stream pipe error');
        }
      }

    } catch (streamError) {
      console.error('[CAMERA_ROUTES] Error creating stream:', streamError.message);
      console.error('[CAMERA_ROUTES] Stream error details:', {
        code: streamError.code,
        status: streamError.response?.status,
        statusText: streamError.response?.statusText
      });

      if (streamClosed) {
        console.log('[CAMERA_ROUTES] Client already disconnected, not sending error response');
        return;
      }

      // Send proper error responses based on error type
      if (streamError.code === 'ENOTFOUND') {
        console.log('[CAMERA_ROUTES] Sending ENOTFOUND error response');
        return res.status(404).send('Stream not found - URL could not be reached (domain not found)');
      } else if (streamError.code === 'ECONNREFUSED') {
        console.log('[CAMERA_ROUTES] Sending ECONNREFUSED error response');
        return res.status(503).send('Connection refused - Camera stream unavailable');
      } else if (streamError.code === 'ETIMEDOUT') {
        console.log('[CAMERA_ROUTES] Sending ETIMEDOUT error response');
        return res.status(408).send('Request timeout - Camera stream took too long to respond');
      } else if (streamError.response?.status === 404) {
        console.log('[CAMERA_ROUTES] Sending 404 error response');
        return res.status(404).send('Stream not found - Camera returned 404');
      } else if (streamError.response?.status === 403) {
        console.log('[CAMERA_ROUTES] Sending 403 error response');
        return res.status(403).send('Access forbidden - Camera stream requires authentication');
      } else if (streamError.response?.status === 401) {
        console.log('[CAMERA_ROUTES] Sending 401 error response');
        return res.status(401).send('Unauthorized - Invalid camera credentials');
      } else {
        console.log('[CAMERA_ROUTES] Sending generic error response');
        return res.status(500).send('Failed to proxy stream - ' + (streamError.message || 'Unknown error'));
      }
    }

  } catch (error) {
    console.error('[CAMERA_ROUTES] Error in stream proxy:', error.message);
    if (!streamClosed && !res.headersSent) {
      res.status(500).send('Stream proxy error - ' + error.message);
    }
  }
});

// Update camera
router.put('/:id', async (req, res) => {
  try {
    console.log('[CAMERA_ROUTES] PUT /api/cameras/:id - Camera:', req.params.id, 'User:', req.user.id, 'Data:', req.body);
    const camera = await CameraService.updateCamera(req.params.id, req.body, req.user.id);
    res.json({
      success: true,
      message: 'Camera updated successfully',
      camera
    });
  } catch (error) {
    console.error('[CAMERA_ROUTES] Error updating camera:', error.message);
    const statusCode = error.message.includes('not found') ? 404 : 400;
    res.status(statusCode).json({
      error: error.message || 'Failed to update camera'
    });
  }
});

// Delete camera
router.delete('/:id', async (req, res) => {
  try {
    console.log('[CAMERA_ROUTES] DELETE /api/cameras/:id - Camera:', req.params.id, 'User:', req.user.id);
    await CameraService.deleteCamera(req.params.id, req.user.id);
    res.json({
      success: true,
      message: 'Camera deleted successfully'
    });
  } catch (error) {
    console.error('[CAMERA_ROUTES] Error deleting camera:', error.message);
    const statusCode = error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      error: error.message || 'Failed to delete camera'
    });
  }
});

// Get camera settings
router.get('/:id/settings', async (req, res) => {
  try {
    console.log('[CAMERA_ROUTES] GET /api/cameras/:id/settings - Camera:', req.params.id, 'User:', req.user.id);
    const settings = await CameraService.getCameraSettings(req.params.id, req.user.id);
    res.json({ settings });
  } catch (error) {
    console.error('[CAMERA_ROUTES] Error getting camera settings:', error.message);
    const statusCode = error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      error: error.message || 'Failed to retrieve camera settings'
    });
  }
});

// Update camera settings
router.put('/:id/settings', async (req, res) => {
  try {
    console.log('[CAMERA_ROUTES] PUT /api/cameras/:id/settings - Camera:', req.params.id, 'User:', req.user.id, 'Settings:', req.body);
    await CameraService.updateCameraSettings(req.params.id, req.body.settings || req.body, req.user.id);
    res.json({
      success: true,
      message: 'Camera settings updated successfully'
    });
  } catch (error) {
    console.error('[CAMERA_ROUTES] Error updating camera settings:', error.message);
    const statusCode = error.message.includes('not found') ? 404 : 400;
    res.status(statusCode).json({
      error: error.message || 'Failed to update camera settings'
    });
  }
});

module.exports = router;