const express = require('express');
const router = express.Router();
const CameraService = require('../services/cameraService');
const { authenticateToken } = require('./middleware/auth');
const axios = require('axios');

router.use((req, res, next) => {
  if (req.path.includes('/stream') || req.path.includes('/frame')) {
    return next();
  }
  return authenticateToken(req, res, next);
});

router.get('/', async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const cameras = await CameraService.getAllCameras(req.user.id);
    const response = { cameras };
    res.json(response);
  } catch (error) {
    console.error('Error getting cameras:', error.message);
    const errorResponse = {
      error: error.message || 'Failed to retrieve cameras'
    };
    res.status(500).json(errorResponse);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const camera = await CameraService.getCameraById(req.params.id, req.user.id);
    res.json({ camera });
  } catch (error) {
    console.error('Error getting camera:', error.message);
    const statusCode = error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      error: error.message || 'Failed to retrieve camera'
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const camera = await CameraService.createCamera(req.body, req.user.id);
    res.status(201).json({
      success: true,
      message: 'Camera added successfully',
      camera
    });
  } catch (error) {
    console.error('Error creating camera:', error.message);
    res.status(400).json({
      error: error.message || 'Failed to create camera'
    });
  }
});

router.post('/test', async (req, res) => {
  try {
    const { streamUrl, type } = req.body;

    if (!streamUrl || !type) {
      return res.status(400).json({
        error: 'Stream URL and type are required'
      });
    }

    const result = await CameraService.testCameraConnection(streamUrl, type);
    res.json(result);
  } catch (error) {
    console.error('Error testing camera connection:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to test camera connection'
    });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const camera = await CameraService.updateCamera(req.params.id, req.body, req.user.id);
    res.json({
      success: true,
      message: 'Camera updated successfully',
      camera
    });
  } catch (error) {
    console.error('Error updating camera:', error.message);
    const statusCode = error.message.includes('not found') ? 404 : 400;
    res.status(statusCode).json({
      error: error.message || 'Failed to update camera'
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await CameraService.deleteCamera(req.params.id, req.user.id);
    res.json({
      success: true,
      message: 'Camera deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting camera:', error.message);
    const statusCode = error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      error: error.message || 'Failed to delete camera'
    });
  }
});

router.get('/:id/settings', async (req, res) => {
  try {
    const settings = await CameraService.getCameraSettings(req.params.id, req.user.id);
    res.json({ settings });
  } catch (error) {
    console.error('Error getting camera settings:', error.message);
    const statusCode = error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      error: error.message || 'Failed to retrieve camera settings'
    });
  }
});

router.put('/:id/settings', async (req, res) => {
  try {
    await CameraService.updateCameraSettings(req.params.id, req.body.settings || req.body, req.user.id);
    res.json({
      success: true,
      message: 'Camera settings updated successfully'
    });
  } catch (error) {
    console.error('Error updating camera settings:', error.message);
    const statusCode = error.message.includes('not found') ? 404 : 400;
    res.status(statusCode).json({
      error: error.message || 'Failed to update camera settings'
    });
  }
});

router.get('/:id/frame', async (req, res) => {
  try {
    const camera = await CameraService.getCameraById(req.params.id);
    if (!camera) {
      return res.status(404).json({ error: 'Camera not found' });
    }

    if (camera.type === 'usb') {
      return res.status(400).json({
        error: 'USB cameras require client-side frame capture',
        cameraType: 'usb'
      });
    }

    if (camera.streamUrl.includes('youtube.com') || camera.streamUrl.includes('youtu.be')) {
      return res.status(400).json({ error: 'YouTube URLs are not supported for frame capture' });
    }

    try {
      const response = await axios({
        method: 'GET',
        url: camera.streamUrl,
        responseType: 'arraybuffer',
        timeout: 15000,
        headers: {
          'User-Agent': 'VisLangStream-FrameCapture/1.0',
          'Accept': 'image/*,*/*',
          'Range': 'bytes=0-2097152'
        }
      });

      if (response.data.byteLength === 0) {
        throw new Error('Empty response from camera stream');
      }

      const frameBuffer = Buffer.from(response.data);
      const base64Frame = frameBuffer.toString('base64');

      res.json({
        success: true,
        frame: base64Frame,
        contentType: response.headers['content-type'] || 'image/jpeg',
        size: frameBuffer.length,
        timestamp: new Date().toISOString()
      });

    } catch (captureError) {
      console.error('Frame capture failed:', captureError.message);

      res.status(500).json({
        error: 'Failed to capture frame: ' + captureError.message,
        cameraId: camera._id,
        streamUrl: camera.streamUrl
      });
    }

  } catch (error) {
    console.error('Error in frame capture:', error.message);
    res.status(500).json({
      error: 'Frame capture error: ' + error.message
    });
  }
});

router.get('/:id/stream', async (req, res) => {
  let streamResponse = null;
  let streamClosed = false;

  try {
    const camera = await CameraService.getCameraById(req.params.id);
    if (!camera) {
      return res.status(404).send('Camera not found');
    }

    if (camera.streamUrl.includes('youtube.com') || camera.streamUrl.includes('youtu.be')) {
      return res.status(400).send('YouTube URLs are not supported for streaming');
    }

    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Accept-Ranges', 'bytes');

    res.on('close', () => {
      streamClosed = true;
      if (streamResponse && streamResponse.data) {
        try {
          if (typeof streamResponse.data.destroy === 'function') {
            streamResponse.data.destroy();
          }
        } catch (destroyError) {
          console.error('Error destroying stream:', destroyError.message);
        }
      }
    });

    try {
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

      if (streamClosed) {
        if (streamResponse.data && typeof streamResponse.data.destroy === 'function') {
          streamResponse.data.destroy();
        }
        return;
      }

      if (streamResponse.headers['content-type']) {
        res.setHeader('Content-Type', streamResponse.headers['content-type']);
      } else {
        res.setHeader('Content-Type', 'video/mp4');
      }

      if (streamResponse.headers['content-length']) {
        res.setHeader('Content-Length', streamResponse.headers['content-length']);
      }

      if (streamResponse.status === 206) {
        res.status(206);
        if (streamResponse.headers['content-range']) {
          res.setHeader('Content-Range', streamResponse.headers['content-range']);
        }
      }

      streamResponse.data.on('error', (error) => {
        console.error('Stream data error:', error.message);
        streamClosed = true;
        if (!res.headersSent) {
          res.status(500).send('Stream error');
        } else {
          try {
            res.end();
          } catch (endError) {
            console.error('Error ending response:', endError.message);
          }
        }
      });

      streamResponse.data.on('end', () => {
        streamClosed = true;
        if (!res.headersSent) {
          res.end();
        }
      });

      try {
        streamResponse.data.pipe(res, { end: true });
      } catch (pipeError) {
        console.error('Error piping stream:', pipeError.message);
        streamClosed = true;
        if (!res.headersSent) {
          res.status(500).send('Stream pipe error');
        }
      }

    } catch (streamError) {
      console.error('Error creating stream:', streamError.message);

      if (streamClosed) {
        return;
      }

      if (streamError.code === 'ENOTFOUND') {
        return res.status(404).send('Stream not found - URL could not be reached (domain not found)');
      } else if (streamError.code === 'ECONNREFUSED') {
        return res.status(503).send('Connection refused - Camera stream unavailable');
      } else if (streamError.code === 'ETIMEDOUT') {
        return res.status(408).send('Request timeout - Camera stream took too long to respond');
      } else if (streamError.response?.status === 404) {
        return res.status(404).send('Stream not found - Camera returned 404');
      } else if (streamError.response?.status === 403) {
        return res.status(403).send('Access forbidden - Camera stream requires authentication');
      } else if (streamError.response?.status === 401) {
        return res.status(401).send('Unauthorized - Invalid camera credentials');
      } else {
        return res.status(500).send('Failed to proxy stream - ' + (streamError.message || 'Unknown error'));
      }
    }

  } catch (error) {
    console.error('Error in stream proxy:', error.message);
    if (!streamClosed && !res.headersSent) {
      res.status(500).send('Stream proxy error - ' + error.message);
    }
  }
});

module.exports = router;