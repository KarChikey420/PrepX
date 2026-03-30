const REMOTE_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://prepx-hz7r.onrender.com/api/v1';

// Mobile uploads are more reliable when we talk to Render directly instead of
// routing multipart and audio traffic back through the frontend host.
export const API_BASE_URL = REMOTE_API_BASE_URL;
export const BACKEND_ORIGIN = new URL(
  API_BASE_URL,
  typeof window === 'undefined' ? 'http://localhost:5173' : window.location.origin,
).origin;
