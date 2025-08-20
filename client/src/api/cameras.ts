import api from './api';

// Simple cache to prevent duplicate API calls
let cameraCache: { data: any; timestamp: number } | null = null
const CACHE_DURATION = 2000 // 2 seconds cache

// Description: Get all cameras for the current user
// Endpoint: GET /api/cameras
// Request: {}
// Response: { cameras: Array<{ _id: string, name: string, type: string, streamUrl: string, status: string, analysisInterval: number, memory: boolean }> }
export const getCameras = async () => {
  // Add stack trace to identify where API call is coming from
  const caller = new Error().stack?.split('\n')[2]?.trim() || 'unknown'


  // Check cache first
  const now = Date.now()
  if (cameraCache && (now - cameraCache.timestamp) < CACHE_DURATION) {

    return cameraCache.data
  }

  try {

    const response = await api.get('/api/cameras');

    
    // Cache the response
    cameraCache = {
      data: response.data,
      timestamp: now
    }
    
    return response.data;
  } catch (error) {
    console.error('[CAMERAS_API] Error getting cameras')
    console.error('[CAMERAS_API] Error details:', error.message);
    console.error('[CAMERAS_API] End get cameras API error')
    throw new Error(error?.response?.data?.error || error.message);
  }
}

// Function to invalidate cache when cameras are updated
export const invalidateCameraCache = () => {

  cameraCache = null
}

// Description: Add a new camera
// Endpoint: POST /api/cameras
// Request: { name: string, type: string, streamUrl: string }
// Response: { success: boolean, camera: object }
export const addCamera = async (data: { name: string; type: string; streamUrl: string }) => {
  try {

    const response = await api.post('/api/cameras', data);

    invalidateCameraCache(); // Invalidate cache when camera is added
    return response.data;
  } catch (error) {
    console.error('[CAMERAS_API] Add camera error:', error)
    throw new Error(error?.response?.data?.error || error.message);
  }
}

// Description: Test camera connection
// Endpoint: POST /api/cameras/test
// Request: { streamUrl: string, type: string }
// Response: { success: boolean, message: string }
export const testCameraConnection = async (data: { streamUrl: string; type: string }) => {
  try {

    const response = await api.post('/api/cameras/test', data);

    return response.data;
  } catch (error) {
    console.error('[CAMERAS_API] Test connection error:', error)
    throw new Error(error?.response?.data?.error || error.message);
  }
}

// Description: Delete a camera
// Endpoint: DELETE /api/cameras/:id
// Request: { id: string }
// Response: { success: boolean, message: string }
export const deleteCamera = async (id: string) => {
  try {

    const response = await api.delete(`/api/cameras/${id}`);

    invalidateCameraCache(); // Invalidate cache when camera is deleted
    return response.data;
  } catch (error) {
    console.error('[CAMERAS_API] Delete camera error:', error)
    throw new Error(error?.response?.data?.error || error.message);
  }
}

// Description: Update camera details
// Endpoint: PUT /api/cameras/:id
// Request: { id: string, data: { name?: string, type?: string, streamUrl?: string } }
// Response: { success: boolean, camera: object }
export const updateCamera = async (id: string, data: { name?: string; type?: string; streamUrl?: string }) => {
  try {

    const response = await api.put(`/api/cameras/${id}`, data);

    return response.data;
  } catch (error) {
    console.error('[CAMERAS_API] Update camera error:', error)
    throw new Error(error?.response?.data?.error || error.message);
  }
}

// Description: Get camera settings
// Endpoint: GET /api/cameras/:id/settings
// Request: { id: string }
// Response: { settings: object }
export const getCameraSettings = async (id: string) => {
  try {

    const response = await api.get(`/api/cameras/${id}/settings`);

    return response.data;
  } catch (error) {
    console.error('[CAMERAS_API] Get settings error:', error)
    throw new Error(error?.response?.data?.error || error.message);
  }
}

// Description: Update camera settings
// Endpoint: PUT /api/cameras/:id/settings
// Request: { id: string, settings: object }
// Response: { success: boolean }
export const updateCameraSettings = async (id: string, settings: any) => {
  try {

    const response = await api.put(`/api/cameras/${id}/settings`, { settings });

    invalidateCameraCache(); // Invalidate cache when camera settings are updated
    return response.data;
  } catch (error) {
    console.error('[CAMERAS_API] Update settings error:', error)
    throw new Error(error?.response?.data?.error || error.message);
  }
}