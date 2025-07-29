import api from './api';

// Description: Start video analysis stream
// Endpoint: POST /api/video-analysis/stream
// Request: { cameraId: string, prompt: string, analysisInterval?: number, frameBase64?: string }
// Response: { success: boolean, streamId: string, message: string, analysisInterval: number, cameraName: string }
export const startAnalysisStream = async (data: { cameraId: string; prompt: string; analysisInterval?: number; frameBase64?: string }) => {
  try {
    return await api.post('/api/video-analysis/stream', data);
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
}

// Description: Stop video analysis stream
// Endpoint: DELETE /api/video-analysis/stream/:streamId
// Request: { streamId: string }
// Response: { success: boolean, message: string, streamId: string }
export const stopAnalysisStream = async (streamId: string) => {
  try {
    console.log('[ANALYSIS_API] ===== STOP ANALYSIS STREAM START =====');
    console.log('[ANALYSIS_API] Stopping analysis stream with ID:', streamId);
    console.log('[ANALYSIS_API] Stream ID type:', typeof streamId);
    console.log('[ANALYSIS_API] API call timestamp:', new Date().toISOString());
    console.log('[ANALYSIS_API] Making DELETE request to:', `/api/video-analysis/stream/${streamId}`);
    
    const response = await api.delete(`/api/video-analysis/stream/${streamId}`);
    
    console.log('[ANALYSIS_API] ===== STOP ANALYSIS STREAM RESPONSE =====');
    console.log('[ANALYSIS_API] Response received at:', new Date().toISOString());
    console.log('[ANALYSIS_API] Response status:', response.status);
    console.log('[ANALYSIS_API] Response data:', response.data);
    console.log('[ANALYSIS_API] Stop analysis successful');
    
    return response.data;
  } catch (error) {
    console.error('[ANALYSIS_API] ===== STOP ANALYSIS STREAM ERROR =====');
    console.error('[ANALYSIS_API] Error stopping analysis stream:', error);
    console.error('[ANALYSIS_API] Error type:', error.constructor.name);
    console.error('[ANALYSIS_API] Error message:', error.message);
    console.error('[ANALYSIS_API] Error response:', error.response);
    console.error('[ANALYSIS_API] Error response status:', error.response?.status);
    console.error('[ANALYSIS_API] Error response data:', error.response?.data);
    
    throw new Error(error?.response?.data?.error || error.message);
  }
}

// Description: Query analysis results
// Endpoint: POST /api/video-analysis/query
// Request: { streamId: string, query: string, limit?: number }
// Response: { success: boolean, query: string, streamId: string, matchedElements: Array, totalMatches: number }
export const queryAnalysisResults = async (data: { streamId: string; query: string; limit?: number }) => {
  try {
    return await api.post('/api/video-analysis/query', data);
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
}

// Description: Get dynamic prompt suggestions
// Endpoint: GET /api/video-analysis/suggestions/:cameraId OR POST /api/video-analysis/suggestions/:cameraId
// Request: { cameraId: string, frameBase64?: string }
// Response: { success: boolean, suggestions: Array<string>, cameraId: string, cameraName: string }
export const getPromptSuggestions = async (cameraId: string, frameBase64?: string, camera?: any) => {
  try {
    console.log('[ANALYSIS_API] ===== GET PROMPT SUGGESTIONS START =====');
    console.log('[ANALYSIS_API] getPromptSuggestions called with:', { cameraId, hasFrame: !!frameBase64 });
    console.log('[ANALYSIS_API] Frame data size:', frameBase64?.length || 0);
    console.log('[ANALYSIS_API] Camera object:', camera);
    console.log('[ANALYSIS_API] Camera type:', camera?.type);
    console.log('[ANALYSIS_API] Camera stream URL:', camera?.streamUrl);
    console.log('[ANALYSIS_API] API call timestamp:', new Date().toISOString());

    // Determine if this is a USB camera
    const isUSBCamera = camera && (
      camera.type === 'usb' || 
      camera.streamUrl?.startsWith('usb:')
    );

    console.log('[ANALYSIS_API] USB camera detected:', isUSBCamera);

    // If frame data is provided OR it's a USB camera, use POST endpoint
    if (frameBase64 || isUSBCamera) {
      console.log('[ANALYSIS_API] Using POST endpoint for USB camera or with frame data');
      console.log('[ANALYSIS_API] Making POST request to:', `/api/video-analysis/suggestions/${cameraId}`);

      const requestData = frameBase64 ? { frameBase64 } : {};
      console.log('[ANALYSIS_API] POST request data:', { hasFrameData: !!frameBase64 });

      const response = await api.post(`/api/video-analysis/suggestions/${cameraId}`, requestData);

      console.log('[ANALYSIS_API] POST response received:', response);
      console.log('[ANALYSIS_API] POST response status:', response.status);
      console.log('[ANALYSIS_API] POST response data:', response.data);

      return response;
    } else {
      console.log('[ANALYSIS_API] Using GET endpoint for non-USB camera without frame data');
      console.log('[ANALYSIS_API] Making GET request to:', `/api/video-analysis/suggestions/${cameraId}`);

      // For non-USB cameras or when no frame is available, use GET endpoint
      const response = await api.get(`/api/video-analysis/suggestions/${cameraId}`);

      console.log('[ANALYSIS_API] GET response received:', response);
      console.log('[ANALYSIS_API] GET response status:', response.status);
      console.log('[ANALYSIS_API] GET response data:', response.data);

      return response;
    }
  } catch (error) {
    console.error('[ANALYSIS_API] ===== GET PROMPT SUGGESTIONS ERROR =====');
    console.error('[ANALYSIS_API] Error in getPromptSuggestions:', error);
    console.error('[ANALYSIS_API] Error type:', error.constructor.name);
    console.error('[ANALYSIS_API] Error message:', error.message);
    console.error('[ANALYSIS_API] Error response:', error.response);
    console.error('[ANALYSIS_API] Error response status:', error.response?.status);
    console.error('[ANALYSIS_API] Error response data:', error.response?.data);

    throw new Error(error?.response?.data?.error || error.message);
  }
}

// Description: Send frame for analysis (USB cameras)
// Endpoint: POST /api/video-analysis/frame
// Request: { streamId: string, frameBase64: string, prompt: string }
// Response: { success: boolean, message: string }
export const sendFrameForAnalysis = async (data: { streamId: string; frameBase64: string; prompt: string }) => {
  try {
    return await api.post('/api/video-analysis/frame', data);
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
}

// Description: Analyze video with natural language prompt (DEPRECATED - use startAnalysisStream instead)
// Endpoint: POST /api/analysis/prompt
// Request: { prompt: string, cameraId?: string }
// Response: { success: boolean, result: string, confidence: number, timestamp: string }
export const analyzePrompt = (data: { prompt: string; cameraId?: string }) => {
  // This function is deprecated in favor of the new streaming analysis
  console.warn('[ANALYSIS_API] analyzePrompt is deprecated, use startAnalysisStream instead');
  
  // Return a promise that resolves with a deprecation message
  return Promise.resolve({
    success: false,
    result: "This function has been replaced with real-time streaming analysis. Please use the new analysis system.",
    confidence: 0,
    timestamp: new Date().toISOString()
  });
}

// Description: Get analysis history (DEPRECATED - use queryAnalysisResults instead)
// Endpoint: GET /api/analysis/history
// Request: { limit?: number, cameraId?: string }
// Response: { history: Array<{ _id: string, prompt: string, result: string, timestamp: string, confidence: number, cameraId?: string }> }
export const getAnalysisHistory = (params?: { limit?: number; cameraId?: string }) => {
  // This function is deprecated in favor of the new query system
  console.warn('[ANALYSIS_API] getAnalysisHistory is deprecated, use queryAnalysisResults instead');
  
  return Promise.resolve({
    history: []
  });
}

// Description: Stop analysis for a camera (DEPRECATED - use stopAnalysisStream instead)
// Endpoint: POST /api/analysis/stop
// Request: { cameraId: string }
// Response: { success: boolean, message: string }
export const stopAnalysis = (data: { cameraId: string }) => {
  // This function is deprecated
  console.warn('[ANALYSIS_API] stopAnalysis is deprecated, use stopAnalysisStream instead');
  
  return Promise.resolve({
    success: true,
    message: 'Please use the new streaming analysis system'
  });
}

// Description: Get real-time analysis status (DEPRECATED)
// Endpoint: GET /api/analysis/status/:cameraId
// Request: { cameraId: string }
// Response: { isActive: boolean, currentPrompt?: string, lastUpdate?: string }
export const getAnalysisStatus = (cameraId: string) => {
  // This function is deprecated
  console.warn('[ANALYSIS_API] getAnalysisStatus is deprecated');
  
  return Promise.resolve({
    isActive: false,
    currentPrompt: null,
    lastUpdate: null
  });
}