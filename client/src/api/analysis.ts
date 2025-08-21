import api from './api';
import { smartRetry, isRetryableError } from '../lib/retryUtils';

export const startAnalysisStream = async (data: { cameraId: string; prompt: string; analysisInterval?: number; frameBase64?: string; jsonOption?: boolean; memory?: boolean }) => {
  try {
    return await api.post('/api/video-analysis/stream', data);
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
}

export const stopAnalysisStream = async (streamId: string) => {
  try {
    const response = await api.delete(`/api/video-analysis/stream/${streamId}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
}

export const queryAnalysisResults = async (data: { streamId: string; query: string; limit?: number }) => {
  try {
    return await api.post('/api/video-analysis/query', data);
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
}

export const getPromptSuggestions = async (cameraId: string, frameBase64?: string, camera?: any) => {
  const requestKey = `suggestions-${cameraId}-${Date.now()}`;
  
  return smartRetry(requestKey, async (signal) => {
    try {
      const isUSBCamera = camera && (
        camera.type === 'usb' ||
        camera.streamUrl?.startsWith('usb:')
      );

      if (frameBase64 && frameBase64.length > 1000) {
        const requestData = {
          image_b64: frameBase64
        };

        const endpoint = `/api/video-analysis/suggestions/${cameraId}`;
        const response = await api.post(endpoint, requestData, { signal });
        return response;
      } else if (isUSBCamera) {
        throw new Error('USB cameras require valid frame data for suggestions');
      } else {
        const endpoint = `/api/video-analysis/suggestions/${cameraId}`;
        const response = await api.get(endpoint, { signal });
        return response;
      }
    } catch (error: any) {
      throw error;
    }
  }, {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 5000,
    jitter: true
  });
}

export const sendFrameForAnalysis = async (data: { streamId: string; frameBase64: string; prompt: string; jsonOption?: boolean; memory?: boolean }) => {
  try {
    return await api.post('/api/video-analysis/frame', data);
  } catch (error: any) {
    if (error.response?.status === 404) {
      throw new Error('Frame analysis endpoint not found. Please check server configuration.');
    }
    
    if (error.response?.status >= 400 && error.response?.status < 500) {
      throw new Error(error?.response?.data?.error || `Client error: ${error.response?.status} ${error.response?.statusText}`);
    }
    
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