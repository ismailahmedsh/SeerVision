import api from './api';

// Description: Get all notifications for the current user
// Endpoint: GET /api/notifications
// Request: {}
// Response: { notifications: Array<{ _id: string, title: string, message: string, type: string, read: boolean, createdAt: string }> }
export const getNotifications = () => {
    // Mocking the response
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                notifications: [
                    {
                        _id: '1',
                        title: 'Camera Connected',
                        message: 'Your camera "Front Door" has been successfully connected',
                        type: 'success',
                        read: false,
                        createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString() // 5 minutes ago
                    },
                    {
                        _id: '2',
                        title: 'Analysis Complete',
                        message: 'Video analysis for "Parking Lot" has finished processing',
                        type: 'info',
                        read: false,
                        createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString() // 15 minutes ago
                    },
                    {
                        _id: '3',
                        title: 'Connection Warning',
                        message: 'Camera "Back Yard" connection is unstable',
                        type: 'warning',
                        read: true,
                        createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString() // 30 minutes ago
                    }
                ]
            });
        }, 500);
    });
    // Uncomment the below lines to make an actual API call
    // try {
    //   return await api.get('/api/notifications');
    // } catch (error) {
    //   throw new Error(error?.response?.data?.error || error.message);
    // }
}

// Description: Mark a single notification as read
// Endpoint: PUT /api/notifications/:id/read
// Request: { id: string }
// Response: { success: boolean, message: string }
export const markNotificationAsRead = (notificationId: string) => {
    // Mocking the response
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                success: true,
                message: 'Notification marked as read'
            });
        }, 300);
    });
    // Uncomment the below lines to make an actual API call
    // try {
    //   return await api.put(`/api/notifications/${notificationId}/read`);
    // } catch (error) {
    //   throw new Error(error?.response?.data?.error || error.message);
    // }
}

// Description: Mark multiple notifications as read in bulk
// Endpoint: PUT /api/notifications/bulk-read
// Request: { notificationIds: string[] }
// Response: { success: boolean, message: string, updatedCount: number }
export const bulkMarkNotificationsAsRead = (notificationIds: string[]) => {
    // Mocking the response
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                success: true,
                message: `${notificationIds.length} notifications marked as read`,
                updatedCount: notificationIds.length
            });
        }, 500);
    });
    // Uncomment the below lines to make an actual API call
    // try {
    //   return await api.put('/api/notifications/bulk-read', { notificationIds });
    // } catch (error) {
    //   throw new Error(error?.response?.data?.error || error.message);
    // }
}