import api from './api';

// Description: Get analytics data
// Endpoint: GET /api/analytics
// Request: { timeRange?: string }
// Response: { data: { totalDetections: number, averageConfidence: number, mostActiveCamera: string, topQueries: Array<{ query: string, count: number }>, dailyStats: Array<{ date: string, detections: number }>, cameraStats: Array<{ cameraId: string, name: string, detections: number }> } }
export const getAnalyticsData = async (params?: { timeRange?: string }) => {
  try {
    const queryParams = new URLSearchParams();
    if (params?.timeRange) queryParams.append('timeRange', params.timeRange);
    
    const response = await api.get(`/api/analytics?${queryParams}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching analytics data:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get analytics summary for a specific time range
// Endpoint: GET /api/analytics/summary
// Request: { from: string, to: string, cameraId?: string }
// Response: { data: { totalDetections: number, averageConfidence: number, activeCameras: number, dailyAverage: number } }
export const getAnalyticsSummary = async (params: { from: string; to: string; cameraId?: string }) => {
  try {
    const queryParams = new URLSearchParams();
    queryParams.append('from', params.from);
    queryParams.append('to', params.to);
    if (params.cameraId) queryParams.append('cameraId', params.cameraId);
    
    const response = await api.get(`/api/analytics/summary?${queryParams}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching analytics summary:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get top queries for a specific time range
// Endpoint: GET /api/analytics/top-queries
// Request: { from: string, to: string, limit?: number }
// Response: { data: Array<{ query: string, count: number, confidence: number }> }
export const getTopQueries = async (params: { from: string; to: string; limit?: number }) => {
  try {
    const queryParams = new URLSearchParams();
    queryParams.append('from', params.from);
    queryParams.append('to', params.to);
    if (params.limit) queryParams.append('limit', params.limit.toString());
    
    const response = await api.get(`/api/analytics/top-queries?${queryParams}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching top queries:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get camera performance for a specific time range
// Endpoint: GET /api/analytics/camera-performance
// Request: { from: string, to: string }
// Response: { data: Array<{ cameraId: string, name: string, detections: number, confidence: number }> }
export const getCameraPerformance = async (params: { from: string; to: string }) => {
  try {
    const queryParams = new URLSearchParams();
    queryParams.append('from', params.from);
    queryParams.append('to', params.to);
    
    const response = await api.get(`/api/analytics/camera-performance?${queryParams}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching camera performance:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get detections timeseries data
// Endpoint: GET /api/analytics/timeseries/detections
// Request: { timeRange?: string, from?: string, to?: string }
// Response: { data: { points: Array<{ t: string, detections: number }> } }
export const getDetectionsTimeseries = async (params?: { timeRange?: string; from?: string; to?: string }) => {
  try {
    const queryParams = new URLSearchParams();
    if (params?.timeRange) queryParams.append('timeRange', params.timeRange);
    if (params?.from) queryParams.append('from', params.from);
    if (params?.to) queryParams.append('to', params.to);
    
    const response = await api.get(`/api/analytics/timeseries/detections?${queryParams}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching detections timeseries:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get confidence timeseries data
// Endpoint: GET /api/analytics/timeseries/confidence
// Request: { timeRange?: string, from?: string, to?: string }
// Response: { data: { points: Array<{ t: string, avgConfidence: number }> } }
export const getConfidenceTimeseries = async (params?: { timeRange?: string; from?: string; to?: string }) => {
  try {
    const queryParams = new URLSearchParams();
    if (params?.timeRange) queryParams.append('timeRange', params.timeRange);
    if (params?.from) queryParams.append('from', params.from);
    if (params?.to) queryParams.append('to', params.to);
    
    const response = await api.get(`/api/analytics/timeseries/confidence?${queryParams}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching confidence timeseries:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};