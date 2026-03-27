import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export interface UserProfile {
  email: string;
  display_name: string;
  created_at: string;
  history_count: number;
}

export const authService = {
  getGoogleLoginUrl: () => `${API_BASE_URL}/auth/login/google`,

  getMe: async (token: string): Promise<UserProfile> => {
    const response = await axios.get(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },

  refreshToken: async (refreshToken: string) => {
    const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
      refresh_token: refreshToken,
    });
    return response.data.access_token;
  },

  logout: async (token: string) => {
    await axios.post(`${API_BASE_URL}/auth/logout`, {}, {
      headers: { Authorization: `Bearer ${token}` },
    });
  },
};
