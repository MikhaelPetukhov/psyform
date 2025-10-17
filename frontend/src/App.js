import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import ValidatedBooking from './components/ValidatedBooking';
import Landing from './components/Landing';
import AdminApp from './components/AdminApp';
import ProtectedRoute from './components/ProtectedRoute';
import AuthCallback from './components/AuthCallback';
import AdminLanding from './components/AdminLanding';
import AdminLogin from './components/AdminLogin';
import './App.css';
import CallPage from './components/calls/CallPage';

function App() {

  return (
    <BrowserRouter>
      <Toaster 
        position="top-center" 
        toastOptions={{
          success: {
            style: {
              background: '#E9EEDF',
              color: '#333333',
            },
            iconTheme: {
              primary: '#8A9A5B',
              secondary: 'white',
            },
          },
          error: {
            style: {
              background: '#FFEBEE',
              color: '#B71C1C',
            },
            iconTheme: {
              primary: '#B71C1C',
              secondary: 'white',
            },
          },
          style: {
            borderRadius: '100px',
            padding: '10px 20px',
            fontSize: '14px',
          }
        }}
      />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/p/:slug" element={<ValidatedBooking />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        {/* Public landing with Telegram admin login button */}
        <Route path="/psychologist" element={<AdminLanding />} />
        {/* Local login page for admin (username/password) */}
        <Route path="/psychologist/login" element={<AdminLogin />} />
        {/* Public call embed page (host/guest) */}
        <Route path="/calls/:roomId" element={<CallPage />} />
        {/* Protected personal admin panel by slug */}
        <Route path="/psychologist/:slug" element={<ProtectedRoute />}>
          <Route index element={<AdminApp />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
