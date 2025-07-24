import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import BookingForm from './components/BookingForm';
import AdminApp from './components/AdminApp';
import AdminLogin from './components/AdminLogin';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';

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
        <Route path="/" element={<BookingForm />} />
        <Route path="/psychologist/login" element={<AdminLogin />} />
        <Route path="/psychologist" element={<ProtectedRoute />}>
          <Route index element={<AdminApp />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
