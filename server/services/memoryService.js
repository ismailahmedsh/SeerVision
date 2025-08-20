const llavaService = require('./llavaService');

class MemoryService {
  constructor() {
    this.buffers = new Map();
    this.cleanupInterval = setInterval(() => this.cleanupIdleBuffers(), 5 * 60 * 1000);
    this.previousAnswers = new Map();
    this.pendingNoveltyChecks = new Map();
    this.lastStoredFrameHash = new Map();
    this.noveltyTimeoutCounts = new Map();
    this.circuitBreakers = new Map();
    this.deferredNoveltyResults = new Map();

    // NEW: Canonical scene descriptions with embedding similarity
    this.canonicalSummaries = new Map(); // streamId -> latest canonical scene summary
    this.embeddingCache = new Map(); // streamId -> latest embedding

    this.config = {
      contextMaxLines: parseInt(process.env.CONTEXT_MAX_LINES) || 3,
      analysisMaxConcurrency: parseInt(process.env.ANALYSIS_MAX_CONCURRENCY) || 2,
      asyncNoveltyEnabled: process.env.MEMORY_NOVELTY_ASYNC_V1 === 'true'
    };

    this.metrics = new Map();
    this.frameCounters = new Map();
    this.logSampleRate = process.env.MEMORY_LOG_SAMPLE_RATE ? parseInt(process.env.MEMORY_LOG_SAMPLE_RATE) : 1;
    this.requestCount = 0;


  }

  storePreviousAnswer(streamId, answer) {
    if (answer && answer.trim().length > 0) {
      // Clean markdown formatting and filter pattern-inducing responses
      let cleanedAnswer = answer.trim();
      
      // Remove markdown code blocks that break JSON parsing
      if (cleanedAnswer.startsWith('```json') && cleanedAnswer.endsWith('```')) {
        cleanedAnswer = cleanedAnswer.slice(7, -3).trim(); // Remove ```json and ```

      } else if (cleanedAnswer.startsWith('```') && cleanedAnswer.endsWith('```')) {
        cleanedAnswer = cleanedAnswer.slice(3, -3).trim(); // Remove generic ```

      }
      
      // Apply pattern filtering
      cleanedAnswer = this.filterPatternInducingContent(cleanedAnswer);
      
      this.previousAnswers.set(streamId, cleanedAnswer);

    }
  }

  async checkCanonicalSimilarity(streamId, newSceneDescription) {
    try {

      
      const lastSummary = this.canonicalSummaries.get(streamId);
      if (!lastSummary) {
        // First frame - always accept

        return { shouldUpdate: true, similarity: 0.0 };
      }
      
      // Generate embeddings for both summaries
      const [newEmbedding, lastEmbedding] = await Promise.all([
        this.generateEmbedding(newSceneDescription),
        this.embeddingCache.get(streamId) || this.generateEmbedding(lastSummary)
      ]);
      
      if (!newEmbedding || !lastEmbedding) {

        return { shouldUpdate: true, similarity: 0.0 };
      }
      
      // Calculate cosine similarity
      const similarity = this.calculateCosineSimilarity(newEmbedding, lastEmbedding);
      const shouldUpdate = similarity < 0.85; // Updated threshold to 0.85
      
      const summaryLength = newSceneDescription.length;
      const decision = shouldUpdate ? 'accepted' : 'skipped';

      
      return { shouldUpdate, similarity };
      
    } catch (error) {
      console.error('[MEMORY_SERVICE] Error in similarity check:', error.message);
      // On error, assume significant change to avoid missing updates
      return { shouldUpdate: true, similarity: 0.0 };
    }
  }

  async generateEmbedding(text) {
    try {
      // Use Ollama's nomic-embed-text model for embeddings
      const response = await llavaService.generateEmbedding(text);
      return response;
    } catch (error) {
      console.error('[MEMORY_SERVICE] Failed to generate embedding:', error.message);
      return null;
    }
  }

  calculateCosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) {
      return 0.0;
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    
    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  updateCanonicalSummary(streamId, newSummary, embedding) {
    this.canonicalSummaries.set(streamId, newSummary);
    this.embeddingCache.set(streamId, embedding);

  }

  filterPatternInducingContent(answer) {
    // Remove or replace problematic patterns that could create self-reinforcing loops
    const problematicPatterns = [
      /NOTHING_NEW/gi,
      /nothing new/gi,
      /no changes?/gi,
      /same (?:as )?(?:before|previous)/gi,
      /unchanged/gi
    ];
    
    let filtered = answer;
    for (const pattern of problematicPatterns) {
      if (pattern.test(filtered)) {

        filtered = filtered.replace(pattern, 'scene continues as described');
      }
    }
    
    return filtered;
  }

  buildContextPrompt(streamId, userPrompt) {
    const buffer = this.buffers.get(streamId);
    const previousAnswer = this.getPreviousAnswer(streamId);
    const canonicalSummary = this.canonicalSummaries.get(streamId);
    const isFirstFrame = !buffer || buffer.entries.length === 0;



    // Build context using the new template structure
    const frameNumber = buffer ? buffer.entries.length + 1 : 1;
    
    let contextPrompt = `User prompt: ${userPrompt}

**Temporal Context:**
This is frame ${frameNumber} of a continuous video stream.

**Relevant Scene History from Memory:**
${canonicalSummary || 'No previous scene context available'}

**Current Scene Description:**
[Will be provided after current frame analysis]`;

    if (!buffer || buffer.entries.length === 0) {

    } else {

    }

    if (previousAnswer && !isFirstFrame) {

      contextPrompt += `

**Your previous response for context:**
${previousAnswer}`;
    }

    contextPrompt += '\n\nCurrent frame: [Image]\nPlease answer accordingly.';

    const metrics = this.metrics.get(streamId);
    if (metrics) {
      metrics.contextLinesSent = canonicalSummary ? 1 : 0;
    }



    return contextPrompt;
  }

  async checkNoveltyAndGetSceneDescription(streamId, frameBase64, intervalSeconds, userPrompt = null) {
    try {
      this.requestCount++;
      const shouldLog = this.requestCount % this.logSampleRate === 0;

      const buffer = this.buffers.get(streamId);
      const frameNumber = (this.frameCounters.get(streamId) || 0) + 1;
      this.frameCounters.set(streamId, frameNumber);
      const isFirstFrame = frameNumber === 1;

      let deferredResult = null;
      if (this.deferredNoveltyResults.has(streamId)) {
        const candidateResult = this.deferredNoveltyResults.get(streamId);
        const expectedFrameForResult = frameNumber - 1; // Deferred result should be from previous frame
        if (candidateResult.frameNumber === expectedFrameForResult) {
          deferredResult = candidateResult;

        } else {

        }
        this.deferredNoveltyResults.delete(streamId);
      }

      if (deferredResult) {


        if (!this.isDuplicateText(streamId, deferredResult.result)) {
          // Use embedding similarity to determine if scene has changed significantly
          const canonicalDescription = deferredResult.result;
          let shouldUpdateMemory = true;
          
          try {
            // TEMPORARILY DISABLED: Check similarity with previous canonical summary
            // const similarityCheck = await this.checkCanonicalSimilarity(streamId, canonicalDescription);
            // shouldUpdateMemory = similarityCheck.shouldUpdate;
            
            // TEMPORARY: Always update memory for testing
            shouldUpdateMemory = true;

            
            // Generate embedding and update canonical summary
            const embedding = await this.generateEmbedding(canonicalDescription);
            if (embedding) {
              this.updateCanonicalSummary(streamId, canonicalDescription, embedding);
            }
          } catch (error) {
            console.error('[MEMORY_SERVICE] Error in similarity check, proceeding with memory update:', error.message);
          }

          const deferredEntry = {
            frame: buffer.entries.length + 1,
            canonicalSummary: canonicalDescription,
            embedding: await this.generateEmbedding(canonicalDescription),
            timestamp: new Date().toISOString(),
            processingTime: deferredResult.processingTime
          };

          buffer.entries.push(deferredEntry);

          // Use dynamic buffer size for trimming
          const maxSize = buffer.maxSize || this.getBufferSize(buffer.interval);
          if (buffer.entries.length > maxSize) {
            const removedCount = buffer.entries.length - maxSize;
            buffer.entries = buffer.entries.slice(-maxSize);

          }

          const metrics = this.metrics.get(streamId);
          if (metrics) metrics.memoryEntriesAdded++;




        } else {

        }
      }

            const isFastInterval = buffer && buffer.interval <= 10;
        if (isFastInterval) {

      }
      this.runCanonicalSceneAnalysis(streamId, frameBase64, frameNumber, userPrompt);


      return deferredResult;

    } catch (error) {
      console.error('[MEMORY_SERVICE] Critical error in novelty check:', error.message);
      return null;
    }
  }

  async runCanonicalSceneAnalysis(streamId, frameBase64, frameNumber, userPrompt = null) {
    try {
      if (this.pendingNoveltyChecks.has(streamId)) {

        return;
      }

      const buffer = this.buffers.get(streamId);
      const isFastInterval = buffer && buffer.interval <= 10;

      // Build task-aware canonical prompt based on user's analysis goal
      let taskFocusInstructions = '';
      if (userPrompt && userPrompt.trim().length > 0) {
        taskFocusInstructions = `

**CRITICAL TASK FOCUS**: The user is specifically asking: "${userPrompt}"
- Pay EXTRA attention to elements directly relevant to this request
- If the user mentions specific objects, actions, or details, prioritize describing those elements
- Include relevant details that would help track changes related to the user's specific analysis goal`;
      }

      const canonicalPrompt = `Comprehensively analyze this video frame. Generate a complete, objective description of all visible elements.

**Task:** Provide a thorough scene summary covering every significant entity and environmental detail.${taskFocusInstructions}

**CRITICAL OUTPUT REQUIREMENT:** 
- Return ONLY a continuous paragraph of text
- DO NOT use JSON format, bullet points, or structured sections
- DO NOT use markdown, headers, or special formatting
- Write as one flowing descriptive paragraph

**Instructions:**
- Scan the entire frame methodically: foreground, background, center, periphery
- Describe all entities: people, objects, surfaces, lighting, text (if legible), environmental features
- Include precise details: positions, colors, sizes, orientations, states, spatial relationships
- Note textures, shadows, reflections, and lighting conditions
- Focus exclusively on observable facts - no interpretations or narratives

**Example of correct format:**
"A bearded man in a blue shirt sits at a wooden desk with an open laptop computer positioned directly in front of him, while a red ceramic coffee mug sits to the right of the laptop and a stack of white papers is arranged to the left, with natural light streaming through a partially opened window behind him creating soft shadows across the desk surface."

**Output Format:** Write your description as one continuous paragraph following the example above.`;


      if (isFastInterval) {

      }

      const noveltyPromise = this.performCanonicalAnalysis(streamId, frameBase64, canonicalPrompt, frameNumber);
      this.pendingNoveltyChecks.set(streamId, noveltyPromise);

      if (!isFastInterval) {
        await noveltyPromise;
      }

    } catch (error) {
      console.error('[MEMORY_SERVICE] Error in canonical scene analysis:', error.message);
    }
  }



  async performCanonicalAnalysis(streamId, frameBase64, prompt, frameNumber) {
    const startTime = Date.now();
    const requestId = streamId + '_canonical_analysis';

    try {
      const response = await llavaService.analyzeFrame(frameBase64, prompt, 1, requestId);
      const processingTime = Date.now() - startTime;

      if (response && response.answer) {


      this.deferredNoveltyResults.set(streamId, {
          result: response.answer,
        timestamp: new Date().toISOString(),
        frameNumber: frameNumber,
          processingTime: processingTime
        });


      }

        this.pendingNoveltyChecks.delete(streamId);

    } catch (error) {
      console.error('[MEMORY_SERVICE] Error in canonical analysis:', error.message);
      this.pendingNoveltyChecks.delete(streamId);
    }
  }



  // Keep existing helper methods that are still needed
  isDuplicateText(streamId, text) {
    const lastHash = this.lastStoredFrameHash.get(streamId);
    const currentHash = this.hashText(text);
    
    if (lastHash === currentHash) {
      return true;
    }
    
    this.lastStoredFrameHash.set(streamId, currentHash);
    return false;
  }

  hashText(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
  }

  getPreviousAnswer(streamId) {
    return this.previousAnswers.get(streamId) || null;
  }

  initializeBuffer(streamId, intervalSeconds) {
    if (!this.buffers.has(streamId)) {
      const bufferSize = this.getBufferSize(intervalSeconds);
      this.buffers.set(streamId, {
        entries: [],
        interval: intervalSeconds,
        maxSize: bufferSize,
        lastActivity: new Date()
      });

    }
    return this.buffers.get(streamId);
  }

  getBuffer(streamId) {
    const buffer = this.buffers.get(streamId);
    return buffer ? buffer.entries : [];
  }

  getBufferSize(intervalSeconds) {
    if (intervalSeconds >= 120) return 80;
    if (intervalSeconds >= 60) return 50;
    if (intervalSeconds < 10) return Math.max(15, Math.min(20, intervalSeconds * 2));
    return 20 + Math.floor((intervalSeconds - 10) * (30 / 50));
  }

  cleanupIdleBuffers() {
    const cutoffTime = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
    let cleaned = 0;

    for (const [streamId, buffer] of this.buffers.entries()) {
      if (buffer.lastActivity < cutoffTime) {
        this.buffers.delete(streamId);
        this.previousAnswers.delete(streamId);
        this.canonicalSummaries.delete(streamId);
        this.embeddingCache.delete(streamId);
        this.frameCounters.delete(streamId);
        this.lastStoredFrameHash.delete(streamId);
        cleaned++;
      }
    }

    if (cleaned > 0) {

    }
  }

  getMetrics(streamId) {
    return this.metrics.get(streamId) || null;
  }

  clearBuffer(streamId) {
    if (this.buffers.has(streamId)) {
      this.buffers.get(streamId).entries = [];
      this.canonicalSummaries.delete(streamId);
      this.embeddingCache.delete(streamId);
      this.frameCounters.delete(streamId);

    }
  }
}

module.exports = new MemoryService();
