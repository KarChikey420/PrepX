import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';

export const AuthError: React.FC = () => {
  const [searchParams] = useSearchParams();
  const detail = searchParams.get('detail');

  const message =
    detail === 'redirect_uri_mismatch'
      ? 'Google rejected the callback URL. Check the backend redirect URI and your Google Cloud OAuth settings.'
      : 'We could not complete Google sign-in. Please try again after checking the backend auth configuration.';

  return (
    <div className="min-h-screen bg-[#0a192f] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-neon-cyan/10 blur-[150px] rounded-full -z-10 animate-pulse" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-500/10 blur-[150px] rounded-full -z-10 animate-pulse" />

      <div className="w-full max-w-xl bg-white/5 backdrop-blur-2xl p-8 rounded-3xl border border-white/10 shadow-2xl text-white">
        <p className="text-sm uppercase tracking-[0.3em] text-red-300 mb-3">Authentication Error</p>
        <h1 className="text-3xl font-black tracking-tight mb-4">Google sign-in could not finish</h1>
        <p className="text-gray-300 text-lg leading-relaxed mb-4">{message}</p>
        {detail && (
          <p className="text-sm text-gray-400 mb-8">
            Error detail: <span className="font-mono text-gray-200">{detail}</span>
          </p>
        )}

        <Link
          to="/login"
          className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-white text-slate-900 font-bold hover:bg-gray-100 transition-colors"
        >
          Back to login
        </Link>
      </div>
    </div>
  );
};
