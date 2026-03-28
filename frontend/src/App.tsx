import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { SharedLayout } from './components/layout/SharedLayout';
import { Upload } from './pages/Upload';
import { Profile } from './pages/Profile';
import { Interview } from './pages/Interview';
import { Login } from './pages/Login';
import { AuthError } from './pages/AuthError';
import { AuthSuccess } from './pages/AuthSuccess';
import { Report } from './pages/Report';
import { useAuthStore } from './store/useAuthStore';
import { type InterviewFlowStage, useInterviewStore } from './store/useInterviewStore';
import { authService } from './services/authService';

/**
 * ProtectedRoute component - redirects to /login if user is not authenticated.
 */
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

const FlowRoute: React.FC<{
  step: 'upload' | 'profile' | 'interview' | 'report';
  children: React.ReactNode;
}> = ({ step, children }) => {
  const sessionId = useInterviewStore((state) => state.sessionId);
  const profile = useInterviewStore((state) => state.profile);
  const report = useInterviewStore((state) => state.report);
  const flowStage = useInterviewStore((state) => state.flowStage);

  const hasUploadData = Boolean(sessionId && profile);
  const hasReport = Boolean(report);
  const stageOrder: Record<InterviewFlowStage, number> = {
    upload: 0,
    profile: 1,
    interview: 2,
    report: 3,
  };
  const requiredStage = stageOrder[step];

  if (step === 'upload') {
    return <>{children}</>;
  }

  if (!hasUploadData) {
    return <Navigate to="/upload" replace />;
  }

  if (step === 'profile') {
    return <>{children}</>;
  }

  if (step === 'interview') {
    if (stageOrder[flowStage] < requiredStage) {
      return <Navigate to="/profile" replace />;
    }

    return hasReport ? <Navigate to="/report" replace /> : <>{children}</>;
  }

  if (stageOrder[flowStage] < requiredStage) {
    return <Navigate to="/interview" replace />;
  }

  return hasReport ? <>{children}</> : <Navigate to="/interview" replace />;
};

const App: React.FC = () => {
  const { setAuth, logout, refreshToken, accessToken } = useAuthStore();
  const validateSession = useInterviewStore((state) => state.validateSession);

  // Global Session Validation
  useEffect(() => {
    validateSession();
  }, [validateSession]);

  // Global Auth Initialization & Token Refreshing
  useEffect(() => {
    const initializeAuth = async () => {
      // If we have an access token, verify it by fetching the user profile.
      if (accessToken) {
        try {
          await authService.getMe(accessToken);
          // If successful, user is confirmed to be authenticated.
          // Note: setAuth is already handled if tokens are found in storage by persist middleware.
        } catch (error: any) {
          // If verification fails (e.g. token expired), try refresh.
          if (error.response?.status === 401 && refreshToken) {
            try {
              const newAccessToken = await authService.refreshToken(refreshToken);
              const user = await authService.getMe(newAccessToken);
              setAuth(user, newAccessToken, refreshToken);
            } catch (refreshErr) {
              logout();
            }
          } else {
            logout();
          }
        }
      }
    };

    initializeAuth();
  }, [accessToken, refreshToken, setAuth, logout]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/auth/error" element={<AuthError />} />
        <Route path="/auth/success" element={<AuthSuccess />} />

        {/* Protected Application Routes */}
        <Route element={<ProtectedRoute><SharedLayout /></ProtectedRoute>}>
          <Route path="/upload" element={<FlowRoute step="upload"><Upload /></FlowRoute>} />
          <Route path="/profile" element={<FlowRoute step="profile"><Profile /></FlowRoute>} />
          <Route path="/interview" element={<FlowRoute step="interview"><Interview /></FlowRoute>} />
          <Route path="/report" element={<FlowRoute step="report"><Report /></FlowRoute>} />
          
          {/* Default redirect for unknown paths */}
          <Route path="*" element={<Navigate to="/upload" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
