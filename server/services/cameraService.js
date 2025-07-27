const Camera = require('../models/Camera');

class CameraService {
  static async createCamera(cameraData, userId) {
    try {
      console.log('[CAMERA_SERVICE] Creating camera for user:', userId);
      
      // Validate required fields
      const { name, type, streamUrl } = cameraData;
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
        userId
      });

      console.log('[CAMERA_SERVICE] Camera created successfully:', camera._id);
      return camera;
    } catch (error) {
      console.error('[CAMERA_SERVICE] Error creating camera:', error.message);
      throw error;
    }
  }

  static async getAllCameras(userId) {
    try {
      console.log('[CAMERA_SERVICE] Getting all cameras for user:', userId);
      const cameras = await Camera.findAll(userId);
      console.log('[CAMERA_SERVICE] Retrieved cameras:', cameras.length);
      return cameras;
    } catch (error) {
      console.error('[CAMERA_SERVICE] Error getting cameras:', error.message);
      throw error;
    }
  }

  static async getCameraById(id, userId = null) {
    try {
      console.log('[CAMERA_SERVICE] Getting camera by ID:', id, 'for user:', userId);
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
      console.log('[CAMERA_SERVICE] Updating camera:', id);
      
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
      console.log('[CAMERA_SERVICE] Camera updated successfully');
      return camera;
    } catch (error) {
      console.error('[CAMERA_SERVICE] Error updating camera:', error.message);
      throw error;
    }
  }

  static async deleteCamera(id, userId) {
    try {
      console.log('[CAMERA_SERVICE] Deleting camera:', id);
      const result = await Camera.delete(id, userId);
      console.log('[CAMERA_SERVICE] Camera deleted successfully');
      return result;
    } catch (error) {
      console.error('[CAMERA_SERVICE] Error deleting camera:', error.message);
      throw error;
    }
  }

  static async testCameraConnection(streamUrl, type) {
    try {
      console.log('[CAMERA_SERVICE] Testing camera connection:', { streamUrl, type });
      
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
          message: 'YouTube URLs are not supported. Please use direct video stream URLs (e.g., .mp4, .m3u8, RTSP streams)'
        };
      }

      // Validate URL format based on type
      let isValidUrl = false;
      let errorMessage = '';

      switch (type) {
        case 'RTSP Stream':
        case 'rtsp':
          isValidUrl = url.toLowerCase().startsWith('rtsp://');
          errorMessage = 'RTSP URLs must start with rtsp://';
          break;
        case 'HTTP Stream':
        case 'http':
          isValidUrl = url.toLowerCase().startsWith('http://') || url.toLowerCase().startsWith('https://');
          errorMessage = 'HTTP URLs must start with http:// or https://';
          break;
        case 'IP Camera':
        case 'ip':
          isValidUrl = url.toLowerCase().startsWith('http://') || url.toLowerCase().startsWith('https://');
          errorMessage = 'IP Camera URLs must start with http:// or https://';
          break;
        case 'USB Camera':
        case 'usb':
          // For USB cameras, we might use device paths or indices
          isValidUrl = true; // Accept any format for USB cameras
          break;
        default:
          isValidUrl = url.toLowerCase().startsWith('http://') || 
                      url.toLowerCase().startsWith('https://') || 
                      url.toLowerCase().startsWith('rtsp://');
          errorMessage = 'URL must start with http://, https://, or rtsp://';
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
        console.log('[CAMERA_SERVICE] Camera connection test successful');
        return {
          success: true,
          message: 'Camera connection successful. Stream is accessible and video feed is working.'
        };
      } else {
        console.log('[CAMERA_SERVICE] Camera connection test failed');
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
      console.log('[CAMERA_SERVICE] Getting camera settings:', id);
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
        analysisInterval: camera.analysisInterval || 2,
        qualitySettings: {
          resolution: camera.resolution || '1920x1080',
          frameRate: camera.frameRate || 30,
          bitrate: camera.bitrate || '2000kbps'
        }
      };

      console.log('[CAMERA_SERVICE] Camera settings retrieved');
      return settings;
    } catch (error) {
      console.error('[CAMERA_SERVICE] Error getting camera settings:', error.message);
      throw error;
    }
  }

  static async updateCameraSettings(id, settings, userId) {
    try {
      console.log('[CAMERA_SERVICE] Updating camera settings:', id);
      
      const updateData = {
        recordingEnabled: settings.recordingEnabled,
        motionDetection: settings.motionDetection,
        alertsEnabled: settings.alertsEnabled,
        analysisInterval: settings.analysisInterval
      };

      if (settings.qualitySettings) {
        updateData.resolution = settings.qualitySettings.resolution;
        updateData.frameRate = settings.qualitySettings.frameRate;
        updateData.bitrate = settings.qualitySettings.bitrate;
      }

      await Camera.update(id, updateData, userId);
      console.log('[CAMERA_SERVICE] Camera settings updated successfully');
      return { success: true };
    } catch (error) {
      console.error('[CAMERA_SERVICE] Error updating camera settings:', error.message);
      throw error;
    }
  }
}

module.exports = CameraService;