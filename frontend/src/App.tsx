import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SharedLayout } from './components/layout/SharedLayout';
import { Upload } from './pages/Upload';
import { Profile } from './pages/Profile';
import { Interview } from './pages/Interview';
import { Report } from './pages/Report';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<SharedLayout />}>
          <Route path="/" element={<Upload />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/interview" element={<Interview />} />
          <Route path="/report" element={<Report />} />
          
          {/* Redirect any unknown paths to upload */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
