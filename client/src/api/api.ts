import axios from 'axios';

const isDevelopment = import.meta.env.DEV;
const baseURL = isDevelopment ? 'http://localhost:3001' : '';

const api = axios.create({
  baseURL,
  timeout: 35000, 
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    const resolvedURL = config.baseURL ? `${config.baseURL}${config.url}` : config.url;
    console.log(`[API] Request: ${config.method?.toUpperCase()} ${resolvedURL}`);
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh and better error logging
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // Log error details for debugging
    console.error(`[API] Response error: ${error.response?.status} ${error.response?.statusText}`);
    console.error(`[API] URL: ${originalRequest?.url}`);
    console.error(`[API] Error message: ${error.message}`);

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        console.log('[API] Token expired, attempting refresh...');
        const refreshToken = localStorage.getItem('refreshToken');

        if (!refreshToken) {
          console.log('[API] No refresh token available, redirecting to login');
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
          return Promise.reject(error);
        }

        // Use a fresh axios instance for refresh to avoid interceptor loops
        const refreshResponse = await axios.post('/api/auth/refresh', {
          refreshToken: refreshToken
        }, {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json'
          }
        });

        const { accessToken, refreshToken: newRefreshToken } = refreshResponse.data;
        
        console.log('[API] Token refresh successful');
        localStorage.setItem('accessToken', accessToken);
        if (newRefreshToken) {
          localStorage.setItem('refreshToken', newRefreshToken);
        }

        // Update the authorization header for the original request
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        
        // Retry the original request
        return api(originalRequest);
      } catch (refreshError: any) {
        console.error('[API] Token refresh failed:', refreshError);
        
        // Check if refresh token is also expired
        if (refreshError.response?.status === 403 || refreshError.response?.status === 401) {
          console.log('[API] Refresh token expired, redirecting to login');
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
        }
        
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;