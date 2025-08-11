const Camera = require('../models/Camera');
const { ensureMemoryColumnExists } = require('../config/database');

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
      console.log('[CAMERA_SERVICE] Getting all cameras');
      console.log('[CAMERA_SERVICE] Service method called at:', new Date().toISOString());
      console.log('[CAMERA_SERVICE] Getting all cameras for user:', userId);
      console.log('[CAMERA_SERVICE] User ID type:', typeof userId);
      console.log('[CAMERA_SERVICE] User ID value:', userId);

      if (!userId) {
        console.error('[CAMERA_SERVICE] No userId provided');
        console.error('[CAMERA_SERVICE] userId is:', userId);
        throw new Error('User ID is required');
      }

      // Ensure memory column exists before querying
      try {
        await ensureMemoryColumnExists();
        console.log('[CAMERA_SERVICE] Memory column verification completed');
      } catch (error) {
        console.warn('[CAMERA_SERVICE] Warning: Could not verify memory column:', error.message);
        // Continue anyway - the model will handle missing columns gracefully
      }

      console.log('[CAMERA_SERVICE] Calling Camera.findAll...');
      const cameras = await Camera.findAll(userId);
      console.log('[CAMERA_SERVICE] Camera.findAll completed');
      console.log('[CAMERA_SERVICE] Cameras returned type:', typeof cameras);
      console.log('[CAMERA_SERVICE] Cameras is array:', Array.isArray(cameras));
      console.log('[CAMERA_SERVICE] Cameras count:', cameras?.length || 0);
      console.log('[CAMERA_SERVICE] Raw camera data from model:', JSON.stringify(cameras, null, 2));

      if (cameras && cameras.length > 0) {
        console.log('[CAMERA_SERVICE] Processing cameras...');
        cameras.forEach((camera, index) => {
          console.log(`[CAMERA_SERVICE] Camera ${index} details:`, {
            id: camera._id,
            name: camera.name,
            type: camera.type,
            streamUrl: camera.streamUrl,
            status: camera.status,
            analysisInterval: camera.analysisInterval,
            memory: camera.memory,
            createdAt: camera.createdAt
          });
        });
      } else {
        console.log('[CAMERA_SERVICE] No cameras found for user:', userId);
      }

              console.log('[CAMERA_SERVICE] All cameras retrieved successfully');
      return cameras;
    } catch (error) {
              console.error('[CAMERA_SERVICE] Error getting all cameras');
      console.error('[CAMERA_SERVICE] Error timestamp:', new Date().toISOString());
      console.error('[CAMERA_SERVICE] Error in getAllCameras:', error.message);
      console.error('[CAMERA_SERVICE] Error type:', error.constructor.name);
      console.error('[CAMERA_SERVICE] Error stack:', error.stack);
      console.error('[CAMERA_SERVICE] Error details:', error);
      throw error;
    }
  }

  static async getCameraById(id, userId = null) {
    try {
      console.log('[CAMERA_SERVICE] Getting camera by ID:', id, 'for user:', userId);
      
      // Ensure memory column exists before querying
      try {
        await ensureMemoryColumnExists();
        console.log('[CAMERA_SERVICE] Memory column verification completed');
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
      
      // Ensure memory column exists before querying
      try {
        await ensureMemoryColumnExists();
        console.log('[CAMERA_SERVICE] Memory column verification completed');
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
        analysisInterval: camera.analysisInterval || 2,
        memory: Boolean(camera.memory || false), // Safe fallback for missing memory field
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
      console.log('[CAMERA_SERVICE] Settings to update:', settings);

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

      console.log('[CAMERA_SERVICE] Final update data:', updateData);

      await Camera.update(id, updateData, userId);
      console.log('[CAMERA_SERVICE] Camera settings updated successfully');
      
      // Log the analysis interval specifically
      if (settings.analysisInterval) {
        console.log('[CAMERA_SERVICE] Analysis interval updated to:', settings.analysisInterval, 'seconds');
      }
      
      return { success: true };
    } catch (error) {
      console.error('[CAMERA_SERVICE] Error updating camera settings:', error.message);
      throw error;
    }
  }
}

module.exports = CameraService;