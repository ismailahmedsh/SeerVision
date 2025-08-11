import api from './api';

// Description: Get all cameras for the current user
// Endpoint: GET /api/cameras
// Request: {}
// Response: { cameras: Array<{ _id: string, name: string, type: string, streamUrl: string, status: string, analysisInterval: number, memory: boolean }> }
export const getCameras = async () => {
  console.log('[CAMERAS_API] Getting cameras')


  try {

    const response = await api.get('/api/cameras');
    console.log('[CAMERAS_API] API response received');
    console.log('[CAMERAS_API] Cameras retrieved successfully')
    return response.data;
  } catch (error) {
          console.error('[CAMERAS_API] Error getting cameras')
    console.error('[CAMERAS_API] Error details:', error.message);



          console.error('[CAMERAS_API] End get cameras API error')
    throw new Error(error?.response?.data?.error || error.message);
  }
}

// Description: Add a new camera
// Endpoint: POST /api/cameras
// Request: { name: string, type: string, streamUrl: string }
// Response: { success: boolean, camera: object }
export const addCamera = async (data: { name: string; type: string; streamUrl: string }) => {
  try {
    console.log('[CAMERAS_API] Adding camera:', data)
    const response = await api.post('/api/cameras', data);
    console.log('[CAMERAS_API] Camera added successfully');
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
    console.log('[CAMERAS_API] Testing camera connection:', data)
    const response = await api.post('/api/cameras/test', data);
    console.log('[CAMERAS_API] Connection test completed');
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
    console.log('[CAMERAS_API] Deleting camera with ID:', id)
    const response = await api.delete(`/api/cameras/${id}`);
    console.log('[CAMERAS_API] Camera deleted successfully');
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
    console.log('[CAMERAS_API] Updating camera:', id, data)
    const response = await api.put(`/api/cameras/${id}`, data);
    console.log('[CAMERAS_API] Update camera response:', response.data)
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
    console.log('[CAMERAS_API] Getting camera settings for ID:', id)
    const response = await api.get(`/api/cameras/${id}/settings`);
    console.log('[CAMERAS_API] Get settings response:', response.data)
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
    console.log('[CAMERAS_API] Updating camera settings for ID:', id, settings)
    const response = await api.put(`/api/cameras/${id}/settings`, { settings });
    console.log('[CAMERAS_API] Update settings response:', response.data)
    return response.data;
  } catch (error) {
    console.error('[CAMERAS_API] Update settings error:', error)
    throw new Error(error?.response?.data?.error || error.message);
  }
}