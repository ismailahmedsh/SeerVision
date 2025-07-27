import api from './api';

// Description: Get notifications
// Endpoint: GET /api/notifications
// Request: { limit?: number, unreadOnly?: boolean }
// Response: { notifications: Array<{ _id: string, title: string, message: string, type: 'info' | 'warning' | 'error' | 'success', timestamp: string, read: boolean }>, unreadCount: number }
export const getNotifications = (params?: { limit?: number; unreadOnly?: boolean }) => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      const notifications = [
        {
          _id: '1',
          title: 'Camera Connection Lost',
          message: 'Back Entrance camera has lost connection. Please check network connectivity.',
          type: 'error' as const,
          timestamp: new Date(Date.now() - 300000).toISOString(),
          read: false
        },
        {
          _id: '2',
          title: 'High Activity Detected',
          message: 'Parking Lot Camera detected unusual activity with 15 people in frame.',
          type: 'warning' as const,
          timestamp: new Date(Date.now() - 600000).toISOString(),
          read: false
        },
        {
          _id: '3',
          title: 'Analysis Complete',
          message: 'Daily analysis report is ready for Front Door Camera.',
          type: 'success' as const,
          timestamp: new Date(Date.now() - 1800000).toISOString(),
          read: true
        },
        {
          _id: '4',
          title: 'System Update',
          message: 'AI model has been updated to version 2.1 with improved accuracy.',
          type: 'info' as const,
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          read: true
        },
        {
          _id: '5',
          title: 'Storage Warning',
          message: 'Video storage is 85% full. Consider archiving old recordings.',
          type: 'warning' as const,
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          read: false
        }
      ];

      const filtered = params?.unreadOnly ? notifications.filter(n => !n.read) : notifications;
      const limited = filtered.slice(0, params?.limit || 10);
      const unreadCount = notifications.filter(n => !n.read).length;

      resolve({
        notifications: limited,
        unreadCount
      });
    }, 300);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   const queryParams = new URLSearchParams();
  //   if (params?.limit) queryParams.append('limit', params.limit.toString());
  //   if (params?.unreadOnly) queryParams.append('unreadOnly', 'true');
  //   return await api.get(`/api/notifications?${queryParams}`);
  // } catch (error) {
  //   throw new Error(error?.response?.data?.error || error.message);
  // }
}

// Description: Mark notification as read
// Endpoint: PUT /api/notifications/:id/read
// Request: { id: string }
// Response: { success: boolean }
export const markNotificationRead = (id: string) => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true
      });
    }, 200);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   return await api.put(`/api/notifications/${id}/read`);
  // } catch (error) {
  //   throw new Error(error?.response?.data?.error || error.message);
  // }
}

// Description: Mark all notifications as read
// Endpoint: PUT /api/notifications/read-all
// Request: {}
// Response: { success: boolean }
export const markAllNotificationsRead = () => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true
      });
    }, 300);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   return await api.put('/api/notifications/read-all');
  // } catch (error) {
  //   throw new Error(error?.response?.data?.error || error.message);
  // }
}