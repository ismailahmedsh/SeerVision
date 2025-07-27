import api from './api';

// Description: Analyze video with natural language prompt
// Endpoint: POST /api/analysis/prompt
// Request: { prompt: string, cameraId?: string }
// Response: { success: boolean, result: string, confidence: number, timestamp: string }
export const analyzePrompt = (data: { prompt: string; cameraId?: string }) => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      // Generate realistic mock responses based on prompt
      const prompt = data.prompt.toLowerCase();
      let result = "No objects detected";
      let confidence = 0.85;

      if (prompt.includes('car') || prompt.includes('vehicle')) {
        const count = Math.floor(Math.random() * 8) + 1;
        if (prompt.includes('red')) {
          result = `I found ${count} red car${count > 1 ? 's' : ''}`;
        } else {
          result = `I found ${count} car${count > 1 ? 's' : ''}`;
        }
        confidence = 0.92;
      } else if (prompt.includes('people') || prompt.includes('person')) {
        const count = Math.floor(Math.random() * 5) + 1;
        result = `I found ${count} person${count > 1 ? 's' : ''}`;
        confidence = 0.88;
      } else if (prompt.includes('truck')) {
        const count = Math.floor(Math.random() * 3) + 1;
        result = `I found ${count} truck${count > 1 ? 's' : ''}`;
        confidence = 0.90;
      } else if (prompt.includes('bicycle') || prompt.includes('bike')) {
        const count = Math.floor(Math.random() * 4) + 1;
        result = `I found ${count} bicycle${count > 1 ? 's' : ''}`;
        confidence = 0.86;
      } else if (prompt.includes('mask')) {
        const count = Math.floor(Math.random() * 3) + 1;
        result = `I found ${count} person${count > 1 ? 's' : ''} wearing mask${count > 1 ? 's' : ''}`;
        confidence = 0.83;
      } else if (prompt.includes('parking')) {
        const count = Math.floor(Math.random() * 10) + 5;
        result = `I found ${count} available parking spaces`;
        confidence = 0.91;
      }

      resolve({
        success: true,
        result,
        confidence,
        timestamp: new Date().toISOString()
      });
    }, 800);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   return await api.post('/api/analysis/prompt', data);
  // } catch (error) {
  //   throw new Error(error?.response?.data?.error || error.message);
  // }
}

// Description: Get analysis history
// Endpoint: GET /api/analysis/history
// Request: { limit?: number, cameraId?: string }
// Response: { history: Array<{ _id: string, prompt: string, result: string, timestamp: string, confidence: number, cameraId?: string }> }
export const getAnalysisHistory = (params?: { limit?: number; cameraId?: string }) => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      const mockHistory = [
        {
          _id: '1',
          prompt: 'Count red cars',
          result: 'I found 3 red cars',
          timestamp: new Date(Date.now() - 30000).toISOString(),
          confidence: 0.92,
          cameraId: '1'
        },
        {
          _id: '2',
          prompt: 'Are there any people?',
          result: 'I found 2 persons',
          timestamp: new Date(Date.now() - 60000).toISOString(),
          confidence: 0.88,
          cameraId: '1'
        },
        {
          _id: '3',
          prompt: 'Count trucks',
          result: 'I found 1 truck',
          timestamp: new Date(Date.now() - 120000).toISOString(),
          confidence: 0.90,
          cameraId: '2'
        },
        {
          _id: '4',
          prompt: 'Detect bicycles',
          result: 'I found 2 bicycles',
          timestamp: new Date(Date.now() - 180000).toISOString(),
          confidence: 0.86,
          cameraId: '1'
        },
        {
          _id: '5',
          prompt: 'Count people wearing masks',
          result: 'I found 1 person wearing mask',
          timestamp: new Date(Date.now() - 240000).toISOString(),
          confidence: 0.83,
          cameraId: '2'
        }
      ];

      const limit = params?.limit || 10;
      const filteredHistory = params?.cameraId 
        ? mockHistory.filter(item => item.cameraId === params.cameraId)
        : mockHistory;

      resolve({
        history: filteredHistory.slice(0, limit)
      });
    }, 300);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   const queryParams = new URLSearchParams();
  //   if (params?.limit) queryParams.append('limit', params.limit.toString());
  //   if (params?.cameraId) queryParams.append('cameraId', params.cameraId);
  //   return await api.get(`/api/analysis/history?${queryParams}`);
  // } catch (error) {
  //   throw new Error(error?.response?.data?.error || error.message);
  // }
}

// Description: Stop analysis for a camera
// Endpoint: POST /api/analysis/stop
// Request: { cameraId: string }
// Response: { success: boolean, message: string }
export const stopAnalysis = (data: { cameraId: string }) => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        message: 'Analysis stopped successfully'
      });
    }, 200);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   return await api.post('/api/analysis/stop', data);
  // } catch (error) {
  //   throw new Error(error?.response?.data?.error || error.message);
  // }
}

// Description: Get real-time analysis status
// Endpoint: GET /api/analysis/status/:cameraId
// Request: { cameraId: string }
// Response: { isActive: boolean, currentPrompt?: string, lastUpdate?: string }
export const getAnalysisStatus = (cameraId: string) => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        isActive: Math.random() > 0.5,
        currentPrompt: 'Count red cars',
        lastUpdate: new Date().toISOString()
      });
    }, 200);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   return await api.get(`/api/analysis/status/${cameraId}`);
  // } catch (error) {
  //   throw new Error(error?.response?.data?.error || error.message);
  // }
}