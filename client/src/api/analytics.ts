import api from './api';

// Description: Get analytics data
// Endpoint: GET /api/analytics
// Request: { timeRange?: string }
// Response: { data: { totalDetections: number, averageConfidence: number, mostActiveCamera: string, topQueries: Array<{ query: string, count: number }>, dailyStats: Array<{ date: string, detections: number }>, cameraStats: Array<{ cameraId: string, name: string, detections: number }> } }
export const getAnalyticsData = (params?: { timeRange?: string }) => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        data: {
          totalDetections: 1247,
          averageConfidence: 0.87,
          mostActiveCamera: 'Front Door Camera',
          topQueries: [
            { query: 'Count red cars', count: 45 },
            { query: 'Are there any people?', count: 38 },
            { query: 'Detect bicycles', count: 22 },
            { query: 'How many trucks do you see?', count: 18 },
            { query: 'Count people wearing masks', count: 15 }
          ],
          dailyStats: [
            { date: '2024-01-01', detections: 178 },
            { date: '2024-01-02', detections: 165 },
            { date: '2024-01-03', detections: 192 },
            { date: '2024-01-04', detections: 156 },
            { date: '2024-01-05', detections: 203 },
            { date: '2024-01-06', detections: 187 },
            { date: '2024-01-07', detections: 166 }
          ],
          cameraStats: [
            { cameraId: '1', name: 'Front Door Camera', detections: 456 },
            { cameraId: '2', name: 'Parking Lot Camera', detections: 389 },
            { cameraId: '3', name: 'Back Entrance', detections: 402 }
          ]
        }
      });
    }, 600);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   const queryParams = new URLSearchParams();
  //   if (params?.timeRange) queryParams.append('timeRange', params.timeRange);
  //   return await api.get(`/api/analytics?${queryParams}`);
  // } catch (error) {
  //   throw new Error(error?.response?.data?.error || error.message);
  // }
}