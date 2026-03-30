import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { API_BASE_URL } from './apiConfig';

export const isRecoverableNetworkError = (error: unknown) => {
  if (!axios.isAxiosError(error)) {
    return false;
  }

  if (error.response && [502, 503, 504].includes(error.response.status)) {
    return true;
  }

  if (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK') {
    return true;
  }

  return !error.response && (
    error.message === 'Network Error' ||
    error.message?.toLowerCase().includes('timeout') === true
  );
};

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
