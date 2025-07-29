import api from './api';

export const startAnalysisStream = async (data: { cameraId: string; prompt: string; analysisInterval?: number; frameBase64?: string }) => {
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
    const isUSBCamera = camera && (
      camera.type === 'usb' ||
      camera.streamUrl?.startsWith('usb:')
    );

    if (frameBase64 || isUSBCamera) {
      const requestData = frameBase64 ? { frameBase64 } : {};
      const response = await api.post(`/api/video-analysis/suggestions/${cameraId}`, requestData);
      return response;
    } else {
      const response = await api.get(`/api/video-analysis/suggestions/${cameraId}`);
      return response;
    }
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
}

export const sendFrameForAnalysis = async (data: { streamId: string; frameBase64: string; prompt: string }) => {
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