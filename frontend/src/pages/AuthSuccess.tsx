import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { authService } from '../services/authService';

export const AuthSuccess: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  useEffect(() => {
    const accessToken = searchParams.get('access_token');
    const refreshToken = searchParams.get('refresh_token');

    if (accessToken && refreshToken) {
      // Fetch user profile info before setting auth.
      const fetchProfile = async () => {
        try {
          const user = await authService.getMe(accessToken);
          setAuth(user, accessToken, refreshToken);
          navigate('/upload', { replace: true });
        } catch (error) {
          console.error('Failed to fetch user profile post-login', error);
          navigate('/login', { replace: true });
        }
      };
      
      fetchProfile();
    } else {
      navigate('/login', { replace: true });
    }
  }, [searchParams, navigate, setAuth]);

  return (
    <div className="min-h-screen bg-[#0a192f] flex flex-col items-center justify-center text-white p-4">
      {/* Background Effects */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-neon-cyan/5 blur-[150px] rounded-full -z-10 animate-pulse" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-500/5 blur-[150px] rounded-full -z-10 animate-pulse" />

      <div className="relative flex flex-col items-center">
        <div className="w-20 h-20 border-t-4 border-r-4 border-neon-cyan rounded-full animate-spin mb-8 shadow-neon-glow" />
        <h2 className="text-3xl font-black tracking-tight mb-2">Authenticating</h2>
        <p className="text-gray-400 text-lg">Finishing setting up your session...</p>
      </div>
    </div>
  );
};
