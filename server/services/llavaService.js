const axios = require('axios');
const sharp = require('sharp');
const http = require('http');
const https = require('https');

class LLaVAService {
  constructor() {
    this.ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    this.model = 'llava:7b';
    this.fastModel = 'llava:7b-v1.5-q4_0';
    this.timeout = 0; // Remove hard timeout for testing
    this.suggestionTimeout = 0; // Remove hard timeout for testing
    this.activeRequests = new Map();
    this.suggestionCache = new Map();
    this.backgroundSuggestionQueue = new Map();

    // Simple Queue Logic - One queue per stream with global concurrency
    this.maxConcurrency = parseInt(process.env.ANALYSIS_MAX_CONCURRENCY) || 2;
    this.streamQueues = new Map(); // streamId -> { processing: null, waiting: null }
    this.activeStreams = new Set(); // streamIds currently processing
    this.globalWaitingList = []; // streams waiting for capacity

    // Create HTTP agents with keep-alive for better connection reuse
    this.httpAgent = new http.Agent({
      keepAlive: true,
      keepAliveMsecs: 30000,
      maxSockets: 10,
      maxFreeSockets: 5,
      timeout: 0
    });

    this.httpsAgent = new https.Agent({
      keepAlive: true,
      keepAliveMsecs: 30000,
      maxSockets: 10,
      maxFreeSockets: 5,
      timeout: 0
    });

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

  async preprocessFrame(frameBase64, targetSize = 256) {
    try {
      const frameBuffer = Buffer.from(frameBase64, 'base64');

      // Optimize for model processing - keep quality but reduce size
      const optimizedBuffer = await sharp(frameBuffer)
        .resize(targetSize, targetSize, {
          fit: 'inside',
          withoutEnlargement: false
        })
        .jpeg({
          quality: 85, // Higher quality for better model performance
          progressive: false
        })
        .toBuffer();

      const optimizedBase64 = optimizedBuffer.toString('base64');

      // Target ≤200KB as specified
      if (optimizedBuffer.length > 200 * 1024 && targetSize > 128) {
        // Recursively reduce size if too large
        return await this.preprocessFrame(frameBase64, Math.floor(targetSize * 0.8));
      }

      return optimizedBase64;
    } catch (error) {
      console.error('Frame preprocessing failed:', error.message);
      return frameBase64;
    }
  }

  async analyzeFrameWithQueue(frameBase64, prompt, intervalSeconds = 30, streamId = null) {
    if (!streamId) {
      // No queue for requests without streamId
      return await this.analyzeFrame(frameBase64, prompt, intervalSeconds, streamId);
    }

    return new Promise((resolve, reject) => {
      this.enqueueFrame(streamId, {
        frameBase64,
        prompt,
        intervalSeconds,
        resolve,
        reject,
        requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now()
      });
    });
  }

  enqueueFrame(streamId, frameData) {
    // Initialize stream queue if needed
    if (!this.streamQueues.has(streamId)) {
      this.streamQueues.set(streamId, { processing: null, waiting: null });
    }
    
    const queue = this.streamQueues.get(streamId);
    
    // If stream is processing, handle waiting slot
    if (queue.processing) {
      // Replace waiting frame if exists (newest frame wins)
      if (queue.waiting) {
        queue.waiting.resolve({
          status: 'superseded',
          message: 'Frame superseded by newer frame',
          streamId,
          requestId: queue.waiting.requestId
        });
      }
      
      queue.waiting = frameData;
      return;
    }
    
    // Stream not processing, check global capacity
    if (this.activeStreams.size >= this.maxConcurrency) {
      // Global capacity full, queue in waiting list
      queue.waiting = frameData;
      if (!this.globalWaitingList.includes(streamId)) {
        this.globalWaitingList.push(streamId);
      }
      return;
    }
    
    // Start processing immediately
    this.startStreamProcessing(streamId, frameData);
  }
  
  async startStreamProcessing(streamId, frameData) {
    const queue = this.streamQueues.get(streamId);
    queue.processing = frameData;
    this.activeStreams.add(streamId);
    
    try {
      const result = await this.processFrame(
        frameData.frameBase64,
        frameData.prompt,
        frameData.intervalSeconds,
        streamId,
        frameData.requestId
      );
      
      frameData.resolve(result);
      
    } catch (error) {
      frameData.reject(error);
      console.error(`[QUEUE] [${frameData.requestId}] Processing failed for stream: ${streamId}:`, error.message);
    } finally {
      // Processing complete, check for next frame
      queue.processing = null;
      this.activeStreams.delete(streamId);
      
      // Process waiting frame in this stream
      if (queue.waiting) {
        const nextFrame = queue.waiting;
        queue.waiting = null;
        this.startStreamProcessing(streamId, nextFrame);
      } else if (this.globalWaitingList.length > 0) {
        // No waiting frame, check global waiting list
        this.processGlobalWaitingList();
      }
    }
  }
  
  processGlobalWaitingList() {
    while (this.globalWaitingList.length > 0 && this.activeStreams.size < this.maxConcurrency) {
      const waitingStreamId = this.globalWaitingList.shift();
      const waitingQueue = this.streamQueues.get(waitingStreamId);
      
      if (waitingQueue && waitingQueue.waiting && !waitingQueue.processing) {
        const frameData = waitingQueue.waiting;
        waitingQueue.waiting = null;

        this.startStreamProcessing(waitingStreamId, frameData);
      }
    }
  }

  async analyzeFrame(frameBase64, prompt, intervalSeconds = 30, streamId = null) {
    const analysisStartTime = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const isSuggestionRequest = streamId === 'suggestions' ||
                               (streamId && streamId.startsWith('suggestion')) ||
                               (streamId && streamId.startsWith('background'));

    // CRITICAL: Detect novelty requests
    const isNoveltyRequest = streamId && (
      streamId.includes('_novelty') ||
      streamId.endsWith('_novelty_first') ||
      streamId.endsWith('_novelty_async') ||
      streamId.endsWith('_novelty_first_async') ||
      streamId.endsWith('_novelty_async_late')
    );



    // ALL ROUTES GO THROUGH QUEUE - No direct processing
    return await this.analyzeFrameWithQueue(frameBase64, prompt, intervalSeconds, streamId);
  }

  async processFrame(frameBase64, prompt, intervalSeconds, streamId, requestId) {
    const analysisStartTime = Date.now();
    
    const isSuggestionRequest = streamId === 'suggestions' ||
                               (streamId && streamId.startsWith('suggestion')) ||
                               (streamId && streamId.startsWith('background'));

    const isNoveltyRequest = streamId && (
      streamId.includes('_novelty') ||
      streamId.endsWith('_novelty_first') ||
      streamId.endsWith('_novelty_async') ||
      streamId.endsWith('_novelty_first_async') ||
      streamId.endsWith('_novelty_async_late')
    );

    if (!isSuggestionRequest && streamId) {
      this.activeRequests.set(streamId, {
        startTime: analysisStartTime,
        prompt: prompt.substring(0, 50) + '...',
        requestId: requestId
      });
    }

    try {
      if (!frameBase64 || frameBase64.length < 1000) {
        throw new Error('Invalid or too small frame data');
      }

      // Optimize frame processing
      const optimizedFrame = await this.preprocessFrame(frameBase64, 256);

      const modelToUse = this.model;

      const requestData = {
        model: modelToUse,
        prompt: prompt,
        images: [optimizedFrame],
        stream: false,
        options: {
          temperature: 0.1,
          top_p: 0.9,
          top_k: 40,
          num_predict: 50,
          num_ctx: 1024,
          num_gpu: 1,
          num_thread: 4,
          repeat_penalty: 1.1
        }
      };

      

      let response;
      const maxRetries = isNoveltyRequest ? 3 : 1; // Retry novelty requests
      let lastError;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          // Use hardened HTTP client with no timeout and keep-alive
          response = await axios.post(`${this.ollamaUrl}/api/generate`, requestData, {
            timeout: 0, // No timeout
            headers: {
              'Content-Type': 'application/json',
              'Connection': 'keep-alive'
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            httpAgent: this.httpAgent,
            httpsAgent: this.httpsAgent,
            validateStatus: function (status) {
              return status < 500; // Don't throw for 4xx errors
            }
          });

          break; // Success, exit retry loop

        } catch (error) {
          lastError = error;
          console.error(`[LLAVA_SERVICE] [${requestId}] Attempt ${attempt}/${maxRetries} failed: ${error.message}`);

          // Check if this is a retryable error
          const isRetryable = isNoveltyRequest && (
            error.code === 'ECONNRESET' ||
            error.code === 'ETIMEDOUT' ||
            error.code === 'ENOTFOUND' ||
            error.code === 'ECONNREFUSED' ||
            error.message.includes('socket hang up') ||
            error.message.includes('timeout')
          );

          if (isRetryable && attempt < maxRetries) {
            const delay = Math.pow(2, attempt - 1) * 250; // Exponential backoff: 250ms, 500ms, 1s
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          } else {
            throw error;
          }
        }
      }

      if (!response) {
        throw lastError || new Error('All retry attempts failed');
      }

      if (!response.data || !response.data.response) {
        throw new Error('Invalid response from Ollama - no response data');
      }

      const answer = response.data.response.trim();

      const ollamaMetrics = {
        totalDuration: response.data.total_duration || 0,
        loadDuration: response.data.load_duration || 0,
        promptEvalDuration: response.data.prompt_eval_duration || 0,
        evalDuration: response.data.eval_duration || 0,
        promptEvalCount: response.data.prompt_eval_count || 0,
        evalCount: response.data.eval_count || 0
      };

      const accuracyScore = this.calculateOptimizedConfidenceScore(answer, ollamaMetrics);
      const totalProcessingTime = Date.now() - analysisStartTime;



      return {
        answer,
        accuracyScore,
        processingTime: totalProcessingTime,
        model: modelToUse,
        requestType: isSuggestionRequest ? 'suggestion' : (isNoveltyRequest ? 'novelty' : 'analysis'),
        optimizedFrameSize: optimizedFrame.length,
        requestId: requestId,
        rawJson: JSON.stringify({
          ...response.data,
          optimizationMetrics: {
            originalFrameSize: frameBase64.length,
            optimizedFrameSize: optimizedFrame.length,
            sizeReduction: Math.round((1 - optimizedFrame.length / frameBase64.length) * 100),
            tokenLimit: requestData.options.num_predict,
            actualTokens: ollamaMetrics.evalCount,
            requestType: isSuggestionRequest ? 'suggestion' : (isNoveltyRequest ? 'novelty' : 'analysis'),
            unifiedPipeline: true,
            realModelExecution: true,
            ollamaMetricsPresent: !!(ollamaMetrics.totalDuration > 0),
            requestBudget: 'unlimited',
            budgetUsed: 'N/A',
            timeoutBypassed: true,
            requestId: requestId
          },
          pipelineTiming: {
            total: totalProcessingTime
          },
          ollamaMetrics
        })
      };

    } catch (error) {
      const totalProcessingTime = Date.now() - analysisStartTime;

      console.error(`[LLAVA_SERVICE] [${requestId}] REQUEST FAILED after ${totalProcessingTime}ms: ${error.message}`);

      if (isNoveltyRequest) {
        console.error(`[LLAVA_SERVICE] [${requestId}] NOVELTY REQUEST FAILED: ${streamId} after ${totalProcessingTime}ms`);
        console.error(`[LLAVA_SERVICE] [${requestId}] NOVELTY ERROR: ${error.message}`);
      }

      if (error.response) {
        if (error.response.status === 500) {
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
        if (error.code === 'ECONNREFUSED') {
          throw new Error(`Cannot connect to Ollama at ${this.ollamaUrl}. Please ensure Ollama is running: ollama serve`);
        } else if (error.code === 'ETIMEDOUT') {
          throw new Error(`Connection to Ollama timed out. Ollama may be overloaded.`);
        } else if (error.code === 'ECONNRESET' || error.message.includes('socket hang up')) {
          throw new Error(`Connection to Ollama was reset. This may be due to stream teardown or server overload.`);
        } else {
          throw new Error(`Network error connecting to Ollama: ${error.message}`);
        }
      }

      if (error.message.includes('Frame dropped')) {
        throw error;
      }

      throw new Error(`Analysis failed: ${error.message}`);
    } finally {
      if (!isSuggestionRequest && streamId && this.activeRequests.has(streamId)) {
        this.activeRequests.delete(streamId);
      }
    }
  }

  calculateOptimizedConfidenceScore(answer, ollamaMetrics) {
    try {
      let confidence = 0.7;

      if (ollamaMetrics.evalCount > 0 && ollamaMetrics.evalDuration > 0) {
        const tokensPerSecond = ollamaMetrics.evalCount / (ollamaMetrics.evalDuration / 1000000000);
        if (tokensPerSecond > 10) confidence += 0.1;
        if (tokensPerSecond > 20) confidence += 0.05;
      }

      const responseLength = answer.length;
      if (responseLength > 20 && responseLength < 200) confidence += 0.1;
      if (responseLength > 200) confidence -= 0.05;

      const uncertaintyWords = ['maybe', 'possibly', 'might', 'unclear', 'not sure'];
      const hasUncertainty = uncertaintyWords.some(word => answer.toLowerCase().includes(word));
      if (hasUncertainty) confidence -= 0.1;

      const definitiveWords = ['clearly', 'shows', 'displays', 'contains', 'has'];
      const hasDefinitive = definitiveWords.some(word => answer.toLowerCase().includes(word));
      if (hasDefinitive) confidence += 0.1;

      const finalConfidence = Math.max(0.4, Math.min(0.95, confidence));
      return finalConfidence;

    } catch (error) {
      console.error('Error calculating confidence:', error.message);
      return 0.75;
    }
  }

  async generateSuggestionsWithRetry(frameBase64) {
    const retryPrompts = [
      `Based on the image provided, suggest actionable prompts only—commands that can be performed—related to the image, such as 'count objects' or 'describe scene'. Provide up to 5 suggestions, each no longer than 3 words.`,
      `Based on the image provided, suggest actionable prompts only—commands that can be performed—related to the image, such as 'count objects' or 'describe scene'. Provide up to 3 suggestions, each no longer than 2 words.`,
      `Based on the image provided, suggest actionable prompts only—commands that can be performed—related to the image, such as 'count objects' or 'describe scene'. Provide up to 2 suggestions, each no longer than 2 words.`
    ];

    let accumulatedSuggestions = [];

    for (let attempt = 0; attempt < retryPrompts.length; attempt++) {
      try {
        const suggestionStreamId = `suggestions-${Date.now()}-attempt-${attempt}`;
        const result = await this.analyzeFrame(frameBase64, retryPrompts[attempt], 30, suggestionStreamId);

        const suggestions = this.processModelResponse(result.answer);

        accumulatedSuggestions = [...accumulatedSuggestions, ...suggestions];
        accumulatedSuggestions = [...new Set(accumulatedSuggestions)];

        if (accumulatedSuggestions.length > 0) {
          return accumulatedSuggestions.slice(0, 6);
        }

        if (attempt === retryPrompts.length - 1) {
          throw new Error(`No valid suggestions generated after ${retryPrompts.length} attempts`);
        }

        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`[LLAVA_SERVICE] Attempt ${attempt + 1} error:`, error.message);

        if (attempt === retryPrompts.length - 1) {
          if (accumulatedSuggestions.length > 0) {
            return accumulatedSuggestions.slice(0, 6);
          } else {
            throw new Error(`All retry attempts failed. Final error: ${error.message}`);
          }
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  getFallbackSuggestions() {
    return [
      'Count people',
      'Describe scene',
      'Find objects',
      'Check activity'
    ];
  }

  async generateSuggestions(frameBase64, retryAttempt = 0) {
    return await this.generateSuggestionsWithRetry(frameBase64);
  }

  processModelResponse(answer) {
    const suggestions = answer
      .split('\n')
      .map((line) => {
        let cleaned = line.replace(/^\d+\.?\s*/, '').replace(/^[-•*]\s*/, '').trim();
        cleaned = cleaned.replace(/^["']|["']$/g, '');

        if (cleaned.length === 0) {
          return null;
        }

        return cleaned;
      })
      .filter(suggestion => suggestion !== null && suggestion.trim().length > 0);

    if (suggestions.length === 0) {
      const alternativeSuggestions = answer
        .split(/[,.;]/)
        .map(part => {
          let cleaned = part.replace(/^\d+\.?\s*/, '').replace(/^[-•*]\s*/, '').trim();
          cleaned = cleaned.replace(/^["']|["']$/g, '');
          return cleaned.length > 0 ? cleaned : null;
        })
        .filter(suggestion => suggestion !== null);

      suggestions.push(...alternativeSuggestions);
    }

    if (suggestions.length === 0 && answer.trim().length > 0) {
      const entireResponse = answer.trim().replace(/^["']|["']$/g, '');
      if (entireResponse.length > 0) {
        suggestions.push(entireResponse);
      }
    }

    return suggestions.slice(0, 6);
  }

  createFrameHash(frameBase64) {
    const start = frameBase64.substring(0, 100);
    const end = frameBase64.substring(frameBase64.length - 100);
    return `${start.length}-${end.length}-${frameBase64.length}`;
  }

  async checkOllamaHealth() {
    try {
      const response = await axios.get(`${this.ollamaUrl}/api/tags`, { timeout: 10000 });

      const availableModels = response.data.models || [];
      const hasLLaVA = availableModels.some(model => model.name === this.model);
      const hasFastLLaVA = availableModels.some(model => model.name === this.fastModel);

      return {
        healthy: true,
        hasLLaVA: hasLLaVA || hasFastLLaVA,
        availableModels: availableModels.map(m => m.name),
        requiredModel: this.model,
        fastModel: this.fastModel,
        hasFastModel: hasFastLLaVA
      };
    } catch (error) {
      console.error('Ollama health check failed:', error.message);
      return {
        healthy: false,
        error: error.message,
        requiredModel: this.model,
        fastModel: this.fastModel
      };
    }
  }

  async generateEmbedding(text) {
    try {
      
      
      const response = await axios.post(`${this.ollamaUrl}/api/embeddings`, {
        model: 'nomic-embed-text',
        prompt: text
      }, {
        timeout: 30000, // 30 second timeout for embeddings
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.data && response.data.embedding) {

        return response.data.embedding;
      } else {
        console.error('[LLAVA_SERVICE] Invalid embedding response structure');
        return null;
      }
    } catch (error) {
      console.error('[LLAVA_SERVICE] Failed to generate embedding:', error.message);
      return null;
    }
  }
}

module.exports = new LLaVAService();