import api from './api';

let cameraCache: { data: any; timestamp: number } | null = null
const CACHE_DURATION = 2000

export const getCameras = async () => {
  const now = Date.now()
  if (cameraCache && (now - cameraCache.timestamp) < CACHE_DURATION) {
    return cameraCache.data
  }

  try {
    const response = await api.get('/api/cameras');
    
    cameraCache = {
      data: response.data,
      timestamp: now
    }
    
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
}

export const invalidateCameraCache = () => {
  cameraCache = null
}

export const addCamera = async (data: { name: string; type: string; streamUrl: string; defaultInterval?: number }) => {
  try {
    const response = await api.post('/api/cameras', data);
    invalidateCameraCache();
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
}

export const testCameraConnection = async (data: { streamUrl: string; type: string }) => {
  try {
    const response = await api.post('/api/cameras/test', data);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
}

export const deleteCamera = async (id: string) => {
  try {
    const response = await api.delete(`/api/cameras/${id}`);
    invalidateCameraCache();
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
}

export const updateCamera = async (id: string, data: { name?: string; type?: string; streamUrl?: string }) => {
  try {
    const response = await api.put(`/api/cameras/${id}`, data);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
}

export const getCameraSettings = async (id: string) => {
  try {
    const response = await api.get(`/api/cameras/${id}/settings`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
}

export const updateCameraSettings = async (id: string, settings: any) => {
  try {
    const response = await api.put(`/api/cameras/${id}/settings`, { settings });
    invalidateCameraCache();
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
}