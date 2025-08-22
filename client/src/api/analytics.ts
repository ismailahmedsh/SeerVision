import api from './api';

export const getAnalyticsData = async (params?: { timeRange?: string }) => {
  try {
    const queryParams = new URLSearchParams();
    if (params?.timeRange) queryParams.append('timeRange', params.timeRange);
    
    const response = await api.get(`/api/analytics?${queryParams}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

export const getAnalyticsSummary = async (params: { from: string; to: string; cameraId?: string }) => {
  try {
    const queryParams = new URLSearchParams();
    queryParams.append('from', params.from);
    queryParams.append('to', params.to);
    if (params.cameraId) queryParams.append('cameraId', params.cameraId);
    
    const response = await api.get(`/api/analytics/summary?${queryParams}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

export const getTopQueries = async (params: { from: string; to: string; limit?: number }) => {
  try {
    const queryParams = new URLSearchParams();
    queryParams.append('from', params.from);
    queryParams.append('to', params.to);
    if (params.limit) queryParams.append('limit', params.limit.toString());
    
    const response = await api.get(`/api/analytics/top-queries?${queryParams}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

export const getCameraPerformance = async (params: { from: string; to: string }) => {
  try {
    const queryParams = new URLSearchParams();
    queryParams.append('from', params.from);
    queryParams.append('to', params.to);
    
    const response = await api.get(`/api/analytics/camera-performance?${queryParams}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

export const getDetectionsTimeseries = async (params?: { timeRange?: string; from?: string; to?: string }) => {
  try {
    const queryParams = new URLSearchParams();
    if (params?.timeRange) queryParams.append('timeRange', params.timeRange);
    if (params?.from) queryParams.append('from', params.from);
    if (params?.to) queryParams.append('to', params.to);
    
    const response = await api.get(`/api/analytics/timeseries/detections?${queryParams}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

export const getConfidenceTimeseries = async (params?: { timeRange?: string; from?: string; to?: string }) => {
  try {
    const queryParams = new URLSearchParams();
    if (params?.timeRange) queryParams.append('timeRange', params.timeRange);
    if (params?.from) queryParams.append('from', params.from);
    if (params?.to) queryParams.append('to', params.to);
    
    const response = await api.get(`/api/analytics/timeseries/confidence?${queryParams}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};