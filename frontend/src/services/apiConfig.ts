// Force direct communication with Render backend in production to bypass
// Vercel's 10-second request limit (Hobby/Free plan), which kills mobile uploads.
const REMOTE_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://prepx-hz7r.onrender.com/api/v1';

export const API_BASE_URL = REMOTE_API_BASE_URL.startsWith('http')
  ? REMOTE_API_BASE_URL
  : 'https://prepx-hz7r.onrender.com/api/v1';
