const llavaService = require('./llavaService');
const memoryService = require('./memoryService');

class AnalysisPipelineService {
  constructor() {
    this.activePipelines = new Map(); // streamId -> { fastPass, richAnalysis, status }
    this.lateResults = new Map(); // streamId -> { result, originalTimestamp, frameNumber }
  }

  /**
   * Start a new analysis pipeline for a frame
   * @param {string} streamId - Stream identifier
   * @param {string} frameBase64 - Frame data
   * @param {string} prompt - Analysis prompt
   * @param {number} analysisInterval - Analysis interval in seconds
   * @param {boolean} useMemory - Whether to use memory features
   * @param {boolean} jsonOption - Whether to expect JSON output
   * @returns {Promise<Object>} Pipeline result
   */
  async startAnalysisPipeline(streamId, frameBase64, prompt, analysisInterval, useMemory = false, jsonOption = false) {
    const frameTimestamp = new Date();
    const frameNumber = Date.now();
    
    console.log(`[ANALYSIS_PIPELINE] Starting pipeline for stream ${streamId}, frame ${frameNumber}`);
    
    // Check for late results from previous frames
    let lateResultContext = null;
    if (useMemory && this.lateResults.has(streamId)) {
      const lateResult = this.lateResults.get(streamId);
      lateResultContext = {
        result: lateResult.result,
        originalTimestamp: lateResult.originalTimestamp,
        frameNumber: lateResult.frameNumber
      };
      console.log(`[ANALYSIS_PIPELINE] Including late result from frame ${lateResult.frameNumber} in current tick`);
      this.lateResults.delete(streamId);
    }

    // Initialize pipeline tracking
    this.activePipelines.set(streamId, {
      fastPass: { status: 'running', startTime: Date.now() },
      richAnalysis: { status: 'pending', startTime: null },
      frameNumber: frameNumber,
      timestamp: frameTimestamp
    });

    try {
      // Start fast pass analysis (≤ 1.2s budget)
      const fastPassPromise = this.runFastPassAnalysis(streamId, frameBase64);
      
      // Start rich analysis in parallel (no time constraints)
      const richAnalysisPromise = this.runRichAnalysis(streamId, frameBase64, prompt, analysisInterval);
      
      // Set deadline for on-time publishing (80% of interval)
      const deadlineMs = Math.floor(analysisInterval * 1000 * 0.8);
      const deadlinePromise = this.createDeadlinePromise(deadlineMs);
      
      // Race between fast pass completion and deadline
      const fastResult = await Promise.race([fastPassPromise, deadlinePromise]);
      
      if (fastResult.deadlineReached) {
        return await this.handleDeadlineReached(
          streamId, frameBase64, analysisInterval, useMemory, jsonOption, 
          deadlineMs, lateResultContext, frameTimestamp, frameNumber
        );
      }
      
      // Fast pass completed within deadline
      return await this.handleFastPassSuccess(
        streamId, fastResult, useMemory, jsonOption, lateResultContext, 
        frameTimestamp, frameNumber, richAnalysisPromise
      );
      
    } catch (error) {
      console.error(`[ANALYSIS_PIPELINE] Pipeline failed for stream ${streamId}:`, error.message);
      this.cleanupPipeline(streamId);
      throw error;
    }
  }

  /**
   * Run fast pass analysis with strict time budget
   */
  async runFastPassAnalysis(streamId, frameBase64) {
    const pipeline = this.activePipelines.get(streamId);
    if (pipeline) {
      pipeline.fastPass.status = 'running';
      pipeline.fastPass.startTime = Date.now();
    }

    try {
      const result = await llavaService.analyzeFrameFast(
        frameBase64,
        'Describe the scene in 1-2 sentences maximum.',
        streamId + '_fast'
      );
      
      if (pipeline) {
        pipeline.fastPass.status = 'completed';
        pipeline.fastPass.result = result;
      }
      
      return result;
    } catch (error) {
      if (pipeline) {
        pipeline.fastPass.status = 'failed';
        pipeline.fastPass.error = error.message;
      }
      throw error;
    }
  }

  /**
   * Run rich analysis in background
   */
  async runRichAnalysis(streamId, frameBase64, prompt, analysisInterval) {
    const pipeline = this.activePipelines.get(streamId);
    if (pipeline) {
      pipeline.richAnalysis.status = 'running';
      pipeline.richAnalysis.startTime = Date.now();
    }

    try {
      const result = await llavaService.analyzeFrame(
        frameBase64,
        prompt,
        analysisInterval,
        streamId + '_rich'
      );
      
      if (pipeline) {
        pipeline.richAnalysis.status = 'completed';
        pipeline.richAnalysis.result = result;
      }
      
      return result;
    } catch (error) {
      if (pipeline) {
        pipeline.richAnalysis.status = 'failed';
        pipeline.richAnalysis.error = error.message;
      }
      throw error;
    }
  }

  /**
   * Create deadline promise
   */
  createDeadlinePromise(deadlineMs) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          deadlineReached: true,
          message: `Analysis deadline reached after ${deadlineMs}ms`
        });
      }, deadlineMs);
    });
  }

  /**
   * Handle case when deadline is reached
   */
  async handleDeadlineReached(streamId, frameBase64, analysisInterval, useMemory, jsonOption, 
                             deadlineMs, lateResultContext, frameTimestamp, frameNumber) {
    console.log(`[ANALYSIS_PIPELINE] Deadline reached for stream ${streamId}, publishing with available results`);
    
    // Try to get fast pass result if it completed
    let fastPassResult = null;
    const pipeline = this.activePipelines.get(streamId);
    if (pipeline && pipeline.fastPass.status === 'completed') {
      fastPassResult = pipeline.fastPass.result;
    }
    
    // For memory-enabled streams, seed buffer from fast pass if this is the first frame
    if (useMemory && fastPassResult) {
      const buffer = memoryService.getBuffer(streamId);
      if (buffer.length === 0) {
        console.log(`[ANALYSIS_PIPELINE] First frame deadline: seeding buffer from fast pass result`);
        memoryService.seedBufferFromMainAnalysis(streamId, fastPassResult.answer, analysisInterval)
          .catch(error => {
            console.error(`[ANALYSIS_PIPELINE] Fast pass buffer seeding failed for stream ${streamId}:`, error.message);
          });
      }
    }
    
    // Continue rich analysis in background for carry forward to next tick
    this.continueRichAnalysisInBackground(streamId, frameTimestamp, frameNumber, useMemory);
    
    return {
      success: true,
      message: 'Frame processing completed (deadline reached, using fast pass)',
      nextAnalysisIn: analysisInterval,
      timestamp: new Date().toISOString(),
      jsonOption: jsonOption,
      memory: useMemory,
      deadlineReached: true,
      resultPreview: fastPassResult?.answer || 'Fast pass analysis failed',
      lateResultContext: lateResultContext,
      debugInfo: {
        answerLength: fastPassResult?.answer?.length || 0,
        accuracyScore: fastPassResult?.accuracyScore || 0.6,
        processingTime: deadlineMs,
        deadlineReached: true,
        analysisType: 'fast_pass'
      }
    };
  }

  /**
   * Handle successful fast pass completion
   */
  async handleFastPassSuccess(streamId, fastResult, useMemory, jsonOption, lateResultContext, 
                            frameTimestamp, frameNumber, richAnalysisPromise) {
    console.log(`[ANALYSIS_PIPELINE] Fast pass completed for stream ${streamId}, publishing result`);
    
    // Update memory buffer with scene description (non-blocking)
    if (useMemory) {
      this.updateMemoryBuffer(streamId, fastResult, useMemory);
    }
    
    // Continue rich analysis in background for potential improvement
    this.continueRichAnalysisInBackground(streamId, frameTimestamp, frameNumber, useMemory);
    
    return {
      success: true,
      message: 'Frame analysis completed successfully (fast pass)',
      nextAnalysisIn: 30, // Default interval
      timestamp: new Date().toISOString(),
      jsonOption: jsonOption,
      memory: useMemory,
      resultPreview: fastResult.answer,
      deadlineReached: false,
      lateResultContext: lateResultContext,
      debugInfo: {
        answerLength: fastResult.answer?.length || 0,
        accuracyScore: fastResult.accuracyScore,
        processingTime: fastResult.processingTime,
        deadlineReached: false,
        analysisType: 'fast_pass'
      }
    };
  }

  /**
   * Update memory buffer with analysis result
   */
  async updateMemoryBuffer(streamId, analysisResult, useMemory) {
    if (!useMemory) return;
    
    try {
      // Try novelty detection first (increased timeout to 1.5s)
      const noveltyResult = await memoryService.checkNoveltyAndGetSceneDescription(streamId, '', 30);
      if (noveltyResult) {
        console.log(`[ANALYSIS_PIPELINE] Novelty detection successful for stream ${streamId}`);
      } else {
        console.log(`[ANALYSIS_PIPELINE] Novelty detection completed for stream ${streamId} (no update needed)`);
      }
    } catch (error) {
      console.error(`[ANALYSIS_PIPELINE] Memory buffer update failed for stream ${streamId}:`, error.message);
      
      // If this is the first frame and novelty failed, try fallback seeding from fast pass
      const buffer = memoryService.getBuffer(streamId);
      if (buffer.length === 0) {
        console.log(`[ANALYSIS_PIPELINE] First frame novelty failed, attempting fallback seeding from fast pass`);
        memoryService.seedBufferFromMainAnalysis(streamId, analysisResult.answer, 30)
          .catch(fallbackError => {
            console.error(`[ANALYSIS_PIPELINE] Fallback buffer seeding failed for stream ${streamId}:`, fallbackError.message);
          });
      }
    }
  }

  /**
   * Continue rich analysis in background
   */
  async continueRichAnalysisInBackground(streamId, frameTimestamp, frameNumber, useMemory) {
    const pipeline = this.activePipelines.get(streamId);
    if (!pipeline || pipeline.richAnalysis.status !== 'running') return;
    
    try {
      // Wait for rich analysis to complete
      const richResult = await pipeline.richAnalysis.promise;
      
      if (useMemory) {
        console.log(`[ANALYSIS_PIPELINE] Rich analysis completed for stream ${streamId}, carrying forward to next tick`);
        this.lateResults.set(streamId, {
          result: richResult.answer,
          originalTimestamp: frameTimestamp,
          frameNumber: frameNumber
        });
      }
      
      console.log(`[ANALYSIS_PIPELINE] Rich analysis completed for stream ${streamId} in background`);
    } catch (error) {
      console.error(`[ANALYSIS_PIPELINE] Background rich analysis failed for stream ${streamId}:`, error.message);
    } finally {
      this.cleanupPipeline(streamId);
    }
  }

  /**
   * Clean up pipeline resources
   */
  cleanupPipeline(streamId) {
    this.activePipelines.delete(streamId);
  }

  /**
   * Get pipeline status
   */
  getPipelineStatus(streamId) {
    return this.activePipelines.get(streamId) || null;
  }

  /**
   * Get all active pipelines
   */
  getAllPipelines() {
    return Array.from(this.activePipelines.entries()).map(([streamId, pipeline]) => ({
      streamId,
      ...pipeline
    }));
  }
}

module.exports = new AnalysisPipelineService();
