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
    const { cameraId, prompt, analysisInterval = 30, jsonOption = false } = req.body;

    if (!cameraId || !prompt) {
      console.error('Stream creation failed: Missing required fields', { cameraId: !!cameraId, prompt: !!prompt });
      return res.status(400).json({
        error: 'Camera ID and prompt are required'
      });
    }

    if (analysisInterval < 6 || analysisInterval > 120) {
      console.error('Stream creation failed: Invalid analysis interval', { analysisInterval });
      return res.status(400).json({
        error: 'Analysis interval must be between 6 and 120 seconds'
      });
    }

    console.log('Creating analysis stream', { cameraId, analysisInterval, jsonOption });

    const camera = await Camera.findById(cameraId, req.user.id);
    if (!camera) {
      console.error('Stream creation failed: Camera not found', { cameraId, userId: req.user.id });
      return res.status(404).json({
        error: 'Camera not found or access denied'
      });
    }

    const health = await llavaService.checkOllamaHealth();
    if (!health.healthy) {
      console.error('Stream creation failed: LLaVA service unhealthy', health);
      return res.status(503).json({
        error: 'LLaVA service unavailable: ' + health.error
      });
    }

    if (!health.hasLLaVA) {
      console.error('Stream creation failed: LLaVA model not found');
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
      analysisInterval,
      jsonOption
    });

    console.log('Analysis stream created successfully', { streamId, cameraName: camera.name, jsonOption });

    res.status(201).json({
      success: true,
      streamId,
      message: 'Video analysis stream started successfully',
      analysisInterval,
      cameraName: camera.name,
      jsonOption
    });

  } catch (error) {
    console.error('Error creating analysis stream:', error);
    res.status(500).json({
      error: error.message || 'Failed to start video analysis stream'
    });
  }
});

router.post('/frame', async (req, res) => {
  try {
    const { streamId, frameBase64, prompt, jsonOption = false } = req.body;

    if (!streamId || !frameBase64 || !prompt) {
      console.error('Frame analysis failed: Missing required fields', { 
        streamId: !!streamId, 
        frameBase64: !!frameBase64, 
        prompt: !!prompt 
      });
      return res.status(400).json({
        error: 'Stream ID, frame data, and prompt are required'
      });
    }

    console.log('Processing frame analysis', { streamId, frameSize: frameBase64.length, jsonOption });

    const analysisSession = await VideoAnalysis.findByStreamId(streamId);
    if (!analysisSession || analysisSession.userId !== req.user.id) {
      console.error('Frame analysis failed: Access denied', { streamId, userId: req.user.id });
      return res.status(403).json({
        error: 'Access denied to this analysis stream'
      });
    }

    const analysisInterval = Math.max(6, analysisSession.analysisInterval || 30);

    let finalPrompt = prompt;
    if (jsonOption) {
      finalPrompt = `${prompt}

Return the response strictly as a valid JSON object. Do not include any markdown, explanations, or additional text.`;
      console.log('JSON option enabled for frame analysis', { streamId });
    }

    try {
      console.log('Sending frame to LLaVA service', { streamId, analysisInterval });
      const result = await llavaService.analyzeFrame(frameBase64, finalPrompt, analysisInterval, streamId);

      const resultData = {
        streamId,
        answer: result.answer,
        accuracyScore: result.accuracyScore,
        timestamp: new Date().toISOString(),
        rawJson: result.rawJson
      };

      await VideoAnalysis.createResult(resultData);

      console.log('Frame analysis completed successfully', { 
        streamId, 
        answerLength: result.answer?.length, 
        processingTime: result.processingTime 
      });

      res.json({
        success: true,
        message: 'Frame analysis completed successfully',
        nextAnalysisIn: analysisInterval,
        timestamp: new Date().toISOString(),
        jsonOption: jsonOption,
        resultPreview: result.answer,
        debugInfo: {
          answerLength: result.answer?.length || 0,
          accuracyScore: result.accuracyScore,
          processingTime: result.processingTime
        }
      });

    } catch (processingError) {
      console.error('Frame processing error:', processingError);

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
    console.error('Critical error in frame analysis:', error);
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
      console.error('Query failed: Missing required fields', { streamId: !!streamId, query: !!query });
      return res.status(400).json({
        error: 'Stream ID and query are required'
      });
    }

    console.log('Processing analysis query', { streamId, query, limit });

    const analysisSession = await VideoAnalysis.findByStreamId(streamId);
    if (!analysisSession) {
      console.error('Query failed: Analysis stream not found', { streamId });
      return res.status(404).json({
        error: 'Analysis stream not found'
      });
    }

    if (analysisSession.userId !== req.user.id) {
      console.error('Query failed: Access denied', { streamId, userId: req.user.id });
      return res.status(403).json({
        error: 'Access denied to this analysis stream'
      });
    }

    const results = await VideoAnalysis.getResults(streamId, limit);

    console.log('Query completed successfully', { streamId, resultCount: results.length });

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
    console.error('Error processing query:', error);
    res.status(500).json({
      error: error.message || 'Failed to query analysis results'
    });
  }
});

router.delete('/stream/:streamId', async (req, res) => {
  try {
    const { streamId } = req.params;

    console.log('Stopping analysis stream', { streamId });

    const analysisSession = await VideoAnalysis.findByStreamId(streamId);
    if (!analysisSession) {
      console.error('Stream stop failed: Analysis stream not found', { streamId });
      return res.status(404).json({
        error: 'Analysis stream not found'
      });
    }

    if (analysisSession.userId !== req.user.id) {
      console.error('Stream stop failed: Access denied', { streamId, userId: req.user.id });
      return res.status(403).json({
        error: 'Access denied to this analysis stream'
      });
    }

    await VideoAnalysis.updateStatus(streamId, 'stopped');

    console.log('Analysis stream stopped successfully', { streamId });

    res.json({
      success: true,
      message: 'Video analysis stream stopped successfully',
      streamId
    });

  } catch (error) {
    console.error('Error stopping analysis stream:', error);
    res.status(500).json({
      error: error.message || 'Failed to stop video analysis stream'
    });
  }
});

router.get('/suggestions/:cameraId', async (req, res) => {
  try {
    const { cameraId } = req.params;

    console.log('Processing suggestions request (GET)', { cameraId });

    const camera = await Camera.findById(cameraId, req.user.id);
    if (!camera) {
      console.error('Suggestions failed: Camera not found', { cameraId, userId: req.user.id });
      return res.status(404).json({
        error: 'Camera not found or access denied'
      });
    }

    if (camera.type === 'usb' || camera.streamUrl.startsWith('usb:')) {
      console.log('USB camera detected, requiring client-side frame capture', { cameraId });
      return res.status(400).json({
        error: 'USB cameras require client-side frame capture. Use POST endpoint with frame data.',
        cameraType: 'usb'
      });
    }

    const health = await llavaService.checkOllamaHealth();
    if (!health.healthy || !health.hasLLaVA) {
      console.error('Suggestions failed: LLaVA service unavailable', health);
      return res.status(503).json({
        error: 'LLaVA service is not available. Please ensure Ollama is running and LLaVA model is installed.',
        details: health
      });
    }

    let frameBase64;
    try {
      console.log('Capturing frame from camera stream', { cameraId, streamUrl: camera.streamUrl });
      const frameResponse = await frameCaptureService.captureFrameFromStream(
        camera._id,
        camera.streamUrl,
        camera.type
      );
      frameBase64 = frameResponse;
    } catch (frameError) {
      console.error('Frame capture failed:', frameError);
      return res.status(500).json({
        error: 'Could not capture frame from camera stream: ' + frameError.message,
        details: {
          cameraId: camera._id,
          frameError: frameError.message
        }
      });
    }

    if (!frameBase64 || frameBase64.length < 1000) {
      console.error('Captured frame too small', { frameSize: frameBase64?.length || 0 });
      return res.status(400).json({
        error: 'Captured frame is too small or empty',
        frameSize: frameBase64?.length || 0
      });
    }

    try {
      console.log('Generating suggestions with LLaVA', { cameraId, frameSize: frameBase64.length });
      const suggestions = await llavaService.generateSuggestions(frameBase64);

      console.log('Suggestions generated successfully', { cameraId, suggestionCount: suggestions.length });

      res.json({
        success: true,
        suggestions,
        cameraId: camera._id,
        cameraName: camera.name,
        source: 'llava-model',
        frameSize: frameBase64.length,
        timestamp: new Date().toISOString()
      });

    } catch (suggestionError) {
      console.error('Model suggestion generation failed:', suggestionError);
      return res.status(500).json({
        error: 'Failed to generate suggestions from LLaVA model: ' + suggestionError.message,
        details: {
          errorType: suggestionError.constructor.name,
          cameraId: camera._id,
          frameSize: frameBase64.length,
          timestamp: new Date().toISOString()
        }
      });
    }

  } catch (error) {
    console.error('Critical error in suggestions (GET):', error);
    res.status(500).json({
      error: 'System error in suggestion generation: ' + error.message,
      timestamp: new Date().toISOString()
    });
  }
});

router.post('/suggestions/:cameraId', async (req, res) => {
  try {
    const { cameraId } = req.params;
    const { image_b64 } = req.body;

    console.log('Processing suggestions request (POST)', { cameraId, frameSize: image_b64?.length || 0 });

    const camera = await Camera.findById(cameraId, req.user.id);
    if (!camera) {
      console.error('Suggestions failed: Camera not found', { cameraId, userId: req.user.id });
      return res.status(404).json({
        error: 'Camera not found or access denied'
      });
    }

    const health = await llavaService.checkOllamaHealth();
    if (!health.healthy || !health.hasLLaVA) {
      console.error('Suggestions failed: LLaVA service unavailable', health);
      return res.status(503).json({
        error: 'LLaVA service is not available. Please ensure Ollama is running and LLaVA model is installed.',
        details: health
      });
    }

    if (!image_b64 || image_b64.length < 1000) {
      console.error('Invalid frame data provided', { frameSize: image_b64?.length || 0 });
      return res.status(400).json({
        error: 'Frame data is too small or empty. Please ensure camera is providing valid frames.',
        frameSize: image_b64?.length || 0
      });
    }

    console.log('Generating suggestions with retry logic', { cameraId, frameSize: image_b64.length });
    const suggestions = await llavaService.generateSuggestionsWithRetry(image_b64);

    console.log('Suggestions generated successfully', { cameraId, suggestionCount: suggestions.length });

    res.json({
      success: true,
      suggestions,
      cameraId: camera._id,
      cameraName: camera.name,
      source: 'llava-model',
      frameSize: image_b64.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Critical error in suggestions (POST):', error);
    res.status(500).json({
      error: 'System error in suggestion generation: ' + error.message,
      errorType: error.constructor.name,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;