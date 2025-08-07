import api from './api';

export const startAnalysisStream = async (data: { cameraId: string; prompt: string; analysisInterval?: number; frameBase64?: string; jsonOption?: boolean }) => {
  try {
    return await api.post('/api/video-analysis/stream', data);
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
}

export const stopAnalysisStream = async (streamId: string) => {
  try {
    const response = await api.delete(`/api/video-analysis/stream/${streamId}`);
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
}

export const queryAnalysisResults = async (data: { streamId: string; query: string; limit?: number }) => {
  try {
    return await api.post('/api/video-analysis/query', data);
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
}

export const getPromptSuggestions = async (cameraId: string, frameBase64?: string, camera?: any) => {
  try {
    console.log('[API] ===== GET PROMPT SUGGESTIONS START =====')
    console.log('[API] getPromptSuggestions called with:', {
      cameraId,
      hasFrameBase64: !!frameBase64,
      frameBase64Length: frameBase64?.length || 0,
      camera: camera ? { type: camera.type, streamUrl: camera.streamUrl } : null
    });

    const isUSBCamera = camera && (
      camera.type === 'usb' ||
      camera.streamUrl?.startsWith('usb:')
    );

    console.log('[API] isUSBCamera:', isUSBCamera);

    // For USB cameras or when frame data is provided, use POST with frame data
    if (frameBase64 && frameBase64.length > 1000) {
      console.log('[API] Sending POST request with frame data, size:', frameBase64.length);

      // Simplified payload - only send image_b64 field
      const requestData = {
        image_b64: frameBase64
      };

      const endpoint = `/api/video-analysis/suggestions/${cameraId}`;
      console.log('[API] POST endpoint:', endpoint);
      console.log('[API] Request payload structure:', {
        hasImageB64: !!requestData.image_b64,
        frameSize: requestData.image_b64?.length || 0
      });

      console.log('[API] Making POST request...');
      const startTime = Date.now();

      const response = await api.post(endpoint, requestData);

      const endTime = Date.now();
      console.log('[API] POST response received in', (endTime - startTime), 'ms');
      console.log('[API] POST response data:', response.data);
      console.log('[API] ===== GET PROMPT SUGGESTIONS SUCCESS =====');
      return response;
    } else if (isUSBCamera) {
      // USB camera but no valid frame data
      console.log('[API] USB camera detected but no valid frame data, frameBase64 length:', frameBase64?.length || 0);
      console.log('[API] ===== GET PROMPT SUGGESTIONS ERROR - NO FRAME DATA =====');
      throw new Error('USB cameras require valid frame data for suggestions');
    } else {
      // Non-USB camera, use GET request
      const endpoint = `/api/video-analysis/suggestions/${cameraId}`;
      console.log('[API] GET endpoint:', endpoint);
      console.log('[API] Making GET request...');
      const startTime = Date.now();

      const response = await api.get(endpoint);

      const endTime = Date.now();
      console.log('[API] GET response received in', (endTime - startTime), 'ms');
      console.log('[API] GET response data:', response.data);
      console.log('[API] ===== GET PROMPT SUGGESTIONS SUCCESS =====');
      return response;
    }
  } catch (error) {
    console.error('[API] ===== GET PROMPT SUGGESTIONS ERROR =====');
    console.error('[API] getPromptSuggestions error:', error);
    console.error('[API] Error type:', error.constructor.name);
    console.error('[API] Error message:', error.message);
    console.error('[API] Error code:', error.code);
    console.error('[API] Error response status:', error?.response?.status);
    console.error('[API] Error response data:', error?.response?.data);
    console.error('[API] Error config:', error?.config ? {
      method: error.config.method,
      url: error.config.url,
      timeout: error.config.timeout,
      baseURL: error.config.baseURL
    } : 'No config');
    throw new Error(error?.response?.data?.error || error.message);
  }
}

export const sendFrameForAnalysis = async (data: { streamId: string; frameBase64: string; prompt: string; jsonOption?: boolean }) => {
  try {
    return await api.post('/api/video-analysis/frame', data);
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
}

export const analyzePrompt = (data: { prompt: string; cameraId?: string }) => {
  return Promise.resolve({
    success: false,
    result: "This function has been replaced with real-time streaming analysis. Please use the new analysis system.",
    confidence: 0,
    timestamp: new Date().toISOString()
  });
}

export const getAnalysisHistory = (params?: { limit?: number; cameraId?: string }) => {
  return Promise.resolve({
    history: []
  });
}

export const stopAnalysis = (data: { cameraId: string }) => {
  return Promise.resolve({
    success: true,
    message: 'Please use the new streaming analysis system'
  });
}

export const getAnalysisStatus = (cameraId: string) => {
  return Promise.resolve({
    isActive: false,
    currentPrompt: null,
    lastUpdate: null
  });
}