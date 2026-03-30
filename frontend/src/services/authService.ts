import axios from 'axios';
import { API_BASE_URL } from './apiConfig';

const BACKEND_WAKE_TIMEOUT_MS = 10000;
const BACKEND_WAKE_RETRY_DELAY_MS = 2500;
const BACKEND_WAKE_MAX_ATTEMPTS = 8;

let warmGoogleLoginPromise: Promise<void> | null = null;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

const getApiBaseUrl = () => {
  const url = new URL(API_BASE_URL, window.location.origin);
  if (!url.pathname.endsWith('/')) {
    url.pathname = `${url.pathname}/`;
  }
  return url;
};

const buildApiUrl = (path: string) =>
  new URL(path.replace(/^\//, ''), getApiBaseUrl()).toString();

const buildBackendUrl = (path: string) =>
  new URL(path.replace(/^\//, ''), `${getApiBaseUrl().origin}/`).toString();

const waitForBackendWake = async () => {
  let lastError: unknown;

  for (let attempt = 0; attempt < BACKEND_WAKE_MAX_ATTEMPTS; attempt += 1) {
    try {
      await axios.get(buildBackendUrl(`health?warmup=${Date.now()}`), {
        timeout: BACKEND_WAKE_TIMEOUT_MS,
      });
      return;
    } catch (error) {
      lastError = error;

      if (attempt < BACKEND_WAKE_MAX_ATTEMPTS - 1) {
        await sleep(BACKEND_WAKE_RETRY_DELAY_MS);
      }
    }
  }

  throw lastError ?? new Error('Unable to reach the authentication service.');
};

const ensureGoogleLoginReady = () => {
  if (!warmGoogleLoginPromise) {
    warmGoogleLoginPromise = waitForBackendWake().finally(() => {
      warmGoogleLoginPromise = null;
    });
  }

  return warmGoogleLoginPromise;
};

export interface UserProfile {
  email: string;
  display_name: string;
  created_at: string;
  history_count: number;
}

export const authService = {
  getGoogleLoginUrl: () => buildApiUrl('auth/login/google'),
  prewarmGoogleLogin: () => ensureGoogleLoginReady(),

  getMe: async (token: string): Promise<UserProfile> => {
    const response = await axios.get(buildApiUrl('auth/me'), {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },

  refreshToken: async (refreshToken: string) => {
    const response = await axios.post(buildApiUrl('auth/refresh'), {
      refresh_token: refreshToken,
    });
    return response.data.access_token;
  },

  logout: async (token: string) => {
    await axios.post(buildApiUrl('auth/logout'), {}, {
      headers: { Authorization: `Bearer ${token}` },
    });
  },
};
