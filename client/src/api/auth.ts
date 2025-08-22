import api from './api';

export const login = async (email: string, password: string) => {
  try {
    const response = await api.post('/api/auth/login', { email, password });
    return response.data;
  } catch (error: any) {
    console.error('Login error:', error);
    throw new Error(error?.response?.data?.message || error.message);
  }
};

export const register = async (email: string, password: string) => {
  try {
    const response = await api.post('/api/auth/register', {email, password});
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.message || error.message);
  }
};


export const logout = async () => {
  try {
    return await api.post('/api/auth/logout');
  } catch (error: any) {
    throw new Error(error?.response?.data?.message || error.message);
  }
};
