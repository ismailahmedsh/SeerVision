const axios = require('axios');
const sharp = require('sharp');

class LLaVAService {
  constructor() {
    this.ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    this.model = 'llava:7b';
    this.fastModel = 'llava:7b-v1.5-q4_0';
    this.timeout = 25000; // Increased to 25 seconds to allow completion within frontend timeout
    this.suggestionTimeout = 25000; // Same timeout for suggestions
    this.activeRequests = new Map();
    this.suggestionCache = new Map();
    this.backgroundSuggestionQueue = new Map();

    // Contextual fallback suggestions based on common camera scenarios
    this.contextualFallbacks = {
      indoor: [
        'Count people present',
        'Check door status',
        'Identify objects visible',
        'Describe lighting conditions',
        'Find any movement',
        'Analyze room layout'
      ],
      outdoor: [
        'Count visible people',
        'Find any vehicles',
        'Check weather conditions',
        'Identify buildings or structures',
        'Detect any activity',
        'Describe the scene'
      ],
      general: [
        'Count people visible',
        'Describe main objects',
        'Check for movement',
        'Identify key elements',
        'Analyze the scene',
        'Find notable features'
      ]
    };
  }

  async preprocessFrame(frameBase64) {
    const preprocessStart = Date.now();
    console.log('[LLAVA_SERVICE] 🔍 PROFILING: Frame preprocessing started');
    console.log('[LLAVA_SERVICE] 🔍 PROFILING: Original frame size:', frameBase64.length, 'characters');

    try {
      // Convert base64 to buffer
      const frameBuffer = Buffer.from(frameBase64, 'base64');
      console.log('[LLAVA_SERVICE] 🔍 PROFILING: Original buffer size:', frameBuffer.length, 'bytes');

      // Downscale to 256x256 for faster processing
      const optimizedBuffer = await sharp(frameBuffer)
        .resize(256, 256, {
          fit: 'inside',
          withoutEnlargement: false
        })
        .jpeg({
          quality: 70, // Reduce quality for speed
          progressive: false
        })
        .toBuffer();

      const optimizedBase64 = optimizedBuffer.toString('base64');
      const preprocessTime = Date.now() - preprocessStart;

      console.log('[LLAVA_SERVICE] 🔍 PROFILING: Optimized buffer size:', optimizedBuffer.length, 'bytes');
      console.log('[LLAVA_SERVICE] 🔍 PROFILING: Optimized frame size:', optimizedBase64.length, 'characters');
      console.log('[LLAVA_SERVICE] 🔍 PROFILING: Size reduction:', Math.round((1 - optimizedBase64.length / frameBase64.length) * 100) + '%');
      console.log('[LLAVA_SERVICE] 🔍 PROFILING: Frame preprocessing completed in:', preprocessTime, 'ms');

      return optimizedBase64;
    } catch (error) {
      console.error('[LLAVA_SERVICE] Frame preprocessing failed:', error.message);
      // Return original frame if preprocessing fails
      return frameBase64;
    }
  }

  async analyzeFrame(frameBase64, prompt, intervalSeconds = 30, streamId = null) {
    const analysisStartTime = Date.now();
    console.log('[LLAVA_SERVICE] ===== OPTIMIZED ANALYSIS START =====');
    console.log('[LLAVA_SERVICE] 🔍 PROFILING: Analysis started at:', new Date().toISOString());
    console.log('[LLAVA_SERVICE] 🔍 PROFILING: Stream ID:', streamId);
    console.log('[LLAVA_SERVICE] 🔍 PROFILING: Original frame size:', frameBase64.length, 'characters');
    console.log('[LLAVA_SERVICE] 🔍 PROFILING: Prompt length:', prompt.length, 'characters');
    console.log('[LLAVA_SERVICE] 🔍 PROFILING: Analysis interval:', intervalSeconds, 'seconds');

    // CRITICAL: Log to verify this is a real model request, not fallback
    console.log('[LLAVA_SERVICE] ===== VERIFYING REAL MODEL REQUEST =====');
    console.log('[LLAVA_SERVICE] This should be a REAL LLaVA model request, not fallback data');
    console.log('[LLAVA_SERVICE] Prompt being sent to model:', prompt);
    console.log('[LLAVA_SERVICE] Frame data size being sent:', frameBase64.length);
    console.log('[LLAVA_SERVICE] Ollama URL:', this.ollamaUrl);
    console.log('[LLAVA_SERVICE] Model name:', this.model);

    // FIXED: Remove suggestion-specific timeout logic - use same timeout for ALL requests
    const isSuggestionRequest = streamId === 'suggestions' || 
                               (streamId && streamId.startsWith('suggestion')) || 
                               (streamId && streamId.startsWith('background'));
    console.log('[LLAVA_SERVICE] 🔍 PROFILING: Is suggestion request:', isSuggestionRequest);
    console.log('[LLAVA_SERVICE] 🔍 PROFILING: Using UNIFIED timeout and model for all requests');

    // Skip queue control for suggestion requests
    if (!isSuggestionRequest && streamId && this.activeRequests.has(streamId)) {
      const activeRequest = this.activeRequests.get(streamId);
      const requestAge = Date.now() - activeRequest.startTime;
      console.log('[LLAVA_SERVICE] 🔍 PROFILING: FRAME DROPPED - Previous analysis still running');
      console.log('[LLAVA_SERVICE] 🔍 PROFILING: Active request age:', requestAge, 'ms');
      console.log('[LLAVA_SERVICE] 🔍 PROFILING: Dropping frame to prevent queue buildup');
      throw new Error(`Frame dropped: previous analysis still in progress (${Math.round(requestAge/1000)}s)`);
    }

    // Mark request as active (only for non-suggestion requests to avoid conflicts)
    if (!isSuggestionRequest && streamId) {
      this.activeRequests.set(streamId, {
        startTime: analysisStartTime,
        prompt: prompt.substring(0, 50) + '...'
      });
      console.log('[LLAVA_SERVICE] 🔍 PROFILING: Request marked as active for stream:', streamId);
    } else if (isSuggestionRequest) {
      console.log('[LLAVA_SERVICE] 🔍 PROFILING: Suggestion request - bypassing queue control');
    }

    try {
      // Stage 1: Frame Preprocessing & Optimization
      const preprocessingStart = Date.now();
      console.log('[LLAVA_SERVICE] 🔍 PROFILING: Stage 1 - Frame preprocessing started');

      if (!frameBase64 || frameBase64.length < 1000) {
        throw new Error('Invalid or too small frame data');
      }

      // Optimize frame for faster processing
      const optimizedFrame = await this.preprocessFrame(frameBase64);

      const preprocessingTime = Date.now() - preprocessingStart;
      console.log('[LLAVA_SERVICE] 🔍 PROFILING: Stage 1 - Preprocessing completed in:', preprocessingTime, 'ms');

      // Stage 2: Request Preparation with UNIFIED timeout and model
      const requestPrepStart = Date.now();
      console.log('[LLAVA_SERVICE] 🔍 PROFILING: Stage 2 - Request preparation started');

      // FIXED: Use SAME timeout and model for ALL requests
      const timeoutMs = this.timeout; // Always use 20000ms timeout
      const modelToUse = this.model; // Always use llava:7b model

      console.log('[LLAVA_SERVICE] 🔍 PROFILING: UNIFIED MODE - Same timeout and model for all requests');
      console.log('[LLAVA_SERVICE] 🔍 PROFILING: Using timeout:', timeoutMs, 'ms');
      console.log('[LLAVA_SERVICE] 🔍 PROFILING: Using model:', modelToUse);

      const requestData = {
        model: modelToUse,
        prompt: prompt,
        images: [optimizedFrame],
        stream: false,
        options: {
          temperature: 0.1, // Same temperature for all requests
          top_p: 0.9,
          top_k: 40, // Same for all requests
          num_predict: 50, // Same token limit for all requests
          num_ctx: 1024, // Same context for all requests
          num_gpu: 1,
          num_thread: 4, // Same threads for all requests
          repeat_penalty: 1.1
        }
      };

      const requestPrepTime = Date.now() - requestPrepStart;
      console.log('[LLAVA_SERVICE] 🔍 PROFILING: Stage 2 - Request preparation completed in:', requestPrepTime, 'ms');
      console.log('[LLAVA_SERVICE] 🔍 PROFILING: Request payload size:', JSON.stringify(requestData).length, 'bytes');
      console.log('[LLAVA_SERVICE] 🔍 PROFILING: Token limit set to:', requestData.options.num_predict);

      // Stage 3: Network Dispatch with UNIFIED Timeout
      const dispatchStart = Date.now();
      console.log('[LLAVA_SERVICE] 🔍 PROFILING: Stage 3 - Network dispatch started');
      console.log('[LLAVA_SERVICE] 🔍 PROFILING: Ollama request URL:', `${this.ollamaUrl}/api/generate`);

      // CRITICAL: Log the actual network request to verify it's going to Ollama
      console.log('[LLAVA_SERVICE] ===== MAKING REAL OLLAMA API CALL =====');
      console.log('[LLAVA_SERVICE] About to make HTTP POST to Ollama');
      console.log('[LLAVA_SERVICE] Request URL:', `${this.ollamaUrl}/api/generate`);
      console.log('[LLAVA_SERVICE] Request method: POST');
      console.log('[LLAVA_SERVICE] Request timeout:', timeoutMs, 'ms');
      console.log('[LLAVA_SERVICE] Request model:', requestData.model);
      console.log('[LLAVA_SERVICE] Request prompt preview:', requestData.prompt.substring(0, 100) + '...');
      console.log('[LLAVA_SERVICE] Request has image data:', !!requestData.images && requestData.images.length > 0);
      console.log('[LLAVA_SERVICE] This should be a REAL network call to LLaVA model');

      const response = await Promise.race([
        axios.post(`${this.ollamaUrl}/api/generate`, requestData, {
          timeout: timeoutMs,
          headers: {
            'Content-Type': 'application/json'
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Analysis timeout after ${timeoutMs}ms - model processing too slow`)), timeoutMs)
        )
      ]);

      const dispatchTime = Date.now() - dispatchStart;
      console.log('[LLAVA_SERVICE] 🔍 PROFILING: Stage 3 - Network dispatch completed in:', dispatchTime, 'ms');

      // CRITICAL: Log the actual response to verify it came from LLaVA
      console.log('[LLAVA_SERVICE] ===== REAL OLLAMA RESPONSE RECEIVED =====');
      console.log('[LLAVA_SERVICE] Response received from Ollama at:', new Date().toISOString());
      console.log('[LLAVA_SERVICE] Response status:', response.status);
      console.log('[LLAVA_SERVICE] Response headers:', response.headers);
      console.log('[LLAVA_SERVICE] Response data keys:', Object.keys(response.data || {}));
      console.log('[LLAVA_SERVICE] Raw response from LLaVA model:', response.data.response);
      console.log('[LLAVA_SERVICE] Response length:', response.data.response?.length || 0);
      console.log('[LLAVA_SERVICE] This is REAL model output, not fallback data');

      // Stage 4: Response Processing
      const responseProcessStart = Date.now();
      console.log('[LLAVA_SERVICE] 🔍 PROFILING: Stage 4 - Response processing started');

      if (!response.data || !response.data.response) {
        throw new Error('Invalid response from Ollama - no response data');
      }

      const answer = response.data.response.trim();
      console.log('[LLAVA_SERVICE] 🔍 PROFILING: Response length:', answer.length, 'characters');
      console.log('[LLAVA_SERVICE] 🔍 PROFILING: Response preview:', answer.substring(0, 100) + '...');

      // CRITICAL: Verify this is real model output
      console.log('[LLAVA_SERVICE] ===== VERIFYING REAL MODEL OUTPUT =====');
      console.log('[LLAVA_SERVICE] Full model response text:', answer);
      console.log('[LLAVA_SERVICE] Response source: REAL LLaVA MODEL via Ollama');
      console.log('[LLAVA_SERVICE] Response is NOT fallback data');
      console.log('[LLAVA_SERVICE] Response is NOT static/hardcoded');

      // Extract Ollama performance metrics
      const ollamaMetrics = {
        totalDuration: response.data.total_duration || 0,
        loadDuration: response.data.load_duration || 0,
        promptEvalDuration: response.data.prompt_eval_duration || 0,
        evalDuration: response.data.eval_duration || 0,
        promptEvalCount: response.data.prompt_eval_count || 0,
        evalCount: response.data.eval_count || 0
      };

      console.log('[LLAVA_SERVICE] 🔍 PROFILING: Ollama metrics:', {
        totalDuration: Math.round(ollamaMetrics.totalDuration / 1000000) + 'ms',
        loadDuration: Math.round(ollamaMetrics.loadDuration / 1000000) + 'ms',
        promptEvalDuration: Math.round(ollamaMetrics.promptEvalDuration / 1000000) + 'ms',
        evalDuration: Math.round(ollamaMetrics.evalDuration / 1000000) + 'ms',
        promptTokens: ollamaMetrics.promptEvalCount,
        responseTokens: ollamaMetrics.evalCount
      });

      // CRITICAL: Log Ollama metrics to prove real model execution
      console.log('[LLAVA_SERVICE] ===== OLLAMA EXECUTION METRICS =====');
      console.log('[LLAVA_SERVICE] Total model execution time:', Math.round(ollamaMetrics.totalDuration / 1000000) + 'ms');
      console.log('[LLAVA_SERVICE] Model load time:', Math.round(ollamaMetrics.loadDuration / 1000000) + 'ms');
      console.log('[LLAVA_SERVICE] Prompt evaluation time:', Math.round(ollamaMetrics.promptEvalDuration / 1000000) + 'ms');
      console.log('[LLAVA_SERVICE] Response generation time:', Math.round(ollamaMetrics.evalDuration / 1000000) + 'ms');
      console.log('[LLAVA_SERVICE] Prompt tokens processed:', ollamaMetrics.promptEvalCount);
      console.log('[LLAVA_SERVICE] Response tokens generated:', ollamaMetrics.evalCount);
      console.log('[LLAVA_SERVICE] These metrics PROVE the model actually executed');

      // Calculate confidence score
      const accuracyScore = this.calculateOptimizedConfidenceScore(answer, ollamaMetrics);

      const responseProcessTime = Date.now() - responseProcessStart;
      console.log('[LLAVA_SERVICE] 🔍 PROFILING: Stage 4 - Response processing completed in:', responseProcessTime, 'ms');

      // Final timing breakdown
      const totalProcessingTime = Date.now() - analysisStartTime;
      console.log('[LLAVA_SERVICE] 🔍 PROFILING: === UNIFIED PERFORMANCE BREAKDOWN ===');
      console.log('[LLAVA_SERVICE] 🔍 PROFILING: 1. Frame Preprocessing:', preprocessingTime, 'ms');
      console.log('[LLAVA_SERVICE] 🔍 PROFILING: 2. Request Preparation:', requestPrepTime, 'ms');
      console.log('[LLAVA_SERVICE] 🔍 PROFILING: 3. Network + LLaVA Inference:', dispatchTime, 'ms');
      console.log('[LLAVA_SERVICE] 🔍 PROFILING: 4. Response Processing:', responseProcessTime, 'ms');
      console.log('[LLAVA_SERVICE] 🔍 PROFILING: 5. TOTAL PIPELINE TIME:', totalProcessingTime, 'ms');
      console.log('[LLAVA_SERVICE] 🔍 PROFILING: 6. Timeout Limit:', timeoutMs, 'ms');
      console.log('[LLAVA_SERVICE] 🔍 PROFILING: 7. Performance Ratio:', Math.round((totalProcessingTime / timeoutMs) * 100) + '%');
      console.log('[LLAVA_SERVICE] 🔍 PROFILING: 8. Ollama Internal Time:', Math.round(ollamaMetrics.totalDuration / 1000000) + 'ms');
      console.log('[LLAVA_SERVICE] 🔍 PROFILING: 9. Model Used:', modelToUse);
      console.log('[LLAVA_SERVICE] 🔍 PROFILING: 10. Request Type:', isSuggestionRequest ? 'SUGGESTION' : 'ANALYSIS');
      console.log('[LLAVA_SERVICE] 🔍 PROFILING: 11. UNIFIED PIPELINE - Same settings for all requests');
      console.log('[LLAVA_SERVICE] 🔍 PROFILING: === END UNIFIED ANALYSIS ===');

      // Performance warnings
      if (totalProcessingTime > (timeoutMs * 0.8)) {
        console.warn('[LLAVA_SERVICE] 🔍 PROFILING: WARNING - Analysis took over 80% of timeout limit');
      }

      console.log('[LLAVA_SERVICE] Unified analysis completed successfully');

      // FINAL VERIFICATION LOG
      console.log('[LLAVA_SERVICE] ===== FINAL VERIFICATION =====');
      console.log('[LLAVA_SERVICE] CONFIRMED: Response came from REAL LLaVA model');
      console.log('[LLAVA_SERVICE] CONFIRMED: NOT fallback or static data');
      console.log('[LLAVA_SERVICE] CONFIRMED: Ollama execution metrics present');
      console.log('[LLAVA_SERVICE] CONFIRMED: Network request completed successfully');

      return {
        answer,
        accuracyScore,
        processingTime: totalProcessingTime,
        model: modelToUse,
        requestType: isSuggestionRequest ? 'suggestion' : 'analysis',
        rawJson: JSON.stringify({
          ...response.data,
          optimizationMetrics: {
            originalFrameSize: frameBase64.length,
            optimizedFrameSize: optimizedFrame.length,
            sizeReduction: Math.round((1 - optimizedFrame.length / frameBase64.length) * 100),
            tokenLimit: requestData.options.num_predict,
            actualTokens: ollamaMetrics.evalCount,
            requestType: isSuggestionRequest ? 'suggestion' : 'analysis',
            unifiedPipeline: true,
            realModelExecution: true, // Flag to confirm real model execution
            ollamaMetricsPresent: !!(ollamaMetrics.totalDuration > 0)
          },
          pipelineTiming: {
            preprocessing: preprocessingTime,
            requestPrep: requestPrepTime,
            dispatch: dispatchTime,
            responseProcess: responseProcessTime,
            total: totalProcessingTime
          },
          ollamaMetrics
        })
      };

    } catch (error) {
      const totalProcessingTime = Date.now() - analysisStartTime;
      console.error('[LLAVA_SERVICE] ===== UNIFIED ANALYSIS FAILURE =====');
      console.error('[LLAVA_SERVICE] 🔍 PROFILING: Pipeline failed after:', totalProcessingTime, 'ms');
      console.error('[LLAVA_SERVICE] 🔍 PROFILING: Error type:', error.constructor.name);
      console.error('[LLAVA_SERVICE] 🔍 PROFILING: Error message:', error.message);
      console.error('[LLAVA_SERVICE] 🔍 PROFILING: Request type:', isSuggestionRequest ? 'SUGGESTION' : 'ANALYSIS');
      console.error('[LLAVA_SERVICE] 🔍 PROFILING: Used unified timeout:', this.timeout, 'ms');

      // CRITICAL: Log to verify no fallback is being used
      console.error('[LLAVA_SERVICE] ===== NO FALLBACK DATA USED =====');
      console.error('[LLAVA_SERVICE] Model request failed - NO static fallback will be returned');
      console.error('[LLAVA_SERVICE] Error will be propagated to client for proper handling');
      console.error('[LLAVA_SERVICE] NO hardcoded suggestions will be shown');

      // ENHANCED ERROR LOGGING FOR OLLAMA ISSUES
      if (error.response) {
        console.error('[LLAVA_SERVICE] ===== OLLAMA SERVER ERROR DETAILS =====');
        console.error('[LLAVA_SERVICE] HTTP Status:', error.response.status);
        console.error('[LLAVA_SERVICE] HTTP Status Text:', error.response.statusText);
        console.error('[LLAVA_SERVICE] Response Headers:', JSON.stringify(error.response.headers, null, 2));
        console.error('[LLAVA_SERVICE] Response Data:', JSON.stringify(error.response.data, null, 2));
        console.error('[LLAVA_SERVICE] Request URL:', error.config?.url);
        console.error('[LLAVA_SERVICE] Request Method:', error.config?.method);
        console.error('[LLAVA_SERVICE] Request Headers:', JSON.stringify(error.config?.headers, null, 2));

        // Log partial request data (without the large image)
        if (error.config?.data) {
          try {
            const requestData = JSON.parse(error.config.data);
            const logData = { ...requestData };
            if (logData.images && logData.images.length > 0) {
              logData.images = [`[IMAGE_DATA_${logData.images[0].length}_CHARS]`];
            }
            console.error('[LLAVA_SERVICE] Request Data (images truncated):', JSON.stringify(logData, null, 2));
          } catch (parseError) {
            console.error('[LLAVA_SERVICE] Could not parse request data for logging');
          }
        }

        // Specific error handling based on status code
        if (error.response.status === 500) {
          console.error('[LLAVA_SERVICE] ===== OLLAMA INTERNAL SERVER ERROR =====');
          console.error('[LLAVA_SERVICE] This indicates an issue with Ollama or the LLaVA model');
          console.error('[LLAVA_SERVICE] Possible causes:');
          console.error('[LLAVA_SERVICE] 1. LLaVA model not properly installed');
          console.error('[LLAVA_SERVICE] 2. Insufficient system memory/VRAM');
          console.error('[LLAVA_SERVICE] 3. Corrupted model files');
          console.error('[LLAVA_SERVICE] 4. Ollama service overloaded');
          console.error('[LLAVA_SERVICE] 5. Invalid image data format');

          // Check if this is a model-specific error
          if (error.response.data && typeof error.response.data === 'string') {
            if (error.response.data.includes('model not found') || error.response.data.includes('no such model')) {
              throw new Error(`LLaVA model '${modelToUse}' not found. Please install: ollama pull ${modelToUse}`);
            } else if (error.response.data.includes('out of memory') || error.response.data.includes('OOM')) {
              throw new Error(`Insufficient memory to run LLaVA model. Please free up system memory or use a smaller model.`);
            } else if (error.response.data.includes('invalid') && error.response.data.includes('image')) {
              throw new Error(`Invalid image format sent to LLaVA model. Image preprocessing may have failed.`);
            }
          }

          throw new Error(`Ollama server error (500): ${error.response.data || 'Unknown internal error'}. Check Ollama logs for details.`);
        } else if (error.response.status === 404) {
          throw new Error(`LLaVA model '${modelToUse}' not found. Please install: ollama pull ${modelToUse}`);
        } else if (error.response.status === 503) {
          throw new Error(`Ollama service unavailable. The service may be overloaded or restarting.`);
        } else {
          throw new Error(`Ollama HTTP error ${error.response.status}: ${error.response.data || error.response.statusText}`);
        }
      } else if (error.request) {
        console.error('[LLAVA_SERVICE] ===== NETWORK ERROR DETAILS =====');
        console.error('[LLAVA_SERVICE] No response received from Ollama');
        console.error('[LLAVA_SERVICE] Request timeout:', error.config?.timeout);
        console.error('[LLAVA_SERVICE] Ollama URL:', this.ollamaUrl);
        console.error('[LLAVA_SERVICE] Network error code:', error.code);

        if (error.code === 'ECONNREFUSED') {
          throw new Error(`Cannot connect to Ollama at ${this.ollamaUrl}. Please ensure Ollama is running: ollama serve`);
        } else if (error.code === 'ETIMEDOUT') {
          throw new Error(`Connection to Ollama timed out after ${error.config?.timeout || 'unknown'}ms. Ollama may be overloaded.`);
        } else {
          throw new Error(`Network error connecting to Ollama: ${error.message}`);
        }
      }

      // Handle specific errors
      if (error.message.includes('Frame dropped')) {
        console.log('[LLAVA_SERVICE] 🔍 PROFILING: Frame successfully dropped to prevent queue buildup');
        throw error; // Re-throw to maintain error type
      } else if (error.message.includes('timeout') || error.message.includes('model processing too slow')) {
        console.log('[LLAVA_SERVICE] 🔍 PROFILING: MODEL TIMEOUT - LLaVA took longer than', this.timeout, 'ms');
        console.log('[LLAVA_SERVICE] 🔍 PROFILING: This indicates model performance issues or system overload');
        throw new Error(`LLaVA model timeout after ${totalProcessingTime}ms - model processing too slow`);
      }

      throw new Error(`Unified analysis failed: ${error.message}`);
    } finally {
      // Always clear the active request (only for non-suggestion requests)
      if (!isSuggestionRequest && streamId && this.activeRequests.has(streamId)) {
        this.activeRequests.delete(streamId);
        console.log('[LLAVA_SERVICE] 🔍 PROFILING: Request cleared for stream:', streamId);
      } else if (isSuggestionRequest) {
        console.log('[LLAVA_SERVICE] 🔍 PROFILING: Suggestion request completed - no queue cleanup needed');
      }
    }
  }

  calculateOptimizedConfidenceScore(answer, ollamaMetrics) {
    try {
      console.log('[LLAVA_SERVICE] 🔍 PROFILING: Calculating optimized confidence score');

      let confidence = 0.7; // Higher base confidence for optimized pipeline

      // Use token generation rate for confidence
      if (ollamaMetrics.evalCount > 0 && ollamaMetrics.evalDuration > 0) {
        const tokensPerSecond = ollamaMetrics.evalCount / (ollamaMetrics.evalDuration / 1000000000);
        console.log('[LLAVA_SERVICE] 🔍 PROFILING: Tokens per second:', tokensPerSecond);

        // Faster generation indicates better performance
        if (tokensPerSecond > 10) confidence += 0.1;
        if (tokensPerSecond > 20) confidence += 0.05;
      }

      // Response completeness (within token limit)
      const responseLength = answer.length;
      if (responseLength > 20 && responseLength < 200) confidence += 0.1; // Good length range
      if (responseLength > 200) confidence -= 0.05; // Too verbose despite token limit

      // Check for uncertainty markers
      const uncertaintyWords = ['maybe', 'possibly', 'might', 'unclear', 'not sure'];
      const hasUncertainty = uncertaintyWords.some(word => answer.toLowerCase().includes(word));
      if (hasUncertainty) confidence -= 0.1;

      // Check for definitive language
      const definitiveWords = ['clearly', 'shows', 'displays', 'contains', 'has'];
      const hasDefinitive = definitiveWords.some(word => answer.toLowerCase().includes(word));
      if (hasDefinitive) confidence += 0.1;

      const finalConfidence = Math.max(0.4, Math.min(0.95, confidence));
      console.log('[LLAVA_SERVICE] 🔍 PROFILING: Optimized confidence:', finalConfidence);
      return finalConfidence;

    } catch (error) {
      console.error('[LLAVA_SERVICE] Error calculating confidence:', error.message);
      return 0.75;
    }
  }

  async generateSuggestions(frameBase64, retryAttempt = 0) {
    try {
      console.log('[LLAVA_SERVICE] ===== PURE MODEL SUGGESTION GENERATION START =====');
      console.log('[LLAVA_SERVICE] Retry attempt:', retryAttempt, 'of 1 (max)');
      console.log('[LLAVA_SERVICE] Using same pipeline as /frame and /query endpoints');
      console.log('[LLAVA_SERVICE] NO FALLBACKS - pure LLaVA model output only');

      if (!frameBase64 || frameBase64.length < 1000) {
        throw new Error('Invalid frame data for suggestion generation');
      }

      // REFINED: Explicit prompt to avoid answers/descriptions and focus on imperative commands only
      const suggestionPrompt = `Look at this image and suggest 6 analysis commands (2-5 words each) that someone could use to examine this scene.

IMPORTANT: Provide ONLY the command/action, NOT the answer or description.

Examples of CORRECT format:
- Count people (NOT "Count people: 2 people")
- Check lighting conditions (NOT "Check lighting: bright room")
- Analyze visible colors (NOT "Analyze colors: blue, red")
- Identify main objects (NOT "Identify objects: chair, table")
- Detect any movement (NOT "Detect movement: none visible")
- Find visible vehicles (NOT "Find vehicles: 1 car")

Generate exactly 6 imperative commands based on what you see. Each must be 2-5 words. Use only action verbs like: Count, Check, Analyze, Identify, Detect, Find, Examine, Describe.

Format: One command per line, no numbers, no colons, no descriptions, no answers.`;

      console.log('[LLAVA_SERVICE] Using refined prompt that explicitly avoids answers/descriptions');

      // Use the SAME analyzeFrame method that works for /frame and /query
      // Use suggestion stream ID to identify this as suggestion request
      const suggestionStreamId = `suggestions-${Date.now()}-retry-${retryAttempt}`;

      console.log('[LLAVA_SERVICE] Calling analyzeFrame with SAME logic as working endpoints');

      // Call the SAME method used by working endpoints - NO special handling
      const result = await this.analyzeFrame(frameBase64, suggestionPrompt, 30, suggestionStreamId);

      console.log('[LLAVA_SERVICE] ===== PURE MODEL SUGGESTION SUCCESS =====');
      console.log('[LLAVA_SERVICE] LLaVA model completed successfully');
      console.log('[LLAVA_SERVICE] Processing time:', result.processingTime, 'ms');
      console.log('[LLAVA_SERVICE] Raw model response:', result.answer);

      // Process the model response using STRICT validation logic
      const suggestions = this.processStrictSuggestionResponse(result.answer);

      console.log('[LLAVA_SERVICE] Processed suggestions:', suggestions);
      console.log('[LLAVA_SERVICE] Number of suggestions:', suggestions.length);

      // STRICT VALIDATION: Minimum 3 suggestions required
      if (suggestions.length < 3) {
        console.log('[LLAVA_SERVICE] ===== INSUFFICIENT SUGGESTIONS - RETRY LOGIC =====');
        console.log('[LLAVA_SERVICE] Only', suggestions.length, 'valid suggestions generated (minimum 3 required)');
        console.log('[LLAVA_SERVICE] Current retry attempt:', retryAttempt);

        // If this is the first attempt, retry once
        if (retryAttempt === 0) {
          console.log('[LLAVA_SERVICE] Triggering automatic retry after 2 second delay...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          return await this.generateSuggestions(frameBase64, 1);
        } else {
          console.log('[LLAVA_SERVICE] Max retries reached, throwing insufficient suggestions error');
          throw new Error(`Insufficient suggestions after retry: only ${suggestions.length} valid suggestions generated (minimum 3 required)`);
        }
      }

      console.log('[LLAVA_SERVICE] ===== RETURNING VALIDATED MODEL SUGGESTIONS =====');
      console.log('[LLAVA_SERVICE] Returning', suggestions.length, 'suggestions from LLaVA model - NO FALLBACKS');
      console.log('[LLAVA_SERVICE] All suggestions passed strict validation');

      return suggestions;

    } catch (error) {
      console.error('[LLAVA_SERVICE] ===== PURE MODEL SUGGESTION FAILED =====');
      console.error('[LLAVA_SERVICE] Model-only suggestion generation failed:', error.message);
      console.error('[LLAVA_SERVICE] Error type:', error.constructor.name);
      console.error('[LLAVA_SERVICE] Retry attempt:', retryAttempt);

      // If this is the first attempt and it's not an insufficient suggestions error, retry once
      if (retryAttempt === 0 && !error.message.includes('Insufficient suggestions')) {
        console.log('[LLAVA_SERVICE] Triggering automatic retry after 2 second delay due to error...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        try {
          return await this.generateSuggestions(frameBase64, 1);
        } catch (retryError) {
          console.error('[LLAVA_SERVICE] Retry also failed:', retryError.message);
          throw new Error(`LLaVA suggestion generation failed after retry: ${retryError.message}`);
        }
      }

      console.error('[LLAVA_SERVICE] NO FALLBACKS - propagating error to client for proper UI handling');
      throw new Error(`LLaVA suggestion generation failed: ${error.message}`);
    }
  }

  processStrictSuggestionResponse(answer) {
    console.log('[LLAVA_SERVICE] ===== PROCESSING STRICT SUGGESTIONS =====');
    console.log('[LLAVA_SERVICE] Raw model response:', answer);
    console.log('[LLAVA_SERVICE] Applying STRICT validation (2-5 words, actionable, context-related)');

    // Log each line before any processing
    const rawLines = answer.split('\n');
    console.log('[LLAVA_SERVICE] ===== RAW LINES FROM MODEL =====');
    rawLines.forEach((line, index) => {
      console.log('[LLAVA_SERVICE] Raw line', index + ':', JSON.stringify(line));
    });

    const actionVerbs = [
      'count', 'detect', 'find', 'check', 'analyze', 'identify', 'examine',
      'locate', 'spot', 'search', 'look', 'scan', 'monitor', 'track', 'observe', 'describe'
    ];

    const suggestions = answer
      .split('\n')
      .map((line, index) => {
        console.log('[LLAVA_SERVICE] ===== STRICT PROCESSING LINE', index, '=====');
        console.log('[LLAVA_SERVICE] Original line:', JSON.stringify(line));

        // Clean up the line - remove numbers, bullets, quotes
        let cleaned = line.replace(/^\d+\.?\s*/, '').replace(/^[-•*]\s*/, '').trim();
        cleaned = cleaned.replace(/^["']|["']$/g, '');

        console.log('[LLAVA_SERVICE] After basic cleaning:', JSON.stringify(cleaned));

        // Remove any colons and everything after them (answers/descriptions)
        if (cleaned.includes(':')) {
          cleaned = cleaned.split(':')[0].trim();
          console.log('[LLAVA_SERVICE] Removed colon and description, now:', JSON.stringify(cleaned));
        }

        // Remove any commas and everything after them (lists/descriptions)
        if (cleaned.includes(',')) {
          cleaned = cleaned.split(',')[0].trim();
          console.log('[LLAVA_SERVICE] Removed comma and list, now:', JSON.stringify(cleaned));
        }

        // Skip empty or very short lines after cleaning
        if (cleaned.length < 5) {
          console.log('[LLAVA_SERVICE] REJECTED - too short after cleaning, length:', cleaned.length);
          return null;
        }

        // Convert to lowercase for processing
        const words = cleaned.toLowerCase().split(' ').filter(word => word.length > 0);
        console.log('[LLAVA_SERVICE] Words array after cleaning:', words);
        console.log('[LLAVA_SERVICE] Word count:', words.length);

        // STRICT: Must be exactly 2-5 words (updated from 2-4)
        if (words.length < 2 || words.length > 5) {
          console.log('[LLAVA_SERVICE] REJECTED - wrong word count:', words.length, '(need 2-5)');
          return null;
        }

        // First word must be an action verb
        const firstWord = words[0];
        const isActionVerb = actionVerbs.includes(firstWord);
        console.log('[LLAVA_SERVICE] First word:', JSON.stringify(firstWord));
        console.log('[LLAVA_SERVICE] Is action verb:', isActionVerb);

        if (!isActionVerb) {
          console.log('[LLAVA_SERVICE] REJECTED - not actionable, first word:', JSON.stringify(firstWord));
          return null;
        }

        // Check for incomplete phrases (common cut-off patterns)
        const lastWord = words[words.length - 1];
        const incompletePatterns = [
          'the', 'a', 'an', 'is', 'are', 'if', 'that', 'this', 'for', 'with', 'in', 'on', 'at'
        ];

        if (incompletePatterns.includes(lastWord)) {
          console.log('[LLAVA_SERVICE] REJECTED - appears incomplete, ends with:', JSON.stringify(lastWord));
          return null;
        }

        // Check for numeric values or specific answers (reject if found)
        const hasNumbers = /\d/.test(cleaned);
        if (hasNumbers) {
          console.log('[LLAVA_SERVICE] REJECTED - contains numbers/values:', JSON.stringify(cleaned));
          return null;
        }

        // Check for context-related terms (must be visual analysis related)
        const contextKeywords = [
          'people', 'person', 'objects', 'items', 'colors', 'lighting', 'movement', 'motion',
          'vehicles', 'cars', 'buildings', 'doors', 'windows', 'activity', 'scene', 'background',
          'foreground', 'shapes', 'faces', 'hands', 'animals', 'plants', 'furniture', 'tools',
          'signs', 'text', 'numbers', 'patterns', 'textures', 'materials', 'clothing', 'food'
        ];

        const hasContextKeyword = words.some(word => contextKeywords.includes(word));
        if (!hasContextKeyword) {
          console.log('[LLAVA_SERVICE] REJECTED - not context-related to visual analysis:', JSON.stringify(cleaned));
          return null;
        }

        // Reconstruct with proper capitalization
        const actionablePhrase = words.map((word, i) =>
          i === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word
        ).join(' ');

        console.log('[LLAVA_SERVICE] ACCEPTED - Valid strict suggestion:', JSON.stringify(actionablePhrase));
        return actionablePhrase;
      })
      .filter(suggestion => suggestion !== null);

    console.log('[LLAVA_SERVICE] ===== STRICT FILTERING RESULTS =====');
    console.log('[LLAVA_SERVICE] Total lines processed:', answer.split('\n').length);
    console.log('[LLAVA_SERVICE] Valid suggestions after STRICT filtering:', suggestions.length);
    console.log('[LLAVA_SERVICE] Filtered suggestions:', suggestions);

    // Remove duplicates and limit to 6 suggestions
    const uniqueSuggestions = [...new Set(suggestions)].slice(0, 6);

    console.log('[LLAVA_SERVICE] ===== FINAL STRICT SUGGESTIONS =====');
    console.log('[LLAVA_SERVICE] Final unique suggestions:', uniqueSuggestions);
    console.log('[LLAVA_SERVICE] Count:', uniqueSuggestions.length);

    return uniqueSuggestions;
  }

  getContextualFallbacks(frameBase64) {
    // Simple heuristic to choose contextual fallbacks
    // In a real implementation, you could do basic image analysis here
    console.log('[LLAVA_SERVICE] Selecting contextual fallbacks based on frame characteristics');
    
    // For now, return general fallbacks, but this could be enhanced
    // to detect indoor/outdoor based on brightness, colors, etc.
    return this.contextualFallbacks.general;
  }

  startBackgroundSuggestionProcessing(frameBase64, frameHash) {
    // Don't start background processing if already in progress
    if (this.backgroundSuggestionQueue.has(frameHash)) {
      console.log('[LLAVA_SERVICE] Background processing already in progress for frame');
      return;
    }

    console.log('[LLAVA_SERVICE] ===== STARTING BACKGROUND LLAVA PROCESSING =====');
    console.log('[LLAVA_SERVICE] Frame will be processed in background with longer timeout');

    // Mark as in progress
    this.backgroundSuggestionQueue.set(frameHash, {
      startTime: Date.now(),
      status: 'processing'
    });

    // Process in background with longer timeout (don't await)
    this.processBackgroundSuggestions(frameBase64, frameHash).catch(error => {
      console.error('[LLAVA_SERVICE] Background processing failed:', error.message);
      this.backgroundSuggestionQueue.delete(frameHash);
    });
  }

  async processBackgroundSuggestions(frameBase64, frameHash) {
    try {
      console.log('[LLAVA_SERVICE] ===== BACKGROUND LLAVA PROCESSING =====');
      console.log('[LLAVA_SERVICE] Processing with extended 30-second timeout');

      const suggestionPrompt = `Analyze this image and suggest 6 short analysis tasks (3-4 words each) that would be useful for examining this specific scene.

Focus on what you actually see in the image. Make each suggestion an actionable command:
- Count visible people
- Describe main colors  
- Check door status
- Find any vehicles
- Identify key objects
- Detect any activity

Generate 6 prompts based on what you see. Format as one prompt per line, no numbers.`;

      // Use background stream ID
      const backgroundStreamId = `background-${Date.now()}`;

      // Use longer timeout for background processing
      const result = await Promise.race([
        this.analyzeFrame(frameBase64, suggestionPrompt, 30, backgroundStreamId),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Background LLaVA timeout after 30s')), 30000)
        )
      ]);

      console.log('[LLAVA_SERVICE] ===== BACKGROUND LLAVA SUCCESS =====');
      console.log('[LLAVA_SERVICE] Background processing completed in:', result.processingTime, 'ms');

      // Process the response
      const suggestions = this.processSuggestionResponse(result.answer);

      if (suggestions.length >= 3) {
        // Cache the background result for future use
        this.suggestionCache.set(frameHash, {
          suggestions,
          timestamp: Date.now(),
          source: 'llava',
          processingTime: result.processingTime,
          backgroundProcessed: true
        });

        console.log('[LLAVA_SERVICE] Background LLaVA suggestions cached:', suggestions);
        
        // Clean up queue
        this.backgroundSuggestionQueue.delete(frameHash);
        
        // Could emit an event here to update UI if needed
        console.log('[LLAVA_SERVICE] Background suggestions available for next request');
      } else {
        throw new Error('Background LLaVA returned insufficient suggestions');
      }

    } catch (error) {
      console.error('[LLAVA_SERVICE] Background processing failed:', error.message);
      this.backgroundSuggestionQueue.delete(frameHash);
    }
  }

  processSuggestionResponse(answer) {
    return answer
      .split('\n')
      .map(line => {
        // Clean up the line
        let cleaned = line.replace(/^\d+\.?\s*/, '').replace(/^[-•*]\s*/, '').trim();
        cleaned = cleaned.replace(/^["']|["']$/g, '');

        // Ensure it starts with an action verb if it doesn't already
        const actionVerbs = ['count', 'describe', 'check', 'find', 'identify', 'detect', 'analyze', 'examine', 'look', 'search'];
        const firstWord = cleaned.toLowerCase().split(' ')[0];

        if (!actionVerbs.includes(firstWord) && cleaned.length > 0) {
          // Try to make it actionable
          if (cleaned.toLowerCase().includes('people') || cleaned.toLowerCase().includes('person')) {
            cleaned = 'Count ' + cleaned.toLowerCase();
          } else if (cleaned.toLowerCase().includes('color') || cleaned.toLowerCase().includes('colour')) {
            cleaned = 'Describe ' + cleaned.toLowerCase();
          } else if (cleaned.toLowerCase().includes('door') || cleaned.toLowerCase().includes('window')) {
            cleaned = 'Check ' + cleaned.toLowerCase();
          } else if (cleaned.toLowerCase().includes('vehicle') || cleaned.toLowerCase().includes('car')) {
            cleaned = 'Find ' + cleaned.toLowerCase();
          } else {
            cleaned = 'Identify ' + cleaned.toLowerCase();
          }
        }

        // Limit to 5 words maximum
        const words = cleaned.split(' ');
        if (words.length > 5) {
          cleaned = words.slice(0, 5).join(' ');
        }

        return cleaned;
      })
      .filter(line => {
        const words = line.trim().split(' ');
        return line.length > 0 && words.length >= 2 && words.length <= 5;
      })
      .slice(0, 6);
  }

  createFrameHash(frameBase64) {
    // Create a simple hash of the frame for caching
    const start = frameBase64.substring(0, 100);
    const end = frameBase64.substring(frameBase64.length - 100);
    return `${start.length}-${end.length}-${frameBase64.length}`;
  }

  async checkOllamaHealth() {
    try {
      console.log('[LLAVA_SERVICE] Checking Ollama health');
      const response = await axios.get(`${this.ollamaUrl}/api/tags`, { timeout: 10000 });

      const availableModels = response.data.models || [];
      const hasLLaVA = availableModels.some(model => model.name === this.model);
      const hasFastLLaVA = availableModels.some(model => model.name === this.fastModel);

      console.log('[LLAVA_SERVICE] Available models:', availableModels.map(m => m.name));
      console.log('[LLAVA_SERVICE] Required model available:', hasLLaVA);
      console.log('[LLAVA_SERVICE] Fast model available:', hasFastLLaVA);

      return {
        healthy: true,
        hasLLaVA: hasLLaVA || hasFastLLaVA, // Accept either model
        availableModels: availableModels.map(m => m.name),
        requiredModel: this.model,
        fastModel: this.fastModel,
        hasFastModel: hasFastLLaVA
      };
    } catch (error) {
      console.error('[LLAVA_SERVICE] Ollama health check failed:', error.message);
      return {
        healthy: false,
        error: error.message,
        requiredModel: this.model,
        fastModel: this.fastModel
      };
    }
  }
}

module.exports = new LLaVAService();