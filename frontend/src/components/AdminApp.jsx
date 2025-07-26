import React, { useState, useEffect } from 'react';

import BookingsTab from './BookingsTab';
import ScheduleSettingsTab from './ScheduleSettingsTab';
// import CalendarTab from './CalendarTab'; // To be implemented later

import api from '../api';
import { toast } from 'react-hot-toast';

const AdminApp = () => {
  const [activeTab, setActiveTab] = useState('schedule-settings'); // Default to settings for immediate testing

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await api.get('/schedule/settings');
        if (response.data) {
          // Removed setSettings(response.data);
        }
      } catch (error) {
        console.error('Failed to fetch settings', error);
        toast.error('Не удалось загрузить настройки.');
      }
    };

    if (activeTab === 'schedule-settings') {
        fetchSettings();
    }
  }, [activeTab]);

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    // Redirect to login page after logout
    window.location.href = '/psychologist/login';
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'bookings':
        return <BookingsTab />;
      case 'schedule-settings':
        return <ScheduleSettingsTab />;
      // case 'calendar':
      //   return <CalendarTab />;
      default:
        return <BookingsTab />;
    }
  };

  return (
    <div className="min-h-screen bg-brand-background font-sans">
      <header className="bg-white shadow-sm border-b border-gray-200/80 sticky top-0 z-20">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-brand-text">
                Панель управления
              </h1>
              <p className="mt-1 text-sm text-brand-secondary">
                Управление записями и расписанием
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-lg font-semibold text-sm transition-colors bg-red-50 text-red-600 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Выйти
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 border-b border-gray-200/80">
          <nav className="-mb-px flex space-x-6">
            <button
              onClick={() => setActiveTab('bookings')}
              className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'bookings'
                  ? 'border-brand-accent text-brand-accent'
                  : 'border-transparent text-brand-secondary hover:text-brand-text hover:border-gray-300'
              }`}
            >
              Записи клиентов
            </button>
            <button
              onClick={() => setActiveTab('schedule-settings')}
              className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'schedule-settings'
                  ? 'border-brand-accent text-brand-accent'
                  : 'border-transparent text-brand-secondary hover:text-brand-text hover:border-gray-300'
              }`}
            >
              Настройки расписания
            </button>
            {/* <button
              onClick={() => setActiveTab('calendar')}
              className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'calendar'
                  ? 'border-brand-accent text-brand-accent'
                  : 'border-transparent text-brand-secondary hover:text-brand-text hover:border-gray-300'
              }`}
            >
              Календарь
            </button> */}
          </nav>
        </div>

        {renderActiveTab()}

      </main>
    </div>
  );
};

export default AdminApp;
