import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { authService } from '../services/authService';

export const AuthSuccess: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const accessToken = searchParams.get('access_token');
    const refreshToken = searchParams.get('refresh_token');

    if (accessToken && refreshToken) {
      const fetchProfile = async () => {
        try {
          const user = await authService.getMe(accessToken);
          setAuth(user, accessToken, refreshToken);
          navigate('/upload', { replace: true });
        } catch (err: any) {
          console.error('AuthSuccess: Failed to fetch user profile post-login', err);
          setError(err.response?.data?.detail || err.message || 'Verification failed');
        }
      };
      
      fetchProfile();
    } else {
      setError('Authentication tokens were not provided in the URL.');
    }
  }, [searchParams, navigate, setAuth]);

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a192f] flex flex-col items-center justify-center text-white p-4">
        <div className="max-w-md w-full bg-red-900/20 border border-red-500/50 rounded-2xl p-8 backdrop-blur-xl text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-4">Authentication Failed</h2>
          <p className="text-gray-400 mb-8">{error}</p>
          <button 
            onClick={() => navigate('/login')}
            className="w-full py-4 bg-red-500 hover:bg-red-600 rounded-xl font-bold transition-all shadow-lg shadow-red-500/20"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a192f] flex flex-col items-center justify-center text-white p-4">
      {/* Background Effects */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-sky-400/5 blur-[150px] rounded-full -z-10 animate-pulse" />
      
      <div className="relative flex flex-col items-center">
        <div className="w-20 h-20 border-t-4 border-r-4 border-sky-400 rounded-full animate-spin mb-8" />
        <h2 className="text-3xl font-black tracking-tight mb-2">Authenticating</h2>
        <p className="text-gray-400 text-lg">Finishing setting up your session...</p>
      </div>
    </div>
  );
};
