import api from './api';

// Description: Get user settings
// Endpoint: GET /api/settings
// Request: {}
// Response: { settings: { profile: { name: string, email: string }, analysis: { defaultInterval: number } } }
export const getSettings = () => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        settings: {
          profile: {
            name: '',
            email: 'john.doe@example.com'
          },
          analysis: {
            defaultInterval: 10
          }
        }
      });
    }, 400);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   return await api.get('/api/settings');
  // } catch (error) {
  //   throw new Error(error?.response?.data?.error || error.message);
  // }
}

// Description: Update user settings
// Endpoint: PUT /api/users/profile
// Request: { name: string }
// Response: { success: boolean, message: string }
export const updateSettings = async (settings: any) => {
  try {
    // If updating profile name, call the user profile endpoint
    if (settings.profile?.name !== undefined) {
      console.log('Updating profile name to:', settings.profile.name);
      const response = await api.put('/api/users/profile', { name: settings.profile.name });
      return response.data;
    }
    
    // For other settings like analysis interval, we'll keep the mock for now
    if (settings.analysis?.defaultInterval) {
      console.log('Updating analysis interval to:', settings.analysis.defaultInterval);
    }
    
    return {
      success: true,
      message: 'Settings updated successfully'
    };
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
}