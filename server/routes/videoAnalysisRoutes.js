const express = require('express');
const router = express.Router();
const VideoAnalysis = require('../models/VideoAnalysis');
const Camera = require('../models/Camera');
const LiveResult = require('../models/LiveResult');
const llavaService = require('../services/llavaService');
const frameCaptureService = require('../services/frameCaptureService');
const memoryService = require('../services/memoryService');
const { authenticateToken } = require('./middleware/auth');
const { v4: uuidv4 } = require('uuid');

router.use(authenticateToken);

router.post('/stream', async (req, res) => {
  try {
    const { cameraId, prompt, analysisInterval = 30, jsonOption = false, memory = false } = req.body;

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



    const camera = await Camera.findById(cameraId, req.user.id);
    if (!camera) {
      console.error('Stream creation failed: Camera not found', { cameraId, userId: req.user.id });
      return res.status(404).json({
        error: 'Camera not found or access denied'
      });
    }

    // Use camera's memory setting if not explicitly provided
    const useMemory = memory !== undefined ? memory : (camera.memory === 1);

    if (useMemory) {
      console.log(`[VIDEO_ANALYSIS] Memory enabled for stream, will initialize buffer with size ${memoryService.getBufferSize(analysisInterval)}`);

      // Log memory stream start details
              console.log(`[MEMORY_LOGGING] Stream started with memory enabled`);
      console.log(`[MEMORY_LOGGING] Stream ID: ${cameraId}_${Date.now()}`);
      console.log(`[MEMORY_LOGGING] Analysis interval: ${analysisInterval}s`);
      console.log(`[MEMORY_LOGGING] Buffer size: ${memoryService.getBufferSize(analysisInterval)} entries`);
      console.log(`[MEMORY_LOGGING] JSON option: ${jsonOption ? 'enabled' : 'disabled'}`);
              console.log(`[MEMORY_LOGGING] Stream start completed`);
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
      jsonOption,
      memory: useMemory
    });



    res.status(201).json({
      success: true,
      streamId,
      message: 'Video analysis stream started successfully',
      analysisInterval,
      cameraName: camera.name,
      jsonOption,
      memory: useMemory
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
    const { streamId, frameBase64, prompt, jsonOption = false, memory = false } = req.body;

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



    const analysisSession = await VideoAnalysis.findByStreamId(streamId);
    if (!analysisSession || analysisSession.userId !== req.user.id) {
      console.error('Frame analysis failed: Access denied', { streamId, userId: req.user.id });
      return res.status(403).json({
        error: 'Access denied to this analysis stream'
      });
    }

    // Get the latest camera data to check for updated analysisInterval
    const camera = await Camera.findById(analysisSession.cameraId, req.user.id);
    let analysisInterval = Math.max(6, analysisSession.analysisInterval || 30);

    // If camera has been updated with a new interval, use that instead
    if (camera && camera.analysisInterval && camera.analysisInterval !== analysisSession.analysisInterval) {
      console.log('[VIDEO_ANALYSIS] Camera interval updated from', analysisSession.analysisInterval, 'to', camera.analysisInterval);
      analysisInterval = Math.max(6, camera.analysisInterval);

      // Update the analysis session with the new interval for future use
      try {
        await VideoAnalysis.updateInterval(streamId, analysisInterval);

      } catch (updateError) {
        console.error('[VIDEO_ANALYSIS] Failed to update session interval:', updateError.message);
        // Continue with the new interval even if update fails
      }
    }

    // Determine if memory should be used (from request or session)
    const useMemory = memory !== undefined ? memory : (analysisSession.memory === 1);

    let finalPrompt = prompt;

    // CRITICAL: Build memory-enhanced prompt if memory is enabled
    if (useMemory) {
              console.log(`[MEMORY_LOGGING] Frame processing with memory enabled`);
      console.log(`[MEMORY_LOGGING] Stream ID: ${streamId}`);

      // Initialize buffer first to ensure it exists
      memoryService.initializeBuffer(streamId, analysisInterval);

      // Get buffer state before context building
      const bufferBefore = memoryService.getBuffer(streamId);
      const bufferLengthBefore = bufferBefore.length;
      console.log(`[MEMORY_LOGGING] Buffer length before: ${bufferLengthBefore} entries`);

      // Build context prompt with memory (this includes previous answers)
      finalPrompt = memoryService.buildContextPrompt(streamId, prompt);

      // Count context entries used (excluding the header lines)
      const contextLines = finalPrompt.split('\n').filter(line => line.startsWith('- Frame T-'));
      const contextEntriesUsed = Math.max(0, contextLines.length);
      console.log(`[VIDEO_ANALYSIS] Memory enabled, context prompt built with ${contextEntriesUsed} context entries`);

      // Log buffer state after context building
      const bufferAfter = memoryService.getBuffer(streamId);
      const bufferLengthAfter = bufferAfter.length;
      console.log(`[MEMORY_LOGGING] Buffer length after context building: ${bufferLengthAfter} entries`);

      // Log recent buffer entries (truncated, no images)
      if (bufferAfter.length > 0) {
        const recentEntries = bufferAfter.slice(-3).map(entry => ({
          frame: entry.frame,
          description: (entry.canonicalSummary || entry.description || 'No description').substring(0, 50) + ((entry.canonicalSummary || entry.description || '').length > 50 ? '...' : ''),
          timestamp: entry.timestamp
        }));
        console.log(`[MEMORY_LOGGING] Recent buffer entries: ${JSON.stringify(recentEntries, null, 2)}`);
      }
    } else {
      console.log('[VIDEO_ANALYSIS] Memory disabled, using original prompt');
      // When memory is OFF, use exactly the user prompt with no modifications
      finalPrompt = prompt.trim();
    }

    // CRITICAL: Apply JSON formatting instructions if enabled
    if (jsonOption) {
      finalPrompt = `${finalPrompt}

ONLY return your response as a raw JSON object enclosed in curly braces { } without any markdown code blocks, backticks, explanatory text, or formatting. Respond with JSON only.`;
      console.log('JSON option enabled for frame analysis', { streamId });

      // Log JSON instruction for memory-enabled requests
      if (useMemory) {
        console.log(`[MEMORY_LOGGING] JSON instruction appended to memory-enhanced prompt`);
      } else {
        console.log('[VIDEO_ANALYSIS] JSON instruction appended to original prompt');
      }
    }

    try {
      console.log('Sending frame to LLaVA service', { streamId, analysisInterval, memory: useMemory });
      const result = await llavaService.analyzeFrame(frameBase64, finalPrompt, analysisInterval, streamId);

      const resultData = {
        streamId,
        answer: result.answer,
        accuracyScore: result.accuracyScore,
        timestamp: new Date().toISOString(),
        rawJson: result.rawJson
      };

      await VideoAnalysis.createResult(resultData);

      // Store analytics data for the Analytics page
      try {
        const analysisSession = await VideoAnalysis.findByStreamId(streamId);
        if (analysisSession) {
          await LiveResult.create({
            cameraId: analysisSession.cameraId,
            promptId: streamId, // Using streamId as promptId for now
            promptText: analysisSession.prompt,
            success: true,
            confidence: result.accuracyScore || 0.8, // Default confidence if not provided
            meta: {
              streamId,
              analysisInterval,
              memory: useMemory,
              processingTime: result.processingTime,
              answerLength: result.answer?.length || 0
            }
          });
          console.log('[ANALYTICS] LiveResult stored successfully for analytics');
        }
      } catch (analyticsError) {
        console.error('[ANALYTICS] Failed to store LiveResult for analytics:', analyticsError.message);
        // Don't fail the main analysis if analytics storage fails
      }

      // CRITICAL: Store the main analysis result for next frame continuity
      if (useMemory && result.answer && result.answer.trim().length > 0) {
        console.log('[VIDEO_ANALYSIS] Storing main analysis result for next frame continuity');
        memoryService.storePreviousAnswer(streamId, result.answer.trim());
        console.log(`[MEMORY_LOGGING] Main analysis result stored: "${result.answer.substring(0, 100)}${result.answer.length > 100 ? '...' : ''}"`);
      }

      // Update memory buffer with scene description (non-blocking)
      if (useMemory) {
        memoryService.checkNoveltyAndGetSceneDescription(streamId, frameBase64, analysisInterval, prompt)
          .catch(error => {
            console.error(`[VIDEO_ANALYSIS] Memory buffer update failed for stream ${streamId}:`, error.message);
            // Continue without disrupting main analysis
          });
      }

      // Log memory frame processing completion
      if (useMemory) {
        console.log(`[MEMORY_LOGGING] Frame processing completed for stream ${streamId}`);
        console.log(`[MEMORY_LOGGING] Frame processing completed`);
      }

      console.log('Frame analysis completed successfully', {
        streamId,
        answerLength: result.answer?.length,
        processingTime: result.processingTime,
        memory: useMemory
      });

      res.json({
        success: true,
        message: 'Frame analysis completed successfully',
        nextAnalysisIn: analysisInterval,
        timestamp: new Date().toISOString(),
        jsonOption: jsonOption,
        memory: useMemory,
        resultPreview: result.answer,
        debugInfo: {
          answerLength: result.answer?.length || 0,
          accuracyScore: result.accuracyScore,
          processingTime: result.processingTime
        }
      });

    } catch (analysisError) {
      console.error('Frame analysis failed:', analysisError);
      res.status(500).json({
        error: analysisError.message || 'Frame analysis failed'
      });
    }

  } catch (error) {
    console.error('Error processing frame:', error);
    res.status(500).json({
      error: error.message || 'Failed to process frame'
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

// Admin endpoint to control memory logging (development/debugging only)
router.post('/admin/memory-logging', async (req, res) => {
  try {
    const { sampleRate } = req.body;

    if (!sampleRate || typeof sampleRate !== 'number' || sampleRate < 1) {
      return res.status(400).json({
        error: 'Valid sample rate (number >= 1) is required'
      });
    }

    // Set the new sample rate
    memoryService.setLogSampleRate(sampleRate);

    // Get current configuration
    const config = memoryService.getLogConfig();

    res.json({
      success: true,
      message: `Memory logging sample rate updated to ${sampleRate}`,
      config: config
    });

  } catch (error) {
    console.error('Error updating memory logging config:', error);
    res.status(500).json({
      error: error.message || 'Failed to update memory logging configuration'
    });
  }
});

// Admin endpoint to get current memory logging configuration
router.get('/admin/memory-logging', async (req, res) => {
  try {
    const config = memoryService.getLogConfig();

    res.json({
      success: true,
      config: config,
      description: `Currently logging every ${config.sampleRate === 1 ? 'request' : `${config.sampleRate}th request`}`
    });

  } catch (error) {
    console.error('Error getting memory logging config:', error);
    res.status(500).json({
      error: error.message || 'Failed to get memory logging configuration'
    });
  }
});

module.exports = router;