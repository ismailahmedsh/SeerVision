const express = require('express');
const router = express.Router();
const VideoAnalysis = require('../models/VideoAnalysis');
const Camera = require('../models/Camera');
const llavaService = require('../services/llavaService');
const frameCaptureService = require('../services/frameCaptureService');
const { authenticateToken } = require('./middleware/auth');
const { v4: uuidv4 } = require('uuid');

// Apply authentication middleware
router.use(authenticateToken);

// POST /api/video-analysis/stream - Start video analysis stream
router.post('/stream', async (req, res) => {
  console.log('[VIDEO_ANALYSIS_ROUTES] ===== POST /stream START =====');
  console.log('[VIDEO_ANALYSIS_ROUTES] User ID:', req.user.id);
  console.log('[VIDEO_ANALYSIS_ROUTES] Request body:', req.body);

  try {
    const { cameraId, prompt, analysisInterval = 30 } = req.body;

    console.log('[VIDEO_ANALYSIS_ROUTES] Extracted data:', { cameraId, prompt, analysisInterval });

    if (!cameraId || !prompt) {
      console.error('[VIDEO_ANALYSIS_ROUTES] Missing required fields');
      return res.status(400).json({
        error: 'Camera ID and prompt are required'
      });
    }

    // Validate interval range (6-120 seconds)
    if (analysisInterval < 6 || analysisInterval > 120) {
      console.error('[VIDEO_ANALYSIS_ROUTES] Invalid interval:', analysisInterval);
      return res.status(400).json({
        error: 'Analysis interval must be between 6 and 120 seconds'
      });
    }

    // Get camera details
    console.log('[VIDEO_ANALYSIS_ROUTES] Getting camera details for ID:', cameraId);
    const camera = await Camera.findById(cameraId, req.user.id);
    console.log('[VIDEO_ANALYSIS_ROUTES] Camera found:', camera);

    if (!camera) {
      console.error('[VIDEO_ANALYSIS_ROUTES] Camera not found or access denied');
      return res.status(404).json({
        error: 'Camera not found or access denied'
      });
    }

    // Check Ollama health
    console.log('[VIDEO_ANALYSIS_ROUTES] Checking Ollama health...');
    const health = await llavaService.checkOllamaHealth();
    console.log('[VIDEO_ANALYSIS_ROUTES] Ollama health check result:', health);

    if (!health.healthy) {
      console.error('[VIDEO_ANALYSIS_ROUTES] LLaVA service unavailable:', health.error);
      return res.status(503).json({
        error: 'LLaVA service unavailable: ' + health.error
      });
    }

    if (!health.hasLLaVA) {
      console.error('[VIDEO_ANALYSIS_ROUTES] LLaVA model not found');
      return res.status(503).json({
        error: 'LLaVA model not found. Please install: ollama pull llava:7b'
      });
    }

    // Generate unique stream ID
    const streamId = uuidv4();
    console.log('[VIDEO_ANALYSIS_ROUTES] Generated stream ID:', streamId);

    // Create analysis session in database
    console.log('[VIDEO_ANALYSIS_ROUTES] Creating analysis session in database...');
    const analysisSession = await VideoAnalysis.create({
      streamId,
      cameraId,
      userId: req.user.id,
      prompt,
      status: 'active',
      analysisInterval
    });
    console.log('[VIDEO_ANALYSIS_ROUTES] Analysis session created:', analysisSession);

    res.status(201).json({
      success: true,
      streamId,
      message: 'Video analysis stream started successfully',
      analysisInterval,
      cameraName: camera.name
    });

  } catch (error) {
    console.error('[VIDEO_ANALYSIS_ROUTES] CRITICAL ERROR in POST /stream:', error);
    console.error('[VIDEO_ANALYSIS_ROUTES] Error stack:', error.stack);
    res.status(500).json({
      error: error.message || 'Failed to start video analysis stream'
    });
  }

  console.log('[VIDEO_ANALYSIS_ROUTES] ===== POST /stream END =====');
});

// POST /api/video-analysis/frame - Process client-side captured frame
router.post('/frame', async (req, res) => {
  console.log('[VIDEO_ANALYSIS_ROUTES] ===== FRAME ENDPOINT START =====');
  console.log('[VIDEO_ANALYSIS_ROUTES] User ID:', req.user.id);
  console.log('[VIDEO_ANALYSIS_ROUTES] Request timestamp:', new Date().toISOString());

  try {
    const { streamId, frameBase64, prompt } = req.body;

    console.log('[VIDEO_ANALYSIS_ROUTES] Request validation');
    console.log('[VIDEO_ANALYSIS_ROUTES] Stream ID:', streamId);
    console.log('[VIDEO_ANALYSIS_ROUTES] Prompt:', prompt);
    console.log('[VIDEO_ANALYSIS_ROUTES] Frame size:', frameBase64?.length || 0);

    if (!streamId || !frameBase64 || !prompt) {
      console.error('[VIDEO_ANALYSIS_ROUTES] Missing required fields');
      return res.status(400).json({
        error: 'Stream ID, frame data, and prompt are required'
      });
    }

    // Verify stream ownership
    const analysisSession = await VideoAnalysis.findByStreamId(streamId);
    if (!analysisSession || analysisSession.userId !== req.user.id) {
      console.error('[VIDEO_ANALYSIS_ROUTES] Stream access denied');
      return res.status(403).json({
        error: 'Access denied to this analysis stream'
      });
    }

    // Get analysis interval with minimum enforcement
    const analysisInterval = Math.max(6, analysisSession.analysisInterval || 30);
    console.log('[VIDEO_ANALYSIS_ROUTES] Using analysis interval:', analysisInterval, 'seconds');

    try {
      // Process frame with LLaVA
      const result = await llavaService.analyzeFrame(frameBase64, prompt, analysisInterval, streamId);

      // Store result in database
      const resultData = {
        streamId,
        answer: result.answer,
        accuracyScore: result.accuracyScore,
        timestamp: new Date().toISOString(),
        rawJson: result.rawJson
      };

      await VideoAnalysis.createResult(resultData);

      console.log('[VIDEO_ANALYSIS_ROUTES] Frame processed successfully');

      res.json({
        success: true,
        message: 'Frame analysis completed successfully',
        nextAnalysisIn: analysisInterval,
        timestamp: new Date().toISOString()
      });

    } catch (processingError) {
      console.error('[VIDEO_ANALYSIS_ROUTES] Frame processing error:', processingError.message);

      // Store error in database
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
    console.error('[VIDEO_ANALYSIS_ROUTES] Critical error in POST /frame:', error);

    res.status(500).json({
      error: error.message || 'Failed to process frame',
      timestamp: new Date().toISOString()
    });
  }

  console.log('[VIDEO_ANALYSIS_ROUTES] ===== FRAME ENDPOINT END =====');
});

// POST /api/video-analysis/query - Query analysis results
router.post('/query', async (req, res) => {
  console.log('[VIDEO_ANALYSIS_ROUTES] ===== POST /query START =====');
  console.log('[VIDEO_ANALYSIS_ROUTES] User ID:', req.user.id);
  console.log('[VIDEO_ANALYSIS_ROUTES] Request body:', req.body);

  try {
    const { streamId, query, limit = 10 } = req.body;

    console.log('[VIDEO_ANALYSIS_ROUTES] Extracted data:', { streamId, query, limit });

    if (!streamId || !query) {
      console.error('[VIDEO_ANALYSIS_ROUTES] Missing required fields');
      return res.status(400).json({
        error: 'Stream ID and query are required'
      });
    }

    // Verify stream exists and belongs to user
    console.log('[VIDEO_ANALYSIS_ROUTES] Verifying stream exists:', streamId);
    const analysisSession = await VideoAnalysis.findByStreamId(streamId);
    console.log('[VIDEO_ANALYSIS_ROUTES] Analysis session found:', analysisSession);

    if (!analysisSession) {
      console.error('[VIDEO_ANALYSIS_ROUTES] Analysis stream not found');
      return res.status(404).json({
        error: 'Analysis stream not found'
      });
    }

    if (analysisSession.userId !== req.user.id) {
      console.error('[VIDEO_ANALYSIS_ROUTES] Access denied to stream');
      return res.status(403).json({
        error: 'Access denied to this analysis stream'
      });
    }

    // Get analysis results
    console.log('[VIDEO_ANALYSIS_ROUTES] Getting analysis results...');
    const results = await VideoAnalysis.getResults(streamId, limit);
    console.log('[VIDEO_ANALYSIS_ROUTES] Raw results from database:', results);

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

    console.log('[VIDEO_ANALYSIS_ROUTES] Response data:', responseData);
    res.json(responseData);

  } catch (error) {
    console.error('[VIDEO_ANALYSIS_ROUTES] CRITICAL ERROR in POST /query:', error);
    console.error('[VIDEO_ANALYSIS_ROUTES] Error stack:', error.stack);
    res.status(500).json({
      error: error.message || 'Failed to query analysis results'
    });
  }

  console.log('[VIDEO_ANALYSIS_ROUTES] ===== POST /query END =====');
});

// DELETE /api/video-analysis/stream/:streamId - Stop analysis stream
router.delete('/stream/:streamId', async (req, res) => {
  console.log('[VIDEO_ANALYSIS_ROUTES] ===== DELETE /stream/:streamId START =====');
  console.log('[VIDEO_ANALYSIS_ROUTES] Stream ID:', req.params.streamId);
  console.log('[VIDEO_ANALYSIS_ROUTES] User ID:', req.user.id);

  try {
    const { streamId } = req.params;

    // Verify stream exists and belongs to user
    console.log('[VIDEO_ANALYSIS_ROUTES] Verifying stream exists:', streamId);
    const analysisSession = await VideoAnalysis.findByStreamId(streamId);
    console.log('[VIDEO_ANALYSIS_ROUTES] Analysis session found:', analysisSession);

    if (!analysisSession) {
      console.error('[VIDEO_ANALYSIS_ROUTES] Analysis stream not found');
      return res.status(404).json({
        error: 'Analysis stream not found'
      });
    }

    if (analysisSession.userId !== req.user.id) {
      console.error('[VIDEO_ANALYSIS_ROUTES] Access denied to stream');
      return res.status(403).json({
        error: 'Access denied to this analysis stream'
      });
    }

    // Update status in database
    console.log('[VIDEO_ANALYSIS_ROUTES] Updating database status to stopped...');
    await VideoAnalysis.updateStatus(streamId, 'stopped');
    console.log('[VIDEO_ANALYSIS_ROUTES] Database status updated');

    console.log('[VIDEO_ANALYSIS_ROUTES] Analysis stream stopped:', streamId);

    res.json({
      success: true,
      message: 'Video analysis stream stopped successfully',
      streamId
    });

  } catch (error) {
    console.error('[VIDEO_ANALYSIS_ROUTES] CRITICAL ERROR in DELETE /stream/:streamId:', error);
    console.error('[VIDEO_ANALYSIS_ROUTES] Error stack:', error.stack);
    res.status(500).json({
      error: error.message || 'Failed to stop video analysis stream'
    });
  }

  console.log('[VIDEO_ANALYSIS_ROUTES] ===== DELETE /stream/:streamId END =====');
});

// GET /api/video-analysis/suggestions/:cameraId - Get dynamic prompt suggestions (NON-USB CAMERAS ONLY)
router.get('/suggestions/:cameraId', async (req, res) => {
  console.log('[VIDEO_ANALYSIS_ROUTES] ===== GET /suggestions/:cameraId START =====');
  console.log('[VIDEO_ANALYSIS_ROUTES] Request timestamp:', new Date().toISOString());
  console.log('[VIDEO_ANALYSIS_ROUTES] Camera ID:', req.params.cameraId);
  console.log('[VIDEO_ANALYSIS_ROUTES] User ID:', req.user.id);
  console.log('[VIDEO_ANALYSIS_ROUTES] Using SAME pipeline as /frame and /query endpoints');

  try {
    const { cameraId } = req.params;

    // Get camera details - SAME as other endpoints
    console.log('[VIDEO_ANALYSIS_ROUTES] Getting camera details for ID:', cameraId);
    const camera = await Camera.findById(cameraId, req.user.id);
    console.log('[VIDEO_ANALYSIS_ROUTES] Camera found:', !!camera);

    if (!camera) {
      console.error('[VIDEO_ANALYSIS_ROUTES] Camera not found or access denied');
      return res.status(404).json({
        error: 'Camera not found or access denied'
      });
    }

    // For USB cameras, client should use POST endpoint with frame data
    if (camera.type === 'usb' || camera.streamUrl.startsWith('usb:')) {
      console.error('[VIDEO_ANALYSIS_ROUTES] USB camera detected - GET endpoint not supported');
      return res.status(400).json({
        error: 'USB cameras require client-side frame capture. Use POST endpoint with frame data.',
        cameraType: 'usb'
      });
    }

    console.log('[VIDEO_ANALYSIS_ROUTES] ===== CHECKING LLAVA HEALTH =====');
    // Check Ollama health - SAME as other endpoints
    const health = await llavaService.checkOllamaHealth();
    console.log('[VIDEO_ANALYSIS_ROUTES] Ollama health check result:', health);

    if (!health.healthy || !health.hasLLaVA) {
      console.error('[VIDEO_ANALYSIS_ROUTES] LLaVA service not available');
      return res.status(503).json({
        error: 'LLaVA service is not available. Please ensure Ollama is running and LLaVA model is installed.',
        details: {
          ollamaHealthy: health.healthy,
          hasLLaVA: health.hasLLaVA,
          error: health.error
        }
      });
    }

    console.log('[VIDEO_ANALYSIS_ROUTES] ===== ATTEMPTING FRAME CAPTURE =====');
    // For non-USB cameras, capture frame using SAME logic as other endpoints
    let frameBase64;
    try {
      const frameResponse = await frameCaptureService.captureFrameFromStream(
        camera._id,
        camera.streamUrl,
        camera.type
      );
      frameBase64 = frameResponse;
      console.log('[VIDEO_ANALYSIS_ROUTES] Frame captured successfully, size:', frameBase64?.length || 0);
    } catch (frameError) {
      console.error('[VIDEO_ANALYSIS_ROUTES] Frame capture failed:', frameError.message);
      return res.status(500).json({
        error: 'Could not capture frame from camera stream: ' + frameError.message,
        details: {
          cameraId: camera._id,
          frameError: frameError.message
        }
      });
    }

    if (!frameBase64 || frameBase64.length < 1000) {
      console.error('[VIDEO_ANALYSIS_ROUTES] Frame too small or empty');
      return res.status(400).json({
        error: 'Captured frame is too small or empty',
        frameSize: frameBase64?.length || 0
      });
    }

    console.log('[VIDEO_ANALYSIS_ROUTES] ===== GENERATING SUGGESTIONS WITH PURE MODEL PIPELINE =====');
    console.log('[VIDEO_ANALYSIS_ROUTES] Using SAME method as working /frame and /query endpoints');
    console.log('[VIDEO_ANALYSIS_ROUTES] NO FALLBACKS - pure LLaVA model output only');
    
    try {
      // Use the SAME generateSuggestions method that now mirrors /frame logic
      const suggestions = await llavaService.generateSuggestions(frameBase64);
      console.log('[VIDEO_ANALYSIS_ROUTES] Pure model suggestions generated:', suggestions);

      // SUCCESS - return suggestions with clear model source
      res.json({
        success: true,
        suggestions,
        cameraId: camera._id,
        cameraName: camera.name,
        source: 'llava-model', // Confirm this is from real model
        frameSize: frameBase64.length,
        timestamp: new Date().toISOString(),
        note: 'Suggestions generated using same pipeline as /frame and /query endpoints'
      });

    } catch (suggestionError) {
      console.error('[VIDEO_ANALYSIS_ROUTES] ===== MODEL SUGGESTION GENERATION FAILED =====');
      console.error('[VIDEO_ANALYSIS_ROUTES] LLaVA model failed to generate suggestions');
      console.error('[VIDEO_ANALYSIS_ROUTES] Error type:', suggestionError.constructor.name);
      console.error('[VIDEO_ANALYSIS_ROUTES] Error message:', suggestionError.message);
      console.error('[VIDEO_ANALYSIS_ROUTES] NO FALLBACKS - returning proper error response');

      // Extract actual error message from nested errors
      let actualError = suggestionError.message;
      if (suggestionError.message.includes('[object Object]')) {
        console.error('[VIDEO_ANALYSIS_ROUTES] Detected [object Object] error, extracting details');
        actualError = 'LLaVA model inference failed - check server logs for details';
      }

      // Return proper 5xx error - NO success: true for failures
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
    console.error('[VIDEO_ANALYSIS_ROUTES] ===== CRITICAL ERROR in GET /suggestions/:cameraId =====');
    console.error('[VIDEO_ANALYSIS_ROUTES] Critical system error:', error.message);
    console.error('[VIDEO_ANALYSIS_ROUTES] Error type:', error.constructor.name);

    // Extract actual error message
    let actualError = error.message;
    if (error.message.includes('[object Object]')) {
      actualError = 'System error in suggestion generation - check server logs';
    }

    res.status(500).json({
      error: 'System error in suggestion generation: ' + actualError,
      timestamp: new Date().toISOString()
    });
  }

  console.log('[VIDEO_ANALYSIS_ROUTES] ===== GET /suggestions/:cameraId END =====');
});

// POST /api/video-analysis/suggestions/:cameraId - Get dynamic prompt suggestions with frame data (USB CAMERAS)
router.post('/suggestions/:cameraId', async (req, res) => {
  console.log('[VIDEO_ANALYSIS_ROUTES] ===== POST /suggestions/:cameraId START =====');
  console.log('[VIDEO_ANALYSIS_ROUTES] Request timestamp:', new Date().toISOString());
  console.log('[VIDEO_ANALYSIS_ROUTES] Camera ID:', req.params.cameraId);
  console.log('[VIDEO_ANALYSIS_ROUTES] User ID:', req.user.id);
  console.log('[VIDEO_ANALYSIS_ROUTES] Has frame data:', !!req.body.frameBase64);
  console.log('[VIDEO_ANALYSIS_ROUTES] Frame data size:', req.body.frameBase64?.length || 0);
  console.log('[VIDEO_ANALYSIS_ROUTES] Using SAME pipeline as /frame and /query endpoints');

  try {
    const { cameraId } = req.params;
    const { frameBase64 } = req.body;

    // Get camera details - SAME as other endpoints
    console.log('[VIDEO_ANALYSIS_ROUTES] Getting camera details for ID:', cameraId);
    const camera = await Camera.findById(cameraId, req.user.id);
    console.log('[VIDEO_ANALYSIS_ROUTES] Camera found:', !!camera);

    if (!camera) {
      console.error('[VIDEO_ANALYSIS_ROUTES] Camera not found or access denied');
      return res.status(404).json({
        error: 'Camera not found or access denied'
      });
    }

    console.log('[VIDEO_ANALYSIS_ROUTES] ===== CHECKING LLAVA HEALTH =====');
    // Check Ollama health - SAME as other endpoints
    const health = await llavaService.checkOllamaHealth();
    console.log('[VIDEO_ANALYSIS_ROUTES] Ollama health check result:', health);

    if (!health.healthy || !health.hasLLaVA) {
      console.error('[VIDEO_ANALYSIS_ROUTES] LLaVA service not available');
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
      console.error('[VIDEO_ANALYSIS_ROUTES] Frame data too small or empty');
      return res.status(400).json({
        error: 'Frame data is too small or empty. Please ensure camera is providing valid frames.',
        frameSize: frameBase64?.length || 0
      });
    }

    console.log('[VIDEO_ANALYSIS_ROUTES] ===== GENERATING PURE MODEL SUGGESTIONS =====');
    console.log('[VIDEO_ANALYSIS_ROUTES] Frame size:', frameBase64.length, 'characters');
    console.log('[VIDEO_ANALYSIS_ROUTES] Using SAME method as working /frame and /query endpoints');
    console.log('[VIDEO_ANALYSIS_ROUTES] NO FALLBACKS - pure LLaVA model output only');

    try {
      // Use the SAME generateSuggestions method that now mirrors /frame logic
      const suggestions = await llavaService.generateSuggestions(frameBase64);
      console.log('[VIDEO_ANALYSIS_ROUTES] Pure model suggestions generated:', suggestions);
      console.log('[VIDEO_ANALYSIS_ROUTES] Number of suggestions:', suggestions.length);

      console.log('[VIDEO_ANALYSIS_ROUTES] ===== PURE MODEL SUGGESTIONS SUCCESS =====');

      // SUCCESS - return suggestions with clear model source
      res.json({
        success: true,
        suggestions,
        cameraId: camera._id,
        cameraName: camera.name,
        source: 'llava-model', // Confirm this is from real model
        frameSize: frameBase64.length,
        timestamp: new Date().toISOString(),
        note: 'Suggestions generated using same pipeline as /frame and /query endpoints - no fallbacks'
      });

    } catch (suggestionError) {
      console.error('[VIDEO_ANALYSIS_ROUTES] ===== MODEL SUGGESTION GENERATION FAILED =====');
      console.error('[VIDEO_ANALYSIS_ROUTES] LLaVA model failed to generate suggestions');
      console.error('[VIDEO_ANALYSIS_ROUTES] Error type:', suggestionError.constructor.name);
      console.error('[VIDEO_ANALYSIS_ROUTES] Error message:', suggestionError.message);
      console.error('[VIDEO_ANALYSIS_ROUTES] NO FALLBACKS - returning proper error response');

      // Extract actual error message from nested errors
      let actualError = suggestionError.message;
      if (suggestionError.message.includes('[object Object]')) {
        console.error('[VIDEO_ANALYSIS_ROUTES] Detected [object Object] error, extracting details');
        actualError = 'LLaVA model inference failed - check server logs for details';
      }

      // Return proper 5xx error - NO success: true for failures
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
    console.error('[VIDEO_ANALYSIS_ROUTES] ===== CRITICAL ERROR in POST /suggestions/:cameraId =====');
    console.error('[VIDEO_ANALYSIS_ROUTES] Critical system error:', error.message);
    console.error('[VIDEO_ANALYSIS_ROUTES] Error type:', error.constructor.name);

    // Extract actual error message
    let actualError = error.message;
    if (error.message.includes('[object Object]')) {
      actualError = 'System error in suggestion generation - check server logs';
    }

    res.status(500).json({
      error: 'System error in suggestion generation: ' + actualError,
      timestamp: new Date().toISOString()
    });
  }

  console.log('[VIDEO_ANALYSIS_ROUTES] ===== POST /suggestions/:cameraId END =====');
});

module.exports = router;