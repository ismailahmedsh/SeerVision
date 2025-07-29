const express = require('express');
const router = express.Router();
const CameraService = require('../services/cameraService');
const { authenticateToken } = require('./middleware/auth');
const axios = require('axios');

// Apply authentication middleware to most camera routes
router.use((req, res, next) => {
  // Skip authentication for stream and frame endpoints since they need to be accessible internally
  if (req.path.includes('/stream') || req.path.includes('/frame')) {
    return next();
  }
  return authenticateToken(req, res, next);
});

// Get all cameras
router.get('/', async (req, res) => {
  try {
    console.log('[CAMERA_ROUTES] ===== GET ALL CAMERAS START =====');
    console.log('[CAMERA_ROUTES] Request timestamp:', new Date().toISOString());
    console.log('[CAMERA_ROUTES] GET /api/cameras - User:', req.user?.id);
    console.log('[CAMERA_ROUTES] Request method:', req.method);
    console.log('[CAMERA_ROUTES] Request URL:', req.url);
    console.log('[CAMERA_ROUTES] Request headers:', JSON.stringify(req.headers, null, 2));
    console.log('[CAMERA_ROUTES] Request query:', req.query);
    console.log('[CAMERA_ROUTES] Request body:', req.body);

    if (!req.user || !req.user.id) {
      console.error('[CAMERA_ROUTES] Authentication validation failed');
      console.error('[CAMERA_ROUTES] req.user:', req.user);
      console.error('[CAMERA_ROUTES] req.user.id:', req.user?.id);
      return res.status(401).json({ error: 'Authentication required' });
    }

    console.log('[CAMERA_ROUTES] Authentication validated successfully');
    console.log('[CAMERA_ROUTES] User ID:', req.user.id);
    console.log('[CAMERA_ROUTES] User details:', req.user);

    console.log('[CAMERA_ROUTES] Calling CameraService.getAllCameras...');
    const cameras = await CameraService.getAllCameras(req.user.id);
    console.log('[CAMERA_ROUTES] CameraService.getAllCameras completed');
    console.log('[CAMERA_ROUTES] Cameras returned type:', typeof cameras);
    console.log('[CAMERA_ROUTES] Cameras is array:', Array.isArray(cameras));
    console.log('[CAMERA_ROUTES] Cameras count:', cameras?.length || 0);
    console.log('[CAMERA_ROUTES] Raw cameras data:', JSON.stringify(cameras, null, 2));

    if (cameras && cameras.length > 0) {
      console.log('[CAMERA_ROUTES] Processing cameras array...');
      cameras.forEach((camera, index) => {
        console.log(`[CAMERA_ROUTES] Camera ${index}:`, {
          id: camera._id,
          name: camera.name,
          type: camera.type,
          streamUrl: camera.streamUrl,
          status: camera.status,
          userId: camera.userId
        });
      });
    }

    const response = { cameras };
    console.log('[CAMERA_ROUTES] Preparing response...');
    console.log('[CAMERA_ROUTES] Response structure:', Object.keys(response));
    console.log('[CAMERA_ROUTES] Response cameras count:', response.cameras?.length || 0);
    console.log('[CAMERA_ROUTES] Full response:', JSON.stringify(response, null, 2));

    console.log('[CAMERA_ROUTES] Sending response...');
    res.json(response);
    console.log('[CAMERA_ROUTES] Response sent successfully');
    console.log('[CAMERA_ROUTES] ===== GET ALL CAMERAS SUCCESS =====');
  } catch (error) {
    console.error('[CAMERA_ROUTES] ===== GET ALL CAMERAS ERROR =====');
    console.error('[CAMERA_ROUTES] Error timestamp:', new Date().toISOString());
    console.error('[CAMERA_ROUTES] Error type:', error.constructor.name);
    console.error('[CAMERA_ROUTES] Error message:', error.message);
    console.error('[CAMERA_ROUTES] Error stack:', error.stack);
    console.error('[CAMERA_ROUTES] Error details:', error);

    const errorResponse = {
      error: error.message || 'Failed to retrieve cameras'
    };
    console.error('[CAMERA_ROUTES] Sending error response:', errorResponse);
    res.status(500).json(errorResponse);
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

// Frame capture endpoint - NO AUTHENTICATION REQUIRED
router.get('/:id/frame', async (req, res) => {
  try {
    console.log('[CAMERA_ROUTES] ===== FRAME CAPTURE REQUEST START =====');
    console.log('[CAMERA_ROUTES] GET /api/cameras/:id/frame - Camera:', req.params.id);

    // Get camera without user restriction for frame capture
    const camera = await CameraService.getCameraById(req.params.id);
    if (!camera) {
      console.error('[CAMERA_ROUTES] Camera not found:', req.params.id);
      return res.status(404).json({ error: 'Camera not found' });
    }

    console.log('[CAMERA_ROUTES] Camera found for frame capture:', {
      id: camera._id,
      name: camera.name,
      type: camera.type,
      streamUrl: camera.streamUrl
    });

    // For USB cameras, we need to return an error since we can't capture frames server-side
    if (camera.type === 'usb') {
      console.log('[CAMERA_ROUTES] USB camera - cannot capture server-side frame');
      return res.status(400).json({
        error: 'USB cameras require client-side frame capture',
        cameraType: 'usb'
      });
    }

    // Check if this is a YouTube URL
    if (camera.streamUrl.includes('youtube.com') || camera.streamUrl.includes('youtu.be')) {
      console.error('[CAMERA_ROUTES] YouTube URLs are not supported for frame capture');
      return res.status(400).json({ error: 'YouTube URLs are not supported for frame capture' });
    }

    // Check if this is an RTSP URL
    if (camera.streamUrl.toLowerCase().startsWith('rtsp://')) {
      console.error('[CAMERA_ROUTES] RTSP URLs are not supported for direct frame capture');
      return res.status(400).json({ error: 'RTSP streams cannot be captured directly in browsers' });
    }

    console.log('[CAMERA_ROUTES] Attempting to capture frame from:', camera.streamUrl);

    try {
      // Capture a single frame from the stream
      const response = await axios({
        method: 'GET',
        url: camera.streamUrl,
        responseType: 'arraybuffer',
        timeout: 15000,
        headers: {
          'User-Agent': 'VisLangStream-FrameCapture/1.0',
          'Accept': 'image/*,*/*',
          'Range': 'bytes=0-2097152' // Limit to first 2MB
        }
      });

      console.log('[CAMERA_ROUTES] Frame capture response status:', response.status);
      console.log('[CAMERA_ROUTES] Frame capture response size:', response.data.byteLength);
      console.log('[CAMERA_ROUTES] Frame capture content-type:', response.headers['content-type']);

      if (response.data.byteLength === 0) {
        throw new Error('Empty response from camera stream');
      }

      // Convert to base64 for JSON response
      const frameBuffer = Buffer.from(response.data);
      const base64Frame = frameBuffer.toString('base64');

      console.log('[CAMERA_ROUTES] Frame converted to base64, size:', base64Frame.length);

      res.json({
        success: true,
        frame: base64Frame,
        contentType: response.headers['content-type'] || 'image/jpeg',
        size: frameBuffer.length,
        timestamp: new Date().toISOString()
      });

      console.log('[CAMERA_ROUTES] ===== FRAME CAPTURE SUCCESS =====');

    } catch (captureError) {
      console.error('[CAMERA_ROUTES] Frame capture failed:', captureError.message);
      console.error('[CAMERA_ROUTES] Capture error details:', {
        code: captureError.code,
        status: captureError.response?.status,
        url: camera.streamUrl
      });

      res.status(500).json({
        error: 'Failed to capture frame: ' + captureError.message,
        cameraId: camera._id,
        streamUrl: camera.streamUrl
      });
    }

  } catch (error) {
    console.error('[CAMERA_ROUTES] ===== CRITICAL FRAME CAPTURE ERROR =====');
    console.error('[CAMERA_ROUTES] Error in frame capture:', error.message);
    res.status(500).json({
      error: 'Frame capture error: ' + error.message
    });
  }
});

// Stream proxy endpoint - NO AUTHENTICATION REQUIRED
router.get('/:id/stream', async (req, res) => {
  let streamResponse = null;
  let streamClosed = false;

  try {
    console.log('[CAMERA_ROUTES] ===== STREAM PROXY REQUEST START =====');
    console.log('[CAMERA_ROUTES] GET /api/cameras/:id/stream - Camera:', req.params.id);
    console.log('[CAMERA_ROUTES] Request headers:', req.headers);

    // Get camera without user restriction for streaming
    const camera = await CameraService.getCameraById(req.params.id);
    if (!camera) {
      console.error('[CAMERA_ROUTES] Camera not found:', req.params.id);
      return res.status(404).send('Camera not found');
    }

    console.log('[CAMERA_ROUTES] Camera found:', {
      id: camera._id,
      name: camera.name,
      type: camera.type,
      streamUrl: camera.streamUrl
    });

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
    console.log('[CAMERA_ROUTES] Target stream URL:', camera.streamUrl);

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
      console.log('[CAMERA_ROUTES] Creating stream request to target URL...');
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

      console.log('[CAMERA_ROUTES] Stream response received from target');
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
        console.log('[CAMERA_ROUTES] Content-Type set to:', streamResponse.headers['content-type']);
      } else {
        res.setHeader('Content-Type', 'video/mp4');
        console.log('[CAMERA_ROUTES] Default Content-Type set to: video/mp4');
      }

      // Forward content length if available
      if (streamResponse.headers['content-length']) {
        res.setHeader('Content-Length', streamResponse.headers['content-length']);
        console.log('[CAMERA_ROUTES] Content-Length set to:', streamResponse.headers['content-length']);
      }

      // Handle range requests
      if (streamResponse.status === 206) {
        res.status(206);
        if (streamResponse.headers['content-range']) {
          res.setHeader('Content-Range', streamResponse.headers['content-range']);
          console.log('[CAMERA_ROUTES] Content-Range set to:', streamResponse.headers['content-range']);
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

      streamResponse.data.on('data', (chunk) => {
        console.log('[CAMERA_ROUTES] Stream data chunk received, size:', chunk.length);
      });

      console.log('[CAMERA_ROUTES] Starting to pipe stream to client...');
      // Pipe the stream to the response with error handling
      try {
        streamResponse.data.pipe(res, { end: true });
        console.log('[CAMERA_ROUTES] Stream piping started successfully');
      } catch (pipeError) {
        console.error('[CAMERA_ROUTES] Error piping stream:', pipeError.message);
        streamClosed = true;
        if (!res.headersSent) {
          res.status(500).send('Stream pipe error');
        }
      }

    } catch (streamError) {
      console.error('[CAMERA_ROUTES] ===== STREAM ERROR =====');
      console.error('[CAMERA_ROUTES] Error creating stream:', streamError.message);
      console.error('[CAMERA_ROUTES] Stream error details:', {
        code: streamError.code,
        status: streamError.response?.status,
        statusText: streamError.response?.statusText,
        url: camera.streamUrl
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
    console.error('[CAMERA_ROUTES] ===== CRITICAL STREAM PROXY ERROR =====');
    console.error('[CAMERA_ROUTES] Error in stream proxy:', error.message);
    console.error('[CAMERA_ROUTES] Error stack:', error.stack);
    if (!streamClosed && !res.headersSent) {
      res.status(500).send('Stream proxy error - ' + error.message);
    }
  }
});

module.exports = router;