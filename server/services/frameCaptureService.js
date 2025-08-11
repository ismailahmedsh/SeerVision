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
      console.log('[FRAME_CAPTURE] Capturing frame');
      console.log('[FRAME_CAPTURE] Capturing frame from camera:', cameraId, 'type:', streamType);
      console.log('[FRAME_CAPTURE] Stream URL:', streamUrl);
      console.log('[FRAME_CAPTURE] Frame capture started');

      // For USB cameras, we cannot capture frames server-side
      // Return a meaningful message instead of a placeholder
      if (streamType === 'usb') {
        console.log('[FRAME_CAPTURE] USB camera detected - server-side capture not supported');
        const errorMessage = 'USB cameras require client-side frame capture. Server-side analysis is not available for USB cameras.';
        
        // Instead of creating a placeholder, throw an error that will be handled appropriately
        throw new Error(errorMessage);
      }

      let frameBuffer;

      // Use the frame capture endpoint for non-USB cameras
      try {
        const endpointRequestStart = Date.now();
        console.log('[FRAME_CAPTURE] Frame endpoint request started');
        console.log('[FRAME_CAPTURE] Using dedicated frame capture endpoint');

        const frameResponse = await axios.get(`http://localhost:${process.env.PORT || 3000}/api/cameras/${cameraId}/frame`, {
          timeout: 20000
        });

        const endpointRequestTime = Date.now() - endpointRequestStart;
        console.log('[FRAME_CAPTURE] Frame endpoint request completed');
        console.log('[FRAME_CAPTURE] Frame endpoint response:', frameResponse.data.success);

        if (!frameResponse.data.success) {
          throw new Error('Frame capture endpoint failed: ' + frameResponse.data.error);
        }

        const bufferConversionStart = Date.now();
        // Convert base64 back to buffer
        frameBuffer = Buffer.from(frameResponse.data.frame, 'base64');
        const bufferConversionTime = Date.now() - bufferConversionStart;

        console.log('[FRAME_CAPTURE] Buffer conversion completed');
        console.log('[FRAME_CAPTURE] Frame buffer created from endpoint, size:', frameBuffer.length);

      } catch (endpointError) {
        console.error('[FRAME_CAPTURE] Frame endpoint failed:', endpointError.message);
        
        // For non-USB cameras, create a generic placeholder on endpoint failure
        const placeholderStart = Date.now();
        console.log('[FRAME_CAPTURE] Endpoint failed, creating placeholder');
        console.log('[FRAME_CAPTURE] Creating generic placeholder due to endpoint failure');
        frameBuffer = await this.createPlaceholderFrame();
        
        const placeholderTime = Date.now() - placeholderStart;
        console.log('[FRAME_CAPTURE] Placeholder creation completed');
      }

      // Process and optimize the frame
      const processingStart = Date.now();
      console.log('[FRAME_CAPTURE] Frame processing started');

      const processedFrame = await this.processFrame(frameBuffer);

      const processingTime = Date.now() - processingStart;
      console.log('[FRAME_CAPTURE] Frame processing completed');
      console.log('[FRAME_CAPTURE] Frame processed, final size:', processedFrame.length);

      // Determine if this is a placeholder
      const isPlaceholder = frameBuffer.length < 5000; // Small frames are likely placeholders

      // Cache the frame
      const cachingStart = Date.now();
      this.frameCache.set(cameraId, {
        data: processedFrame,
        timestamp: Date.now(),
        base64: processedFrame.toString('base64'),
        isPlaceholder: isPlaceholder
      });
      const cachingTime = Date.now() - cachingStart;

      const totalCaptureTime = Date.now() - captureStartTime;
              console.log('[FRAME_CAPTURE] Frame capture completed');

      console.log('[FRAME_CAPTURE] Frame cached for camera:', cameraId, 'isPlaceholder:', isPlaceholder);
              console.log('[FRAME_CAPTURE] Frame captured successfully');
      return processedFrame.toString('base64');

    } catch (error) {
      const totalCaptureTime = Date.now() - captureStartTime;
              console.error('[FRAME_CAPTURE] Frame capture failed');
      console.error('[FRAME_CAPTURE] Error capturing frame:', error.message);
      console.error('[FRAME_CAPTURE] Error stack:', error.stack);
      console.error('[FRAME_CAPTURE] ⏱️ PROFILING: Frame capture failed after:', totalCaptureTime, 'ms');

      // Don't create placeholder frames for USB cameras - let the error propagate
      if (streamType === 'usb') {
        console.log('[FRAME_CAPTURE] USB camera error - not creating placeholder, propagating error');
        throw error;
      }

      // Create error placeholder for other camera types
      const placeholderStart = Date.now();
      const placeholderFrame = await this.createErrorPlaceholderFrame(error.message);
      const placeholderTime = Date.now() - placeholderStart;

              console.log('[FRAME_CAPTURE] Error placeholder created');

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
      console.log('[FRAME_CAPTURE] Creating USB camera placeholder frame');

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

      console.log('[FRAME_CAPTURE] USB placeholder frame created, size:', placeholderFrame.length);
      return placeholderFrame;
    } catch (error) {
      console.error('[FRAME_CAPTURE] Error creating USB placeholder:', error.message);
      return this.createPlaceholderFrame();
    }
  }

  async createErrorPlaceholderFrame(errorMessage) {
    try {
      console.log('[FRAME_CAPTURE] Creating error placeholder frame');

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

      console.log('[FRAME_CAPTURE] Error placeholder frame created, size:', placeholderFrame.length);
      return placeholderFrame;
    } catch (error) {
      console.error('[FRAME_CAPTURE] Error creating error placeholder:', error.message);
      return this.createPlaceholderFrame();
    }
  }

  async createPlaceholderFrame() {
    try {
      console.log('[FRAME_CAPTURE] Creating generic placeholder frame');

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

      console.log('[FRAME_CAPTURE] Generic placeholder frame created, size:', placeholderFrame.length);
      return placeholderFrame;
    } catch (error) {
      console.error('[FRAME_CAPTURE] Error creating placeholder frame:', error.message);
      // Return minimal placeholder
      return Buffer.from('data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=', 'base64');
    }
  }

  async processFrame(frameBuffer) {
    try {
      console.log('[FRAME_CAPTURE] Processing frame, original size:', frameBuffer.length);

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

      console.log('[FRAME_CAPTURE] Frame processed, new size:', processedFrame.length);
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
      console.log('[FRAME_CAPTURE] No cached frame for camera:', cameraId);
      return null;
    }

    // Check if frame is too old (older than 2 minutes)
    const age = Date.now() - cached.timestamp;
    if (age > 120000) {
      console.log('[FRAME_CAPTURE] Cached frame too old for camera:', cameraId, 'age:', age + 'ms');
      this.frameCache.delete(cameraId);
      return null;
    }

    console.log('[FRAME_CAPTURE] Returning cached frame for camera:', cameraId, 'age:', age + 'ms', 'isPlaceholder:', cached.isPlaceholder);
    return cached.base64;
  }

  startPeriodicCapture(cameraId, streamUrl, streamType, intervalSeconds) {
    console.log('[FRAME_CAPTURE] Starting periodic capture for camera:', cameraId, 'interval:', intervalSeconds, 'seconds');

    // Clear existing interval if any
    this.stopPeriodicCapture(cameraId);

    // Initial capture
    this.captureFrameFromStream(cameraId, streamUrl, streamType).catch(error => {
      console.error('[FRAME_CAPTURE] Initial capture failed:', error.message);
    });

    // Set up periodic capture - capture at the same rate as analysis
    const captureIntervalMs = intervalSeconds * 1000;
    console.log('[FRAME_CAPTURE] Setting capture interval to:', captureIntervalMs, 'ms');

    const interval = setInterval(async () => {
      try {
        console.log('[FRAME_CAPTURE] Periodic capture tick for camera:', cameraId);
        await this.captureFrameFromStream(cameraId, streamUrl, streamType);
      } catch (error) {
        console.error('[FRAME_CAPTURE] Periodic capture failed:', error.message);
      }
    }, captureIntervalMs);

    this.captureIntervals.set(cameraId, interval);
    console.log('[FRAME_CAPTURE] Periodic capture started for camera:', cameraId);
  }

  stopPeriodicCapture(cameraId) {
    console.log('[FRAME_CAPTURE] Stopping periodic capture for camera:', cameraId);

    const interval = this.captureIntervals.get(cameraId);
    if (interval) {
      clearInterval(interval);
      this.captureIntervals.delete(cameraId);
      console.log('[FRAME_CAPTURE] Periodic capture stopped for camera:', cameraId);
    }
  }

  clearCache(cameraId) {
    console.log('[FRAME_CAPTURE] Clearing cache for camera:', cameraId);
    this.frameCache.delete(cameraId);
  }
}

module.exports = new FrameCaptureService();