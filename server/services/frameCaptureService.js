const axios = require('axios');
const sharp = require('sharp');

class FrameCaptureService {
  constructor() {
    this.frameCache = new Map(); // Cache frames by camera ID
    this.captureIntervals = new Map(); // Track capture intervals
  }

  async captureFrameFromStream(cameraId, streamUrl, streamType) {
    const captureStartTime = Date.now();
    try {
      // For USB cameras, we cannot capture frames server-side
      // Return a meaningful message instead of a placeholder
      if (streamType === 'usb') {
        const errorMessage = 'USB cameras require client-side frame capture. Server-side analysis is not available for USB cameras.';
        
        // Instead of creating a placeholder, throw an error that will be handled appropriately
        throw new Error(errorMessage);
      }

      let frameBuffer;

      // Use the frame capture endpoint for non-USB cameras
      try {
        const frameResponse = await axios.get(`http://localhost:${process.env.PORT || 3000}/api/cameras/${cameraId}/frame`, {
          timeout: 20000
        });

        if (!frameResponse.data.success) {
          throw new Error('Frame capture endpoint failed: ' + frameResponse.data.error);
        }

        // Convert base64 back to buffer
        frameBuffer = Buffer.from(frameResponse.data.frame, 'base64');

      } catch (endpointError) {
        console.error('[FRAME_CAPTURE] Frame endpoint failed:', endpointError.message);
        
        // For non-USB cameras, create a generic placeholder on endpoint failure
        frameBuffer = await this.createPlaceholderFrame();
      }

      // Process and optimize the frame
      const processedFrame = await this.processFrame(frameBuffer);

      // Determine if this is a placeholder
      const isPlaceholder = frameBuffer.length < 5000; // Small frames are likely placeholders

      // Cache the frame
      this.frameCache.set(cameraId, {
        data: processedFrame,
        timestamp: Date.now(),
        base64: processedFrame.toString('base64'),
        isPlaceholder: isPlaceholder
      });

      return processedFrame.toString('base64');

    } catch (error) {
      const totalCaptureTime = Date.now() - captureStartTime;
      console.error('[FRAME_CAPTURE] Frame capture failed');
      console.error('[FRAME_CAPTURE] Error capturing frame:', error.message);
      console.error('[FRAME_CAPTURE] Error stack:', error.stack);
      console.error('[FRAME_CAPTURE] ⏱️ PROFILING: Frame capture failed after:', totalCaptureTime, 'ms');

      // Don't create placeholder frames for USB cameras - let the error propagate
      if (streamType === 'usb') {
        throw error;
      }

      // Create error placeholder for other camera types
      const placeholderStart = Date.now();
      const placeholderFrame = await this.createErrorPlaceholderFrame(error.message);
      const placeholderTime = Date.now() - placeholderStart;

      this.frameCache.set(cameraId, {
        data: placeholderFrame,
        timestamp: Date.now(),
        base64: placeholderFrame.toString('base64'),
        isPlaceholder: true
      });

      return placeholderFrame.toString('base64');
    }
  }

  async createUSBPlaceholderFrame() {
    try {
      const timestamp = new Date().toISOString();
      const placeholderFrame = await sharp({
        create: {
          width: 640,
          height: 480,
          channels: 3,
          background: { r: 32, g: 32, b: 32 }
        }
      })
      .composite([{
        input: Buffer.from(`<svg width="640" height="480">
          <rect width="640" height="480" fill="#202020"/>
          <circle cx="320" cy="240" r="60" fill="#404040" stroke="#606060" stroke-width="3"/>
          <text x="320" y="180" text-anchor="middle" fill="white" font-size="18" font-weight="bold">USB Camera</text>
          <text x="320" y="200" text-anchor="middle" fill="#cccccc" font-size="14">Server-side frame capture not available</text>
          <text x="320" y="300" text-anchor="middle" fill="#888888" font-size="12">Live stream visible in browser only</text>
          <text x="320" y="320" text-anchor="middle" fill="#666666" font-size="10">${timestamp}</text>
        </svg>`),
        top: 0,
        left: 0
      }])
      .jpeg({ quality: 85 })
      .toBuffer();

      return placeholderFrame;
    } catch (error) {
      console.error('[FRAME_CAPTURE] Error creating USB placeholder:', error.message);
      return this.createPlaceholderFrame();
    }
  }

  async createErrorPlaceholderFrame(errorMessage) {
    try {
      const timestamp = new Date().toISOString();
      const shortError = errorMessage.substring(0, 50) + (errorMessage.length > 50 ? '...' : '');

      const placeholderFrame = await sharp({
        create: {
          width: 640,
          height: 480,
          channels: 3,
          background: { r: 64, g: 32, b: 32 }
        }
      })
      .composite([{
        input: Buffer.from(`<svg width="640" height="480">
          <rect width="640" height="480" fill="#402020"/>
          <text x="320" y="200" text-anchor="middle" fill="#ff6666" font-size="18" font-weight="bold">Frame Capture Failed</text>
          <text x="320" y="230" text-anchor="middle" fill="#ffcccc" font-size="12">${shortError}</text>
          <text x="320" y="280" text-anchor="middle" fill="#cc8888" font-size="10">${timestamp}</text>
        </svg>`),
        top: 0,
        left: 0
      }])
      .jpeg({ quality: 85 })
      .toBuffer();
      return placeholderFrame;
    } catch (error) {
      console.error('[FRAME_CAPTURE] Error creating error placeholder:', error.message);
      return this.createPlaceholderFrame();
    }
  }

  async createPlaceholderFrame() {
    try {


      const timestamp = new Date().toISOString();
      const placeholderFrame = await sharp({
        create: {
          width: 512,
          height: 384,
          channels: 3,
          background: { r: 64, g: 64, b: 64 }
        }
      })
      .composite([{
        input: Buffer.from(`<svg width="512" height="384">
          <rect width="512" height="384" fill="#404040"/>
          <text x="256" y="180" text-anchor="middle" fill="white" font-size="16">No Live Frame Available</text>
          <text x="256" y="200" text-anchor="middle" fill="white" font-size="12">${timestamp}</text>
          <rect x="206" y="162" width="100" height="60" fill="#606060" stroke="white" stroke-width="2"/>
        </svg>`),
        top: 0,
        left: 0
      }])
      .jpeg({ quality: 85 })
      .toBuffer();


      return placeholderFrame;
    } catch (error) {
      console.error('[FRAME_CAPTURE] Error creating placeholder frame:', error.message);
      // Return minimal placeholder
      return Buffer.from('data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=', 'base64');
    }
  }

  async processFrame(frameBuffer) {
    try {
      // Resize and optimize frame for LLaVA
      const processedFrame = await sharp(frameBuffer)
        .resize(512, 384, { // Resize to reasonable size for LLaVA
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({
          quality: 85,
          progressive: true
        })
        .toBuffer();

      return processedFrame;
    } catch (error) {
      console.error('[FRAME_CAPTURE] Error processing frame:', error.message);
      // Return original frame if processing fails
      return frameBuffer;
    }
  }

  getCachedFrame(cameraId) {
    const cached = this.frameCache.get(cameraId);
    if (!cached) {
      return null;
    }

    // Check if frame is too old (older than 2 minutes)
    const age = Date.now() - cached.timestamp;
    if (age > 120000) {
      this.frameCache.delete(cameraId);
      return null;
    }

    return cached.base64;
  }

  startPeriodicCapture(cameraId, streamUrl, streamType, intervalSeconds) {
    // Clear existing interval if any
    this.stopPeriodicCapture(cameraId);

    // Initial capture
    this.captureFrameFromStream(cameraId, streamUrl, streamType).catch(error => {
      console.error('[FRAME_CAPTURE] Initial capture failed:', error.message);
    });

    // Set up periodic capture - capture at the same rate as analysis
    const captureIntervalMs = intervalSeconds * 1000;

    const interval = setInterval(async () => {
      try {
        await this.captureFrameFromStream(cameraId, streamUrl, streamType);
      } catch (error) {
        console.error('[FRAME_CAPTURE] Periodic capture failed:', error.message);
      }
    }, captureIntervalMs);

    this.captureIntervals.set(cameraId, interval);
  }

  stopPeriodicCapture(cameraId) {
    const interval = this.captureIntervals.get(cameraId);
    if (interval) {
      clearInterval(interval);
      this.captureIntervals.delete(cameraId);
    }
  }

  clearCache(cameraId) {
    this.frameCache.delete(cameraId);
  }
}

module.exports = new FrameCaptureService();