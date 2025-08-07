const axios = require('axios');
const sharp = require('sharp');

class LLaVAService {
  constructor() {
    this.ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    this.model = 'llava:7b';
    this.fastModel = 'llava:7b-v1.5-q4_0';
    this.timeout = 25000;
    this.suggestionTimeout = 25000;
    this.activeRequests = new Map();
    this.suggestionCache = new Map();
    this.backgroundSuggestionQueue = new Map();

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
    try {
      const frameBuffer = Buffer.from(frameBase64, 'base64');

      const optimizedBuffer = await sharp(frameBuffer)
        .resize(256, 256, {
          fit: 'inside',
          withoutEnlargement: false
        })
        .jpeg({
          quality: 70,
          progressive: false
        })
        .toBuffer();

      const optimizedBase64 = optimizedBuffer.toString('base64');
      return optimizedBase64;
    } catch (error) {
      console.error('Frame preprocessing failed:', error.message);
      return frameBase64;
    }
  }

  async analyzeFrame(frameBase64, prompt, intervalSeconds = 30, streamId = null) {
    const analysisStartTime = Date.now();

    const isSuggestionRequest = streamId === 'suggestions' ||
                               (streamId && streamId.startsWith('suggestion')) ||
                               (streamId && streamId.startsWith('background'));

    if (!isSuggestionRequest && streamId && this.activeRequests.has(streamId)) {
      const activeRequest = this.activeRequests.get(streamId);
      const requestAge = Date.now() - activeRequest.startTime;
      throw new Error(`Frame dropped: previous analysis still in progress (${Math.round(requestAge/1000)}s)`);
    }

    if (!isSuggestionRequest && streamId) {
      this.activeRequests.set(streamId, {
        startTime: analysisStartTime,
        prompt: prompt.substring(0, 50) + '...'
      });
    }

    try {
      if (!frameBase64 || frameBase64.length < 1000) {
        throw new Error('Invalid or too small frame data');
      }

      const optimizedFrame = await this.preprocessFrame(frameBase64);
      const timeoutMs = this.timeout;
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
            realModelExecution: true,
            ollamaMetricsPresent: !!(ollamaMetrics.totalDuration > 0)
          },
          pipelineTiming: {
            total: totalProcessingTime
          },
          ollamaMetrics
        })
      };

    } catch (error) {
      const totalProcessingTime = Date.now() - analysisStartTime;

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
          throw new Error(`Connection to Ollama timed out after ${error.config?.timeout || 'unknown'}ms. Ollama may be overloaded.`);
        } else {
          throw new Error(`Network error connecting to Ollama: ${error.message}`);
        }
      }

      if (error.message.includes('Frame dropped')) {
        throw error;
      } else if (error.message.includes('timeout') || error.message.includes('model processing too slow')) {
        throw new Error(`LLaVA model timeout after ${totalProcessingTime}ms - model processing too slow`);
      }

      throw new Error(`Unified analysis failed: ${error.message}`);
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
      // First attempt - ask for 5 suggestions, 3 words max
      `Based on the image provided, suggest actionable prompts only—commands that can be performed—related to the image, such as 'count objects' or 'describe scene'. Provide up to 5 suggestions, each no longer than 3 words.`,

      // Second attempt - ask for 3 suggestions, 2 words max
      `Based on the image provided, suggest actionable prompts only—commands that can be performed—related to the image, such as 'count objects' or 'describe scene'. Provide up to 3 suggestions, each no longer than 2 words.`,

      // Third attempt - ask for 2 suggestions, 2 words max
      `Based on the image provided, suggest actionable prompts only—commands that can be performed—related to the image, such as 'count objects' or 'describe scene'. Provide up to 2 suggestions, each no longer than 2 words.`
    ];

    let accumulatedSuggestions = [];

    for (let attempt = 0; attempt < retryPrompts.length; attempt++) {
      try {
        console.log(`[LLAVA_SERVICE] Suggestion attempt ${attempt + 1} with prompt: ${retryPrompts[attempt]}`);

        const suggestionStreamId = `suggestions-${Date.now()}-attempt-${attempt}`;
        const result = await this.analyzeFrame(frameBase64, retryPrompts[attempt], 30, suggestionStreamId);

        console.log(`[LLAVA_SERVICE] Raw model response for attempt ${attempt + 1}:`, result.answer);

        const suggestions = this.processModelResponse(result.answer);
        console.log(`[LLAVA_SERVICE] Processed suggestions for attempt ${attempt + 1}:`, suggestions);

        // Accumulate suggestions from this attempt
        accumulatedSuggestions = [...accumulatedSuggestions, ...suggestions];
        
        // Remove duplicates
        accumulatedSuggestions = [...new Set(accumulatedSuggestions)];

        console.log(`[LLAVA_SERVICE] Accumulated suggestions after attempt ${attempt + 1}:`, accumulatedSuggestions);

        // If we have any valid suggestions, return them immediately
        if (accumulatedSuggestions.length > 0) {
          console.log(`[LLAVA_SERVICE] Success: returning ${accumulatedSuggestions.length} accumulated suggestions`);
          return accumulatedSuggestions.slice(0, 6); // Limit to 6 max
        }

        // If this is the last attempt and we have no suggestions, fail
        if (attempt === retryPrompts.length - 1) {
          console.log(`[LLAVA_SERVICE] All attempts completed with no valid suggestions`);
          throw new Error(`No valid suggestions generated after ${retryPrompts.length} attempts`);
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`[LLAVA_SERVICE] Attempt ${attempt + 1} error:`, error.message);

        // If this is the last attempt, return what we have or fail
        if (attempt === retryPrompts.length - 1) {
          if (accumulatedSuggestions.length > 0) {
            console.log(`[LLAVA_SERVICE] Final attempt failed but returning ${accumulatedSuggestions.length} accumulated suggestions`);
            return accumulatedSuggestions.slice(0, 6);
          } else {
            console.log(`[LLAVA_SERVICE] All attempts failed with no accumulated suggestions`);
            throw new Error(`All retry attempts failed. Final error: ${error.message}`);
          }
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  getFallbackSuggestions() {
    // Return basic, universally applicable suggestions when model fails
    return [
      'Count people',
      'Describe scene',
      'Find objects',
      'Check activity'
    ];
  }

  async generateSuggestions(frameBase64, retryAttempt = 0) {
    // This method is now replaced by generateSuggestionsWithRetry
    return await this.generateSuggestionsWithRetry(frameBase64);
  }

  processModelResponse(answer) {
    console.log('[LLAVA_SERVICE] Processing raw model response (minimal filtering):', answer);

    // Extremely minimal processing - accept almost everything the model provides
    const suggestions = answer
      .split('\n')
      .map((line) => {
        // Only remove basic formatting characters
        let cleaned = line.replace(/^\d+\.?\s*/, '').replace(/^[-•*]\s*/, '').trim();
        cleaned = cleaned.replace(/^["']|["']$/g, '');

        // Only skip completely empty lines
        if (cleaned.length === 0) {
          return null;
        }

        // Accept everything else - no word count limits, no content validation
        return cleaned;
      })
      .filter(suggestion => suggestion !== null && suggestion.trim().length > 0);

    // Also try splitting by other delimiters if newlines don't work
    if (suggestions.length === 0) {
      console.log('[LLAVA_SERVICE] No newline-separated suggestions found, trying comma/period separation');
      
      const alternativeSuggestions = answer
        .split(/[,.;]/)
        .map(part => {
          let cleaned = part.replace(/^\d+\.?\s*/, '').replace(/^[-•*]\s*/, '').trim();
          cleaned = cleaned.replace(/^["']|["']$/g, '');
          return cleaned.length > 0 ? cleaned : null;
        })
        .filter(suggestion => suggestion !== null);
      
      console.log('[LLAVA_SERVICE] Alternative parsing found:', alternativeSuggestions);
      suggestions.push(...alternativeSuggestions);
    }

    // If still no suggestions, take the entire response as one suggestion
    if (suggestions.length === 0 && answer.trim().length > 0) {
      console.log('[LLAVA_SERVICE] No parsed suggestions, using entire response as single suggestion');
      const entireResponse = answer.trim().replace(/^["']|["']$/g, '');
      if (entireResponse.length > 0) {
        suggestions.push(entireResponse);
      }
    }

    console.log('[LLAVA_SERVICE] Final extracted suggestions (ultra-minimal processing):', suggestions);
    return suggestions.slice(0, 6); // Limit to 6 max to prevent UI overflow
  }

  processStrictSuggestionResponse(answer) {
    const actionVerbs = [
      'count', 'detect', 'find', 'check', 'analyze', 'identify', 'examine',
      'locate', 'spot', 'search', 'look', 'scan', 'monitor', 'track', 'observe', 'describe'
    ];

    const suggestions = answer
      .split('\n')
      .map((line) => {
        let cleaned = line.replace(/^\d+\.?\s*/, '').replace(/^[-•*]\s*/, '').trim();
        cleaned = cleaned.replace(/^["']|["']$/g, '');

        if (cleaned.includes(':')) {
          cleaned = cleaned.split(':')[0].trim();
        }

        if (cleaned.includes(',')) {
          cleaned = cleaned.split(',')[0].trim();
        }

        if (cleaned.length < 5) {
          return null;
        }

        const words = cleaned.toLowerCase().split(' ').filter(word => word.length > 0);

        if (words.length < 2 || words.length > 5) {
          return null;
        }

        const firstWord = words[0];
        const isActionVerb = actionVerbs.includes(firstWord);

        if (!isActionVerb) {
          return null;
        }

        const lastWord = words[words.length - 1];
        const incompletePatterns = [
          'the', 'a', 'an', 'is', 'are', 'if', 'that', 'this', 'for', 'with', 'in', 'on', 'at'
        ];

        if (incompletePatterns.includes(lastWord)) {
          return null;
        }

        const hasNumbers = /\d/.test(cleaned);
        if (hasNumbers) {
          return null;
        }

        const contextKeywords = [
          'people', 'person', 'objects', 'items', 'colors', 'lighting', 'movement', 'motion',
          'vehicles', 'cars', 'buildings', 'doors', 'windows', 'activity', 'scene', 'background',
          'foreground', 'shapes', 'faces', 'hands', 'animals', 'plants', 'furniture', 'tools',
          'signs', 'text', 'numbers', 'patterns', 'textures', 'materials', 'clothing', 'food'
        ];

        const hasContextKeyword = words.some(word => contextKeywords.includes(word));
        if (!hasContextKeyword) {
          return null;
        }

        const actionablePhrase = words.map((word, i) =>
          i === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word
        ).join(' ');

        return actionablePhrase;
      })
      .filter(suggestion => suggestion !== null);

    const uniqueSuggestions = [...new Set(suggestions)].slice(0, 6);
    return uniqueSuggestions;
  }

  getContextualFallbacks(frameBase64) {
    return this.contextualFallbacks.general;
  }

  startBackgroundSuggestionProcessing(frameBase64, frameHash) {
    if (this.backgroundSuggestionQueue.has(frameHash)) {
      return;
    }

    this.backgroundSuggestionQueue.set(frameHash, {
      startTime: Date.now(),
      status: 'processing'
    });

    this.processBackgroundSuggestions(frameBase64, frameHash).catch(error => {
      console.error('Background processing failed:', error.message);
      this.backgroundSuggestionQueue.delete(frameHash);
    });
  }

  async processBackgroundSuggestions(frameBase64, frameHash) {
    try {
      const suggestionPrompt = `Analyze this image and suggest 6 short analysis tasks (3-4 words each) that would be useful for examining this specific scene.

Focus on what you actually see in the image. Make each suggestion an actionable command:
- Count visible people
- Describe main colors
- Check door status
- Find any vehicles
- Identify key objects
- Detect any activity

Generate 6 prompts based on what you see. Format as one prompt per line, no numbers.`;

      const backgroundStreamId = `background-${Date.now()}`;

      const result = await Promise.race([
        this.analyzeFrame(frameBase64, suggestionPrompt, 30, backgroundStreamId),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Background LLaVA timeout after 30s')), 30000)
        )
      ]);

      const suggestions = this.processSuggestionResponse(result.answer);

      if (suggestions.length >= 3) {
        this.suggestionCache.set(frameHash, {
          suggestions,
          timestamp: Date.now(),
          source: 'llava',
          processingTime: result.processingTime,
          backgroundProcessed: true
        });

        this.backgroundSuggestionQueue.delete(frameHash);
      } else {
        throw new Error('Background LLaVA returned insufficient suggestions');
      }

    } catch (error) {
      console.error('Background processing failed:', error.message);
      this.backgroundSuggestionQueue.delete(frameHash);
    }
  }

  processSuggestionResponse(answer) {
    return answer
      .split('\n')
      .map(line => {
        let cleaned = line.replace(/^\d+\.?\s*/, '').replace(/^[-•*]\s*/, '').trim();
        cleaned = cleaned.replace(/^["']|["']$/g, '');

        const actionVerbs = ['count', 'describe', 'check', 'find', 'identify', 'detect', 'analyze', 'examine', 'look', 'search'];
        const firstWord = cleaned.toLowerCase().split(' ')[0];

        if (!actionVerbs.includes(firstWord) && cleaned.length > 0) {
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
}

module.exports = new LLaVAService();