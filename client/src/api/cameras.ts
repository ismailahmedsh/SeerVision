import api from './api';

// Description: Get all cameras
// Endpoint: GET /api/cameras
// Request: {}
// Response: { cameras: Array<{ _id: string, name: string, type: string, streamUrl: string, status: 'connected' | 'disconnected', lastSeen?: string }> }
export const getCameras = async () => {
  try {
    console.log('[CAMERAS_API] ===== GET CAMERAS API START =====')
    console.log('[CAMERAS_API] Making request to /api/cameras')
    console.log('[CAMERAS_API] Request timestamp:', new Date().toISOString())
    console.log('[CAMERAS_API] Auth token exists:', !!localStorage.getItem('accessToken'))
    console.log('[CAMERAS_API] Auth token preview:', localStorage.getItem('accessToken')?.substring(0, 20) + '...')

    const response = await api.get('/api/cameras');

    console.log('[CAMERAS_API] ===== GET CAMERAS API RESPONSE =====')
    console.log('[CAMERAS_API] Response received at:', new Date().toISOString())
    console.log('[CAMERAS_API] Response status:', response.status)
    console.log('[CAMERAS_API] Response status text:', response.statusText)
    console.log('[CAMERAS_API] Response headers:', response.headers)
    console.log('[CAMERAS_API] Response data type:', typeof response.data)
    console.log('[CAMERAS_API] Response data keys:', Object.keys(response.data || {}))
    console.log('[CAMERAS_API] Full response data:', JSON.stringify(response.data, null, 2))
    console.log('[CAMERAS_API] Number of cameras:', response.data?.cameras?.length || 0)

    if (response.data?.cameras) {
      console.log('[CAMERAS_API] Cameras array validation:')
      console.log('[CAMERAS_API] - Is array:', Array.isArray(response.data.cameras))
      console.log('[CAMERAS_API] - Length:', response.data.cameras.length)
      
      response.data.cameras.forEach((camera, index) => {
        console.log(`[CAMERAS_API] Camera ${index} validation:`, {
          hasId: !!camera._id,
          hasName: !!camera.name,
          hasType: !!camera.type,
          hasStreamUrl: !!camera.streamUrl,
          hasStatus: !!camera.status,
          id: camera._id,
          name: camera.name,
          type: camera.type,
          status: camera.status
        })
      })
    }

    console.log('[CAMERAS_API] ===== GET CAMERAS API SUCCESS =====')
    return response.data;
  } catch (error) {
    console.error('[CAMERAS_API] ===== GET CAMERAS API ERROR =====')
    console.error('[CAMERAS_API] Error timestamp:', new Date().toISOString())
    console.error('[CAMERAS_API] Error type:', error.constructor.name)
    console.error('[CAMERAS_API] Error message:', error.message)
    console.error('[CAMERAS_API] Error code:', error.code)
    console.error('[CAMERAS_API] Error stack:', error.stack)
    
    if (error.response) {
      console.error('[CAMERAS_API] Response error details:')
      console.error('[CAMERAS_API] - Status:', error.response.status)
      console.error('[CAMERAS_API] - Status text:', error.response.statusText)
      console.error('[CAMERAS_API] - Headers:', error.response.headers)
      console.error('[CAMERAS_API] - Data:', error.response.data)
    } else if (error.request) {
      console.error('[CAMERAS_API] Request error details:')
      console.error('[CAMERAS_API] - Request:', error.request)
    } else {
      console.error('[CAMERAS_API] Setup error:', error.message)
    }

    throw new Error(error?.response?.data?.error || error.message);
  }
}

// Description: Add a new camera
// Endpoint: POST /api/cameras
// Request: { name: string, type: string, streamUrl: string }
// Response: { success: boolean, message: string, camera: { _id: string, name: string, type: string, streamUrl: string, status: string } }
export const addCamera = async (data: { name: string; type: string; streamUrl: string }) => {
  try {
    console.log('[CAMERAS_API] Adding camera with data:', data)
    const response = await api.post('/api/cameras', data);
    console.log('[CAMERAS_API] Add camera response:', response.data)
    return response.data;
  } catch (error) {
    console.error('[CAMERAS_API] Error adding camera:', error)
    console.error('[CAMERAS_API] Error response:', error?.response?.data)
    throw new Error(error?.response?.data?.error || error.message);
  }
}

// Description: Test camera connection
// Endpoint: POST /api/cameras/test
// Request: { streamUrl: string, type: string }
// Response: { success: boolean, message: string }
export const testCameraConnection = async (data: { streamUrl: string; type: string }) => {
  try {
    console.log('[CAMERAS_API] Testing camera connection with data:', data)
    const response = await api.post('/api/cameras/test', data);
    console.log('[CAMERAS_API] Test connection response:', response.data)
    return response.data;
  } catch (error) {
    console.error('[CAMERAS_API] Error testing connection:', error)
    console.error('[CAMERAS_API] Error response:', error?.response?.data)
    throw new Error(error?.response?.data?.error || error.message);
  }
}

// Description: Delete a camera
// Endpoint: DELETE /api/cameras/:id
// Request: { id: string }
// Response: { success: boolean, message: string }
export const deleteCamera = async (id: string) => {
  try {
    console.log('[CAMERAS_API] Deleting camera with id:', id)
    const response = await api.delete(`/api/cameras/${id}`);
    console.log('[CAMERAS_API] Delete camera response:', response.data)
    return response.data;
  } catch (error) {
    console.error('[CAMERAS_API] Error deleting camera:', error)
    console.error('[CAMERAS_API] Error response:', error?.response?.data)
    throw new Error(error?.response?.data?.error || error.message);
  }
}

// Description: Update camera settings
// Endpoint: PUT /api/cameras/:id
// Request: { id: string, name?: string, type?: string, streamUrl?: string }
// Response: { success: boolean, message: string, camera: object }
export const updateCamera = async (id: string, data: { name?: string; type?: string; streamUrl?: string }) => {
  try {
    console.log('[CAMERAS_API] Updating camera with id:', id, 'data:', data)
    const response = await api.put(`/api/cameras/${id}`, data);
    console.log('[CAMERAS_API] Update camera response:', response.data)
    return response.data;
  } catch (error) {
    console.error('[CAMERAS_API] Error updating camera:', error)
    console.error('[CAMERAS_API] Error response:', error?.response?.data)
    throw new Error(error?.response?.data?.error || error.message);
  }
}

// Description: Get camera settings
// Endpoint: GET /api/cameras/:id/settings
// Request: { id: string }
// Response: { settings: { name: string, streamUrl: string, type: string, recordingEnabled: boolean, motionDetection: boolean, alertsEnabled: boolean, analysisInterval: number, qualitySettings: { resolution: string, frameRate: number, bitrate: string } } }
export const getCameraSettings = async (id: string) => {
  try {
    console.log('[CAMERAS_API] Getting camera settings for id:', id)
    const response = await api.get(`/api/cameras/${id}/settings`);
    console.log('[CAMERAS_API] Get camera settings response:', response.data)
    return response.data;
  } catch (error) {
    console.error('[CAMERAS_API] Error getting camera settings:', error)
    console.error('[CAMERAS_API] Error response:', error?.response?.data)
    throw new Error(error?.response?.data?.error || error.message);
  }
}

// Description: Update camera settings
// Endpoint: PUT /api/cameras/:id/settings
// Request: { id: string, settings: object }
// Response: { success: boolean, message: string }
export const updateCameraSettings = async (id: string, settings: any) => {
  try {
    console.log('[CAMERAS_API] Updating camera settings for id:', id, 'settings:', settings)
    const response = await api.put(`/api/cameras/${id}/settings`, { settings });
    console.log('[CAMERAS_API] Update camera settings response:', response.data)
    return response.data;
  } catch (error) {
    console.error('[CAMERAS_API] Error updating camera settings:', error)
    console.error('[CAMERAS_API] Error response:', error?.response?.data)
    throw new Error(error?.response?.data?.error || error.message);
  }
}