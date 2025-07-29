const express = require('express');
const router = express.Router();
const VideoAnalysis = require('../models/VideoAnalysis');
const Camera = require('../models/Camera');
const llavaService = require('../services/llavaService');
const frameCaptureService = require('../services/frameCaptureService');
const { authenticateToken } = require('./middleware/auth');
const { v4: uuidv4 } = require('uuid');

router.use(authenticateToken);

router.post('/stream', async (req, res) => {
  try {
    const { cameraId, prompt, analysisInterval = 30 } = req.body;

    if (!cameraId || !prompt) {
      return res.status(400).json({
        error: 'Camera ID and prompt are required'
      });
    }

    if (analysisInterval < 6 || analysisInterval > 120) {
      return res.status(400).json({
        error: 'Analysis interval must be between 6 and 120 seconds'
      });
    }

    const camera = await Camera.findById(cameraId, req.user.id);

    if (!camera) {
      return res.status(404).json({
        error: 'Camera not found or access denied'
      });
    }

    const health = await llavaService.checkOllamaHealth();

    if (!health.healthy) {
      return res.status(503).json({
        error: 'LLaVA service unavailable: ' + health.error
      });
    }

    if (!health.hasLLaVA) {
      return res.status(503).json({
        error: 'LLaVA model not found. Please install: ollama pull llava:7b'
      });
    }

    const streamId = uuidv4();

    const analysisSession = await VideoAnalysis.create({
      streamId,
      cameraId,
      userId: req.user.id,
      prompt,
      status: 'active',
      analysisInterval
    });

    res.status(201).json({
      success: true,
      streamId,
      message: 'Video analysis stream started successfully',
      analysisInterval,
      cameraName: camera.name
    });

  } catch (error) {
    console.error('Error in POST /stream:', error);
    res.status(500).json({
      error: error.message || 'Failed to start video analysis stream'
    });
  }
});

router.post('/frame', async (req, res) => {
  try {
    const { streamId, frameBase64, prompt } = req.body;

    if (!streamId || !frameBase64 || !prompt) {
      return res.status(400).json({
        error: 'Stream ID, frame data, and prompt are required'
      });
    }

    const analysisSession = await VideoAnalysis.findByStreamId(streamId);
    if (!analysisSession || analysisSession.userId !== req.user.id) {
      return res.status(403).json({
        error: 'Access denied to this analysis stream'
      });
    }

    const analysisInterval = Math.max(6, analysisSession.analysisInterval || 30);

    try {
      const result = await llavaService.analyzeFrame(frameBase64, prompt, analysisInterval, streamId);

      const resultData = {
        streamId,
        answer: result.answer,
        accuracyScore: result.accuracyScore,
        timestamp: new Date().toISOString(),
        rawJson: result.rawJson
      };

      await VideoAnalysis.createResult(resultData);

      res.json({
        success: true,
        message: 'Frame analysis completed successfully',
        nextAnalysisIn: analysisInterval,
        timestamp: new Date().toISOString()
      });

    } catch (processingError) {
      console.error('Frame processing error:', processingError.message);

      await VideoAnalysis.createResult({
        streamId,
        answer: `Analysis failed: ${processingError.message}`,
        accuracyScore: 0,
        timestamp: new Date().toISOString(),
        rawJson: JSON.stringify({ error: processingError.message })
      });

      res.status(500).json({
        error: processingError.message,
        streamId: streamId,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('Critical error in POST /frame:', error);

    res.status(500).json({
      error: error.message || 'Failed to process frame',
      timestamp: new Date().toISOString()
    });
  }
});

router.post('/query', async (req, res) => {
  try {
    const { streamId, query, limit = 10 } = req.body;

    if (!streamId || !query) {
      return res.status(400).json({
        error: 'Stream ID and query are required'
      });
    }

    const analysisSession = await VideoAnalysis.findByStreamId(streamId);

    if (!analysisSession) {
      return res.status(404).json({
        error: 'Analysis stream not found'
      });
    }

    if (analysisSession.userId !== req.user.id) {
      return res.status(403).json({
        error: 'Access denied to this analysis stream'
      });
    }

    const results = await VideoAnalysis.getResults(streamId, limit);

    const responseData = {
      success: true,
      query,
      streamId,
      matchedElements: results.map(result => ({
        timestamp: result.timestamp,
        answer: result.answer,
        confidenceScore: result.accuracyScore,
        createdAt: result.createdAt
      })),
      totalMatches: results.length
    };

    res.json(responseData);

  } catch (error) {
    console.error('Error in POST /query:', error);
    res.status(500).json({
      error: error.message || 'Failed to query analysis results'
    });
  }
});

router.delete('/stream/:streamId', async (req, res) => {
  try {
    const { streamId } = req.params;

    const analysisSession = await VideoAnalysis.findByStreamId(streamId);

    if (!analysisSession) {
      return res.status(404).json({
        error: 'Analysis stream not found'
      });
    }

    if (analysisSession.userId !== req.user.id) {
      return res.status(403).json({
        error: 'Access denied to this analysis stream'
      });
    }

    await VideoAnalysis.updateStatus(streamId, 'stopped');

    res.json({
      success: true,
      message: 'Video analysis stream stopped successfully',
      streamId
    });

  } catch (error) {
    console.error('Error in DELETE /stream/:streamId:', error);
    res.status(500).json({
      error: error.message || 'Failed to stop video analysis stream'
    });
  }
});

router.get('/suggestions/:cameraId', async (req, res) => {
  try {
    const { cameraId } = req.params;

    const camera = await Camera.findById(cameraId, req.user.id);

    if (!camera) {
      return res.status(404).json({
        error: 'Camera not found or access denied'
      });
    }

    if (camera.type === 'usb' || camera.streamUrl.startsWith('usb:')) {
      return res.status(400).json({
        error: 'USB cameras require client-side frame capture. Use POST endpoint with frame data.',
        cameraType: 'usb'
      });
    }

    const health = await llavaService.checkOllamaHealth();

    if (!health.healthy || !health.hasLLaVA) {
      return res.status(503).json({
        error: 'LLaVA service is not available. Please ensure Ollama is running and LLaVA model is installed.',
        details: {
          ollamaHealthy: health.healthy,
          hasLLaVA: health.hasLLaVA,
          error: health.error
        }
      });
    }

    let frameBase64;
    try {
      const frameResponse = await frameCaptureService.captureFrameFromStream(
        camera._id,
        camera.streamUrl,
        camera.type
      );
      frameBase64 = frameResponse;
    } catch (frameError) {
      console.error('Frame capture failed:', frameError.message);
      return res.status(500).json({
        error: 'Could not capture frame from camera stream: ' + frameError.message,
        details: {
          cameraId: camera._id,
          frameError: frameError.message
        }
      });
    }

    if (!frameBase64 || frameBase64.length < 1000) {
      return res.status(400).json({
        error: 'Captured frame is too small or empty',
        frameSize: frameBase64?.length || 0
      });
    }

    try {
      const suggestions = await llavaService.generateSuggestions(frameBase64);

      res.json({
        success: true,
        suggestions,
        cameraId: camera._id,
        cameraName: camera.name,
        source: 'llava-model',
        frameSize: frameBase64.length,
        timestamp: new Date().toISOString(),
        note: 'Suggestions generated using same pipeline as /frame and /query endpoints'
      });

    } catch (suggestionError) {
      console.error('Model suggestion generation failed:', suggestionError.message);

      let actualError = suggestionError.message;
      if (suggestionError.message.includes('[object Object]')) {
        actualError = 'LLaVA model inference failed - check server logs for details';
      }

      return res.status(500).json({
        error: 'Failed to generate suggestions from LLaVA model: ' + actualError,
        details: {
          errorType: suggestionError.constructor.name,
          cameraId: camera._id,
          frameSize: frameBase64.length,
          timestamp: new Date().toISOString(),
          modelError: true
        }
      });
    }

  } catch (error) {
    console.error('Critical error in GET /suggestions/:cameraId:', error.message);

    let actualError = error.message;
    if (error.message.includes('[object Object]')) {
      actualError = 'System error in suggestion generation - check server logs';
    }

    res.status(500).json({
      error: 'System error in suggestion generation: ' + actualError,
      timestamp: new Date().toISOString()
    });
  }
});

router.post('/suggestions/:cameraId', async (req, res) => {
  try {
    const { cameraId } = req.params;
    const { frameBase64 } = req.body;

    const camera = await Camera.findById(cameraId, req.user.id);

    if (!camera) {
      return res.status(404).json({
        error: 'Camera not found or access denied'
      });
    }

    const health = await llavaService.checkOllamaHealth();

    if (!health.healthy || !health.hasLLaVA) {
      return res.status(503).json({
        error: 'LLaVA service is not available. Please ensure Ollama is running and LLaVA model is installed.',
        details: {
          ollamaHealthy: health.healthy,
          hasLLaVA: health.hasLLaVA,
          availableModels: health.availableModels || [],
          error: health.error
        }
      });
    }

    if (!frameBase64 || frameBase64.length < 1000) {
      return res.status(400).json({
        error: 'Frame data is too small or empty. Please ensure camera is providing valid frames.',
        frameSize: frameBase64?.length || 0
      });
    }

    try {
      const suggestions = await llavaService.generateSuggestions(frameBase64);

      res.json({
        success: true,
        suggestions,
        cameraId: camera._id,
        cameraName: camera.name,
        source: 'llava-model',
        frameSize: frameBase64.length,
        timestamp: new Date().toISOString(),
        note: 'Suggestions generated using same pipeline as /frame and /query endpoints - no fallbacks'
      });

    } catch (suggestionError) {
      console.error('Model suggestion generation failed:', suggestionError.message);

      let actualError = suggestionError.message;
      if (suggestionError.message.includes('[object Object]')) {
        actualError = 'LLaVA model inference failed - check server logs for details';
      }

      return res.status(500).json({
        error: 'Failed to generate suggestions from LLaVA model: ' + actualError,
        details: {
          errorType: suggestionError.constructor.name,
          cameraId: camera._id,
          frameSize: frameBase64.length,
          timestamp: new Date().toISOString(),
          modelError: true
        }
      });
    }

  } catch (error) {
    console.error('Critical error in POST /suggestions/:cameraId:', error.message);

    let actualError = error.message;
    if (error.message.includes('[object Object]')) {
      actualError = 'System error in suggestion generation - check server logs';
    }

    res.status(500).json({
      error: 'System error in suggestion generation: ' + actualError,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;