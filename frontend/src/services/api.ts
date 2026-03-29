import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://prepx-hz7r.onrender.com/api/v1';
const BACKEND_ORIGIN = new URL(API_BASE_URL, typeof window === 'undefined' ? 'http://localhost:5173' : window.location.origin).origin;
const BACKEND_WAKE_TIMEOUT_MS = 60000;
const BACKEND_WAKE_RETRY_DELAY_MS = 2500;
const BACKEND_WAKE_MAX_ATTEMPTS = 3;
const BACKEND_READY_CACHE_MS = 10 * 60 * 1000;

let backendReadyUntil = 0;
let backendWakePromise: Promise<void> | null = null;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

const buildBackendUrl = (path: string) =>
  new URL(path.replace(/^\//, ''), `${BACKEND_ORIGIN}/`).toString();

const warmBackend = async () => {
  let lastError: unknown;

  for (let attempt = 0; attempt < BACKEND_WAKE_MAX_ATTEMPTS; attempt += 1) {
    try {
      await axios.get(buildBackendUrl(`health?warmup=${Date.now()}`), {
        timeout: BACKEND_WAKE_TIMEOUT_MS,
      });
      backendReadyUntil = Date.now() + BACKEND_READY_CACHE_MS;
      return;
    } catch (error) {
      lastError = error;

      if (attempt < BACKEND_WAKE_MAX_ATTEMPTS - 1) {
        await sleep(BACKEND_WAKE_RETRY_DELAY_MS);
      }
    }
  }

  throw lastError ?? new Error('Unable to reach the PrepX backend.');
};

export const ensureBackendReady = (force = false) => {
  if (!force && Date.now() < backendReadyUntil) {
    return Promise.resolve();
  }

  if (!backendWakePromise) {
    backendWakePromise = warmBackend().finally(() => {
      backendWakePromise = null;
    });
  }

  return backendWakePromise;
};

export const isRecoverableNetworkError = (error: unknown) => {
  if (!axios.isAxiosError(error)) {
    return false;
  }

  if (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK') {
    return true;
  }

  return error.message === 'Network Error' || error.message?.toLowerCase().includes('timeout') === true;
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
