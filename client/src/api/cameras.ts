import api from './api';

export const getCameras = async () => {
  try {
    const response = await api.get('/api/cameras');
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
}

export const addCamera = async (data: { name: string; type: string; streamUrl: string }) => {
  try {
    const response = await api.post('/api/cameras', data);
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
}

export const testCameraConnection = async (data: { streamUrl: string; type: string }) => {
  try {
    const response = await api.post('/api/cameras/test', data);
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
}

export const deleteCamera = async (id: string) => {
  try {
    const response = await api.delete(`/api/cameras/${id}`);
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
}

export const updateCamera = async (id: string, data: { name?: string; type?: string; streamUrl?: string }) => {
  try {
    const response = await api.put(`/api/cameras/${id}`, data);
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
}

export const getCameraSettings = async (id: string) => {
  try {
    const response = await api.get(`/api/cameras/${id}/settings`);
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
}

export const updateCameraSettings = async (id: string, settings: any) => {
  try {
    const response = await api.put(`/api/cameras/${id}/settings`, { settings });
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
}