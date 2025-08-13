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
            name: 'John Doe',
            email: 'john.doe@example.com'
          },
          analysis: {
            defaultInterval: 6
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
// Endpoint: PUT /api/settings
// Request: { settings: object }
// Response: { success: boolean, message: string }
export const updateSettings = (settings: any) => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      // Update the mock settings with the new values
      if (settings.profile?.name) {
        // In a real app, this would update the user's name in the database
        console.log('Updating profile name to:', settings.profile.name);
      }
      if (settings.analysis?.defaultInterval) {
        // In a real app, this would update the analysis interval in the database
        console.log('Updating analysis interval to:', settings.analysis.defaultInterval);
      }
      
      resolve({
        success: true,
        message: 'Settings updated successfully'
      });
    }, 800);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   return await api.put('/api/settings', { settings });
  // } catch (error) {
  //   throw new Error(error?.response?.data?.error || error.message);
  // }
}