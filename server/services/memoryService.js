const llavaService = require('./llavaService');
const sharp = require('sharp');
const crypto = require('crypto');

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

    this.config = {
      contextMaxLines: parseInt(process.env.CONTEXT_MAX_LINES) || 3,
      analysisMaxConcurrency: parseInt(process.env.ANALYSIS_MAX_CONCURRENCY) || 2,
      asyncNoveltyEnabled: process.env.MEMORY_NOVELTY_ASYNC_V1 === 'true'
    };

    this.metrics = new Map();
    this.frameCounters = new Map();
    this.logSampleRate = process.env.MEMORY_LOG_SAMPLE_RATE ? parseInt(process.env.MEMORY_LOG_SAMPLE_RATE) : 1;
    this.requestCount = 0;

    console.log('[MEMORY_SERVICE] Initialized with NO TIMEOUTS for novelty detection');
    console.log('[MEMORY_SERVICE] Config:', this.config);
  }

  storePreviousAnswer(streamId, answer) {
    if (answer && answer.trim().length > 0) {
      this.previousAnswers.set(streamId, answer.trim());
      console.log('[MEMORY_SERVICE] Stored previous answer for stream ' + streamId + ': "' + answer.substring(0, 100) + (answer.length > 100 ? '...' : '') + '"');
    }
  }

  getPreviousAnswer(streamId) {
    return this.previousAnswers.get(streamId) || null;
  }

  /**
   * NEW DYNAMIC BUFFER SIZE CALCULATION based on analysis interval
   */
  getBufferSize(intervalSeconds) {
    console.log('[MEMORY_SERVICE] Calculating buffer size for interval:', intervalSeconds + 's');
    
    let bufferSize;
    if (intervalSeconds <= 10) {
      bufferSize = 25;
    } else if (intervalSeconds <= 20) {
      bufferSize = 35;
    } else if (intervalSeconds <= 30) {
      bufferSize = 45;
    } else if (intervalSeconds <= 60) {
      bufferSize = 55;
    } else if (intervalSeconds <= 120) {
      bufferSize = 65;
    } else {
      bufferSize = 65; // Cap at 65 frames for >120s
    }
    
    console.log('[MEMORY_SERVICE] Buffer size for ' + intervalSeconds + 's interval: ' + bufferSize + ' frames');
    return bufferSize;
  }

  getBuffer(streamId) {
    const buffer = this.buffers.get(streamId);
    if (buffer) {
      buffer.lastAccess = new Date();
      return buffer.entries;
    }
    return [];
  }

  initializeBuffer(streamId, intervalSeconds) {
    if (!this.buffers.has(streamId)) {
      const bufferSize = this.getBufferSize(intervalSeconds);
      
      this.buffers.set(streamId, {
        entries: [],
        lastAccess: new Date(),
        interval: intervalSeconds,
        maxSize: bufferSize // Store the calculated size
      });

      this.metrics.set(streamId, {
        noveltyCallsPerMin: 0,
        noveltyTimeouts: 0,
        noveltySkippedPrefilter: 0,
        memoryEntriesAdded: 0,
        memoryDuplicatesSkipped: 0,
        contextLinesSent: 0,
        lastMetricsReset: Date.now()
      });

      this.frameCounters.set(streamId, 0);
      console.log('[MEMORY_SERVICE] Initialized buffer for stream ' + streamId + ' with size ' + bufferSize + ' (interval: ' + intervalSeconds + 's)');
    } else {
      // Update buffer size if interval changed
      const buffer = this.buffers.get(streamId);
      const newBufferSize = this.getBufferSize(intervalSeconds);
      
      if (buffer.interval !== intervalSeconds || buffer.maxSize !== newBufferSize) {
        console.log('[MEMORY_SERVICE] Updating buffer for stream ' + streamId + ' - interval changed from ' + buffer.interval + 's to ' + intervalSeconds + 's');
        console.log('[MEMORY_SERVICE] Buffer size changed from ' + buffer.maxSize + ' to ' + newBufferSize + ' frames');
        
        buffer.interval = intervalSeconds;
        buffer.maxSize = newBufferSize;
        
        // Trim buffer if new size is smaller
        if (buffer.entries.length > newBufferSize) {
          const removedCount = buffer.entries.length - newBufferSize;
          buffer.entries = buffer.entries.slice(-newBufferSize);
          console.log('[MEMORY_SERVICE] Trimmed buffer to new size, removed ' + removedCount + ' old entries');
        }
      }
    }
    return this.getBuffer(streamId);
  }

  async seedBufferFromMainAnalysis(streamId, mainAnalysisResult, intervalSeconds) {
    try {
      this.initializeBuffer(streamId, intervalSeconds);
      const buffer = this.buffers.get(streamId);

      if (buffer.entries.length > 0) {
        console.log('[MEMORY_SERVICE] Buffer already seeded for stream ' + streamId + ', skipping main analysis seeding');
        return;
      }

      const sceneDescription = mainAnalysisResult && mainAnalysisResult.length > 10
        ? 'Scene: ' + mainAnalysisResult.substring(0, 150) + (mainAnalysisResult.length > 150 ? '...' : '')
        : 'Scene description from main analysis';

      const seedEntry = {
        frame: 1,
        description: sceneDescription,
        timestamp: new Date().toISOString(),
        noveltyFlag: 'seeded_from_main'
      };

      buffer.entries.push(seedEntry);

      const metrics = this.metrics.get(streamId);
      if (metrics) metrics.memoryEntriesAdded++;

      console.log('[MEMORY_SERVICE] Buffer seeded with entry: "' + sceneDescription + '"');
    } catch (error) {
      console.error('[MEMORY_SERVICE] Failed to seed buffer from main analysis:', error.message);
    }
  }

  isDuplicateText(streamId, newDescription) {
    const buffer = this.buffers.get(streamId);
    if (!buffer || buffer.entries.length === 0) return false;

    const lastEntry = buffer.entries[buffer.entries.length - 1];
    const normalizedNew = newDescription.toLowerCase().trim();
    const normalizedLast = lastEntry.description.toLowerCase().trim();

    // More flexible duplicate detection - allow for slight variations
    if (normalizedNew === normalizedLast) return true;
    
    // Check if the new description is very similar (90% similarity)
    const similarity = this.calculateTextSimilarity(normalizedNew, normalizedLast);
    if (similarity > 0.9) {
      console.log('[MEMORY_SERVICE] High similarity detected (' + Math.round(similarity * 100) + '%), treating as duplicate');
      return true;
    }
    
    return false;
  }

  calculateTextSimilarity(text1, text2) {
    // Simple similarity calculation using word overlap
    const words1 = new Set(text1.split(/\s+/));
    const words2 = new Set(text2.split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  async checkNoveltyAndGetSceneDescription(streamId, frameBase64, intervalSeconds) {
    try {
      this.initializeBuffer(streamId, intervalSeconds);

      const buffer = this.buffers.get(streamId);
      const bufferLengthBefore = buffer.entries.length;
      const isFirstFrame = bufferLengthBefore === 0;
      const isFastInterval = intervalSeconds <= 10;

      const frameNumber = (this.frameCounters.get(streamId) || 0) + 1;
      this.frameCounters.set(streamId, frameNumber);

              console.log('[MEMORY_SERVICE] Novelty check started');
      console.log('[MEMORY_SERVICE] Stream: ' + streamId + ', Frame: ' + frameNumber + ', Buffer: ' + bufferLengthBefore + ' entries, First frame: ' + isFirstFrame);
      console.log('[MEMORY_SERVICE] Fast interval (≤10s): ' + isFastInterval + ', Interval: ' + intervalSeconds + 's');

      let deferredResult = null;
      if (this.deferredNoveltyResults.has(streamId)) {
        deferredResult = this.deferredNoveltyResults.get(streamId);
        console.log('[MEMORY_SERVICE] Found deferred novelty result from frame ' + deferredResult.frameNumber + ': "' + deferredResult.result + '"');
        this.deferredNoveltyResults.delete(streamId);
      }

      if (deferredResult) {
        console.log('[MEMORY_SERVICE] Processing deferred novelty result: "' + deferredResult.result + '"');

        if (!this.isDuplicateText(streamId, deferredResult.result)) {
          const deferredEntry = {
            frame: buffer.entries.length + 1,
            description: deferredResult.result.length > 200 ? deferredResult.result.substring(0, 200) + '...' : deferredResult.result,
            timestamp: new Date().toISOString(),
            noveltyFlag: deferredResult.isFirstFrame ? 'first_frame_deferred' : 'deferred_success',
            processingTime: deferredResult.processingTime
          };

          buffer.entries.push(deferredEntry);

          // Use dynamic buffer size for trimming
          const maxSize = buffer.maxSize || this.getBufferSize(buffer.interval);
          if (buffer.entries.length > maxSize) {
            const removedCount = buffer.entries.length - maxSize;
            buffer.entries = buffer.entries.slice(-maxSize);
            console.log('[MEMORY_SERVICE] Trimmed buffer after deferred entry, removed ' + removedCount + ' old entries (max size: ' + maxSize + ')');
          }

          const metrics = this.metrics.get(streamId);
          if (metrics) metrics.memoryEntriesAdded++;

          if (deferredResult.isFirstFrame) {
            console.log('[MEMORY_SERVICE] FIRST FRAME BASELINE ESTABLISHED: "' + deferredResult.result + '"');
          }

          console.log('[MEMORY_SERVICE] Deferred novelty result stored successfully');
        } else {
          console.log('[MEMORY_SERVICE] Deferred novelty result was duplicate, not storing');
          const metrics = this.metrics.get(streamId);
          if (metrics) metrics.memoryDuplicatesSkipped++;
        }
      }

      if (isFirstFrame) {
        console.log('[MEMORY_SERVICE] First frame detected, starting novelty check');
        if (isFastInterval) {
          console.log('[MEMORY_SERVICE] FAST INTERVAL (≤10s) - novelty will run fully async, may defer to next frame');
        }
        this.runFirstFrameAsyncNoveltyCheck(streamId, frameBase64, frameNumber);
      } else {
        console.log('[MEMORY_SERVICE] Starting novelty check for subsequent frame');
        if (isFastInterval) {
          console.log('[MEMORY_SERVICE] FAST INTERVAL (≤10s) - novelty will run fully async, may defer to next frame');
        }
        this.runAsyncNoveltyCheck(streamId, frameBase64, frameNumber);
      }

              console.log('[MEMORY_SERVICE] Novelty check completed');
      return deferredResult;

    } catch (error) {
      console.error('[MEMORY_SERVICE] Critical error in novelty check:', error.message);
      return null;
    }
  }

  buildContextPrompt(streamId, userPrompt) {
    const buffer = this.buffers.get(streamId);
    const previousAnswer = this.getPreviousAnswer(streamId);
    const isFirstFrame = !buffer || buffer.entries.length === 0;

            console.log('[MEMORY_SERVICE] Building context prompt');
    console.log('[MEMORY_SERVICE] Stream: ' + streamId + ', Buffer exists: ' + (!!buffer) + ', Buffer length: ' + (buffer ? buffer.entries.length : 0));

    if (!buffer || buffer.entries.length === 0) {
      console.log('[MEMORY_SERVICE] No buffer entries for stream ' + streamId + ', using original prompt');
      return userPrompt;
    }

    const recentEntries = buffer.entries.slice(-this.config.contextMaxLines);

    const contextEntries = recentEntries
      .map((entry, index) => {
        const frameOffset = recentEntries.length - index - 1;
        const description = entry.description.length > 140
          ? entry.description.substring(0, 137) + '...'
          : entry.description;
        return '- Frame T-' + frameOffset + ': ' + description;
      })
      .join('\n');

    let contextPrompt = 'User prompt: ' + userPrompt + '\n\nContext (recent events):\n' + contextEntries;

    if (previousAnswer && !isFirstFrame) {
      console.log('[MEMORY_SERVICE] Adding previous answer section for continuity');
      contextPrompt += '\n\nThis was what you generated last to the user:\n' + previousAnswer;
    }

    contextPrompt += '\n\nCurrent frame: [Image]\nPlease answer accordingly.';

    const metrics = this.metrics.get(streamId);
    if (metrics) {
      metrics.contextLinesSent = recentEntries.length;
    }

    console.log('[MEMORY_SERVICE] Context prompt built with ' + recentEntries.length + ' lines (buffer size: ' + buffer.entries.length + '/' + (buffer.maxSize || 'unknown') + ')');
            console.log('[MEMORY_SERVICE] Context prompt completed');

    return contextPrompt;
  }

  async runFirstFrameAsyncNoveltyCheck(streamId, frameBase64, frameNumber) {
    try {
      if (this.pendingNoveltyChecks.has(streamId)) {
        console.log('[MEMORY_SERVICE] First frame novelty check already pending for stream ' + streamId);
        return;
      }

      const buffer = this.buffers.get(streamId);
      const isFastInterval = buffer && buffer.interval <= 10;

      const firstFramePrompt = `Analyze the first frame of a video stream with full visual comprehension.

**Task**: Provide a single, dense, and objective description of every visible element in the scene.

**Instructions**:
- Scan the entire frame methodically: foreground, background, center, periphery.
- Identify and describe all entities: people, objects, surfaces, lighting, text (if legible), and environmental features.
- Include precise details: positions (e.g., "left third", "centered", "near the door"), colors, sizes, orientations, states (e.g., "door open", "light on"), and any visible motion (e.g., "person walking right").
- Note spatial relationships (e.g., "a red chair to the left of a wooden desk").
- Mention textures, shadows, reflections, and lighting conditions (e.g., "bright overhead light", "shadow under table").
- Do not infer intent or future actions—only report observable facts.

**Output Format**:
- One or two complete, grammatically correct sentences.
- No bullet points, markdown, or extra text.
- Be exhaustive but concise—omit nothing visible.

Example: "A man in a blue shirt stands near the center of a kitchen, facing the sink; a white refrigerator is on the left wall, a stove on the right, and cabinet doors are open beneath the sink with a yellow sponge visible inside."`;

      console.log('[MEMORY_SERVICE] First frame novelty prompt (NEW): Memory Initialization');
      if (isFastInterval) {
        console.log('[MEMORY_SERVICE] FAST INTERVAL FIRST FRAME - fully async, may defer result to next frame');
      }

      const noveltyPromise = this.performFirstFrameAsyncNoveltyCheck(streamId, frameBase64, firstFramePrompt, frameNumber);
      this.pendingNoveltyChecks.set(streamId, noveltyPromise);

      noveltyPromise.finally(() => {
        this.pendingNoveltyChecks.delete(streamId);
      });

      console.log('[MEMORY_SERVICE] Started async first frame novelty check for frame', frameNumber);
    } catch (error) {
      console.error('[MEMORY_SERVICE] Error starting async first frame novelty check:', error.message);
    }
  }

  async performFirstFrameAsyncNoveltyCheck(streamId, frameBase64, noveltyPrompt, frameNumber) {
    const startTime = Date.now();

    try {
              console.log('[MEMORY_SERVICE] First frame novelty processing started');

      let noveltyResponse;

      try {
        noveltyResponse = await llavaService.analyzeFrame(frameBase64, noveltyPrompt, 1, streamId + '_novelty_first_async');
        const processingTime = Date.now() - startTime;
        console.log('[MEMORY_SERVICE] First frame async novelty completed');
      } catch (error) {
        const processingTime = Date.now() - startTime;
        console.error('[MEMORY_SERVICE] FIRST FRAME ASYNC NOVELTY ERROR after ' + processingTime + 'ms: ' + error.message);
        return;
      }

      const processingTime = Date.now() - startTime;

      if (!noveltyResponse || !noveltyResponse.answer) {
        console.log('[MEMORY_SERVICE] First frame async novelty returned empty response');
        return;
      }

      const response = noveltyResponse.answer.trim();
      console.log('[MEMORY_SERVICE] FIRST FRAME NOVELTY OUTPUT: "' + response + '"');

      if (response.length < 10) {
        console.log('[MEMORY_SERVICE] First frame novelty response too short - not deferring');
        return;
      }

      this.deferredNoveltyResults.set(streamId, {
        result: response,
        timestamp: new Date().toISOString(),
        frameNumber: frameNumber,
        processingTime: processingTime,
        isFirstFrame: true
      });

      const metrics = this.metrics.get(streamId);
      if (metrics) metrics.noveltyCallsPerMin++;

      console.log('[MEMORY_SERVICE] FIRST FRAME ASYNC NOVELTY RESULT DEFERRED FOR NEXT FRAME');
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error('[MEMORY_SERVICE] Critical error in first frame async novelty processing after ' + processingTime + 'ms:', error.message);
    }
  }

  async runAsyncNoveltyCheck(streamId, frameBase64, frameNumber) {
    try {
      if (this.pendingNoveltyChecks.has(streamId)) {
        console.log('[MEMORY_SERVICE] Novelty check already pending for stream ' + streamId + ', skipping frame ' + frameNumber);
        return;
      }

      const buffer = this.buffers.get(streamId);
      if (!buffer || buffer.entries.length === 0) {
        console.log('[MEMORY_SERVICE] No buffer entries for subsequent frame novelty check');
        return;
      }

      const isFastInterval = buffer.interval <= 10;

      // Get the last memory output for comparison
      const lastMemoryOutput = buffer.entries[buffer.entries.length - 1].description;

      const subsequentFramePrompt = `Analyze the current frame of a video stream for visual changes compared to the previous scene.

**Previous Scene Description**:
"${lastMemoryOutput}"

**Task**: Detect and describe **all** visual differences from the previous frame. If no changes exist, output exactly: NOTHING_NEW

**Instructions**:
- Compare the entire visual field: objects, people, lighting, positions, states, activities, and background.
- Look for: movement, additions, removals, rotations, state changes (e.g., "light turned on"), or new motion (e.g., "person now sitting").
- Even minor changes (e.g., a shifted book, dimmed light) must be reported.
- Be specific about what changed and where (e.g., "the laptop lid is now open", "a coffee mug appears on the desk").
- Ignore differences in camera noise or compression artifacts unless they represent real scene changes.

**Output Rules**:
- If any change: One or two clear, descriptive sentences listing all differences.
- If no change: Output **exactly** "NOTHING_NEW" (uppercase, no punctuation).
- Do not re-describe the entire scene—only report **deltas**.

Example 1: "The man has moved from the center to the left side of the room and is now sitting on a gray chair; the door in the background is now closed."
Example 2: NOTHING_NEW`;

      console.log('[MEMORY_SERVICE] Subsequent frame novelty prompt (NEW): Memory Update with last output comparison');
      if (isFastInterval) {
        console.log('[MEMORY_SERVICE] FAST INTERVAL SUBSEQUENT FRAME - fully async, may defer result to next frame');
      }

      const noveltyPromise = this.performAsyncNoveltyCheck(streamId, frameBase64, subsequentFramePrompt, frameNumber);
      this.pendingNoveltyChecks.set(streamId, noveltyPromise);

      noveltyPromise.finally(() => {
        this.pendingNoveltyChecks.delete(streamId);
      });

      console.log('[MEMORY_SERVICE] Started async novelty check for frame', frameNumber);
    } catch (error) {
      console.error('[MEMORY_SERVICE] Error starting async novelty check:', error.message);
    }
  }

  async performAsyncNoveltyCheck(streamId, frameBase64, noveltyPrompt, frameNumber) {
    const startTime = Date.now();

    try {
              console.log('[MEMORY_SERVICE] Novelty processing started');

      let noveltyResponse;

      try {
        noveltyResponse = await llavaService.analyzeFrame(frameBase64, noveltyPrompt, 1, streamId + '_novelty_async');
        const processingTime = Date.now() - startTime;
        console.log('[MEMORY_SERVICE] Async novelty completed');
      } catch (error) {
        const processingTime = Date.now() - startTime;
        console.error('[MEMORY_SERVICE] ASYNC NOVELTY ERROR after ' + processingTime + 'ms: ' + error.message);
        return;
      }

      const processingTime = Date.now() - startTime;

      if (!noveltyResponse || !noveltyResponse.answer) {
        console.log('[MEMORY_SERVICE] Async novelty returned empty response');
        return;
      }

      const response = noveltyResponse.answer.trim();
      console.log('[MEMORY_SERVICE] NOVELTY OUTPUT: "' + response + '"');

      if (response.toUpperCase() === 'NOTHING_NEW') {
        console.log('[MEMORY_SERVICE] Async novelty result: NOTHING_NEW - not deferring');
        return;
      }

      if (this.isDuplicateText(streamId, response)) {
        console.log('[MEMORY_SERVICE] Async novelty result is duplicate - not deferring');
        const metrics = this.metrics.get(streamId);
        if (metrics) metrics.memoryDuplicatesSkipped++;
        return;
      }

      this.deferredNoveltyResults.set(streamId, {
        result: response,
        timestamp: new Date().toISOString(),
        frameNumber: frameNumber,
        processingTime: processingTime,
        isFirstFrame: false
      });

      const metrics = this.metrics.get(streamId);
      if (metrics) metrics.noveltyCallsPerMin++;

      console.log('[MEMORY_SERVICE] ASYNC NOVELTY RESULT DEFERRED FOR NEXT FRAME');
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error('[MEMORY_SERVICE] Critical error in async novelty processing after ' + processingTime + 'ms:', error.message);
    }
  }

  getMetrics(streamId) {
    return this.metrics.get(streamId) || {};
  }

  resetMetrics(streamId) {
    const metrics = this.metrics.get(streamId);
    if (metrics) {
      Object.keys(metrics).forEach(key => {
        if (key !== 'lastMetricsReset') {
          metrics[key] = 0;
        }
      });
      metrics.lastMetricsReset = Date.now();
    }
  }

  cleanupIdleBuffers() {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    for (const [streamId, buffer] of this.buffers.entries()) {
      if (buffer.lastAccess < fiveMinutesAgo) {
        this.buffers.delete(streamId);
        this.metrics.delete(streamId);
        this.frameCounters.delete(streamId);
        this.previousAnswers.delete(streamId);
        this.lastStoredFrameHash.delete(streamId);
        this.noveltyTimeoutCounts.delete(streamId);
        this.circuitBreakers.delete(streamId);
        this.pendingNoveltyChecks.delete(streamId);
        this.deferredNoveltyResults.delete(streamId);
        console.log('[MEMORY_SERVICE] Cleaned up idle buffer for stream ' + streamId);
      }
    }

    console.log('[MEMORY_SERVICE] Buffer cleanup completed, active buffers: ' + this.buffers.size);
  }

  getDebugInfo(streamId) {
    const buffer = this.buffers.get(streamId);
    const previousAnswer = this.getPreviousAnswer(streamId);

    if (!buffer) {
      return { error: 'Buffer not found', streamId };
    }

    return {
      streamId,
      entryCount: buffer.entries.length,
      maxSize: buffer.maxSize || this.getBufferSize(buffer.interval),
      lastAccess: buffer.lastAccess,
      interval: buffer.interval,
      isFastInterval: buffer.interval <= 10,
      metrics: this.getMetrics(streamId),
      hasPendingNovelty: this.pendingNoveltyChecks.has(streamId),
      hasDeferredResult: this.deferredNoveltyResults.has(streamId),
      frameCounter: this.frameCounters.get(streamId) || 0,
      previousAnswer: previousAnswer ? previousAnswer.substring(0, 200) + (previousAnswer.length > 200 ? '...' : '') : null,
      entries: buffer.entries.map(entry => ({
        frame: entry.frame,
        description: entry.description.substring(0, 100) + (entry.description.length > 100 ? '...' : ''),
        timestamp: entry.timestamp,
        noveltyFlag: entry.noveltyFlag,
        processingTime: entry.processingTime || 'unknown'
      })),
      lastNoveltyOutput: buffer.entries.length > 0 ? buffer.entries[buffer.entries.length - 1].description : null
    };
  }

  setLogSampleRate(rate) {
    try {
      const newRate = parseInt(rate);
      if (newRate < 1) {
        console.warn('[MEMORY_SERVICE] Invalid log sample rate, must be >= 1');
        return;
      }

      const oldRate = this.logSampleRate;
      this.logSampleRate = newRate;
      this.requestCount = 0;

      console.log('[MEMORY_SERVICE] Log sample rate changed from ' + oldRate + ' to ' + newRate);
    } catch (error) {
      console.warn('[MEMORY_SERVICE] Failed to set log sample rate:', error.message);
    }
  }

  getLogConfig() {
    return {
      sampleRate: this.logSampleRate,
      requestCount: this.requestCount,
      nextLogAt: this.requestCount + (this.logSampleRate - (this.requestCount % this.logSampleRate))
    };
  }

  destroy() {
    try {
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = null;
      }

      this.buffers.clear();
      this.metrics.clear();
      this.frameCounters.clear();
      this.previousAnswers.clear();
      this.lastStoredFrameHash.clear();
      this.noveltyTimeoutCounts.clear();
      this.circuitBreakers.clear();
      this.pendingNoveltyChecks.clear();
      this.deferredNoveltyResults.clear();

      console.log('[MEMORY_SERVICE] Service destroyed and resources cleaned up');
    } catch (error) {
      console.error('[MEMORY_SERVICE] Error during service destruction:', error.message);
    }
  }
}

module.exports = new MemoryService();