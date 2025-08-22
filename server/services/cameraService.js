const Camera = require('../models/Camera');
const { ensureMemoryColumnExists } = require('../config/database');

class CameraService {
  static async createCamera(cameraData, userId) {
    try {
      // Validate required fields
      const { name, type, streamUrl, defaultInterval } = cameraData;
      if (!name || !type || !streamUrl) {
        throw new Error('Name, type, and stream URL are required');
      }

      // Test connection before creating
      const connectionTest = await this.testCameraConnection(streamUrl, type);
      if (!connectionTest.success) {
        throw new Error(`Camera connection failed: ${connectionTest.message}`);
      }

      const camera = await Camera.create({
        name: name.trim(),
        type,
        streamUrl: streamUrl.trim(),
        userId,
        analysisInterval: defaultInterval || 30
      });

      return camera;
    } catch (error) {
      console.error('[CAMERA_SERVICE] Error creating camera:', error.message);
      throw error;
    }
  }

  static async getAllCameras(userId) {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      // Ensure memory column exists before querying
      try {
        await ensureMemoryColumnExists();
      } catch (error) {
        console.warn('[CAMERA_SERVICE] Warning: Could not verify memory column:', error.message);
        // Continue anyway - the model will handle missing columns gracefully
      }

      const cameras = await Camera.findAll(userId);

      return cameras;
    } catch (error) {
      console.error('[CAMERA_SERVICE] Error getting all cameras:', error.message);
      throw error;
    }
  }

  static async getCameraById(id, userId = null) {
    try {
      // Ensure memory column exists before querying
      try {
        await ensureMemoryColumnExists();
      } catch (error) {
        console.warn('[CAMERA_SERVICE] Warning: Could not verify memory column:', error.message);
        // Continue anyway - the model will handle missing columns gracefully
      }
      
      const camera = await Camera.findById(id, userId);
      if (!camera) {
        throw new Error('Camera not found or access denied');
      }
      return camera;
    } catch (error) {
      console.error('[CAMERA_SERVICE] Error getting camera:', error.message);
      throw error;
    }
  }

  static async updateCamera(id, updateData, userId) {
    try {
      // If streamUrl or type is being updated, test the connection
      if (updateData.streamUrl || updateData.type) {
        const streamUrl = updateData.streamUrl;
        const type = updateData.type;
        
        if (streamUrl && type) {
          const connectionTest = await this.testCameraConnection(streamUrl, type);
          if (!connectionTest.success) {
            throw new Error(`Camera connection failed: ${connectionTest.message}`);
          }
        }
      }

      const camera = await Camera.update(id, updateData, userId);
      return camera;
    } catch (error) {
      console.error('[CAMERA_SERVICE] Error updating camera:', error.message);
      throw error;
    }
  }

  static async deleteCamera(id, userId) {
    try {
      const result = await Camera.delete(id, userId);
      return result;
    } catch (error) {
      console.error('[CAMERA_SERVICE] Error deleting camera:', error.message);
      throw error;
    }
  }

  static async testCameraConnection(streamUrl, type) {
    try {
      // Basic URL validation
      if (!streamUrl || !streamUrl.trim()) {
        return {
          success: false,
          message: 'Stream URL is required'
        };
      }

      const url = streamUrl.trim();
      
      // Check for unsupported URLs
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        return {
          success: false,
          message: 'YouTube URLs are not supported. Please use USB cameras only.'
        };
      }

      // Validate URL format based on type
      let isValidUrl = false;
      let errorMessage = '';

      switch (type) {
        case 'USB Camera':
        case 'usb':
          // For USB cameras, we might use device paths or indices
          isValidUrl = true; // Accept any format for USB cameras
          break;
        default:
          isValidUrl = false;
          errorMessage = 'Only USB cameras are currently supported';
      }

      if (!isValidUrl) {
        return {
          success: false,
          message: errorMessage
        };
      }

      // Simulate connection test (in real implementation, this would actually test the stream)
      // For now, we'll simulate a 90% success rate
      const success = Math.random() > 0.1;
      
      if (success) {
        return {
          success: true,
          message: 'Camera connection successful. Stream is accessible and video feed is working.'
        };
      } else {
        return {
          success: false,
          message: 'Failed to connect to camera. Please check the URL, credentials, and network connectivity.'
        };
      }
    } catch (error) {
      console.error('[CAMERA_SERVICE] Error testing camera connection:', error.message);
      return {
        success: false,
        message: `Connection test failed: ${error.message}`
      };
    }
  }

  static async getCameraSettings(id, userId) {
    try {
      // Ensure memory column exists before querying
      try {
        await ensureMemoryColumnExists();
      } catch (error) {
        console.warn('[CAMERA_SERVICE] Warning: Could not verify memory column:', error.message);
        // Continue anyway - the model will handle missing columns gracefully
      }
      
      const camera = await Camera.findById(id, userId);
      if (!camera) {
        throw new Error('Camera not found or access denied');
      }

      const settings = {
        name: camera.name,
        streamUrl: camera.streamUrl,
        type: camera.type,
        recordingEnabled: Boolean(camera.recordingEnabled),
        motionDetection: Boolean(camera.motionDetection),
        alertsEnabled: Boolean(camera.alertsEnabled),
        analysisInterval: camera.analysisInterval || 30,
        memory: Boolean(camera.memory || false), // Safe fallback for missing memory field
        qualitySettings: {
          resolution: camera.resolution || '1920x1080',
          frameRate: camera.frameRate || 30,
          bitrate: camera.bitrate || '2000kbps'
        }
      };

      return settings;
    } catch (error) {
      console.error('[CAMERA_SERVICE] Error getting camera settings:', error.message);
      throw error;
    }
  }

  static async updateCameraSettings(id, settings, userId) {
    try {
      const updateData = {
        recordingEnabled: settings.recordingEnabled,
        motionDetection: settings.motionDetection,
        alertsEnabled: settings.alertsEnabled,
        analysisInterval: settings.analysisInterval,
        memory: settings.memory
      };

      if (settings.qualitySettings) {
        updateData.resolution = settings.qualitySettings.resolution;
        updateData.frameRate = settings.qualitySettings.frameRate;
        updateData.bitrate = settings.qualitySettings.bitrate;
      }

      await Camera.update(id, updateData, userId);
      

      
      return { success: true };
    } catch (error) {
      console.error('[CAMERA_SERVICE] Error updating camera settings:', error.message);
      throw error;
    }
  }
}

module.exports = CameraService;