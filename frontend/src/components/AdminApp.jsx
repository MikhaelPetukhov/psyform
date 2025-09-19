import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../api';

import BookingsTab from './BookingsTab';
import CalendarTab from './CalendarTab';
import ScheduleSettingsTab from './ScheduleSettingsTab';
import ProfileSettings from './ProfileSettings';


const AdminApp = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('calendar');
  const [practitionerSlug, setPractitionerSlug] = useState(typeof window !== 'undefined' ? (localStorage.getItem('practitionerSlug') || '') : '');
  const [practitionerPublicSlug, setPractitionerPublicSlug] = useState(typeof window !== 'undefined' ? (localStorage.getItem('practitionerPublicSlug') || '') : '');
  const [practitionerTimezone, setPractitionerTimezone] = useState('Europe/Moscow');

  useEffect(() => {
    // Initialize tab from querystring (e.g., ?tab=bookings)
    try {
      const params = new URLSearchParams(location.search || '');
      const tab = (params.get('tab') || '').toLowerCase();
      if (['bookings','calendar','profile','autoSchedule'].includes(tab)) {
        setActiveTab(tab);
      }
    } catch (_) {}

    // If profile is not filled yet, switch to Profile tab on first load
    (async () => {
      try {
        const { data } = await api.get('/practitioners/profile');
        const p = data?.practitioner || {};
        if (!p.displayName || !p.specialization || !p.price || !p.clientMessageTemplate || !p.timezone) {
          setActiveTab('profile');
        }
        // Set practitioner timezone
        if (p.timezone) {
          setPractitionerTimezone(p.timezone);
        }
        // Refresh slugs for the header links strictly from the authenticated admin
        try {
          const me = await api.get('/auth/admin/me');
          if (me?.data?.ok) {
            setPractitionerSlug(me.data.practitionerSlug || '');
            setPractitionerPublicSlug(me.data.practitionerPublicSlug || '');
          }
        } catch (_) { /* ignore */ }
      } catch (_) { /* ignore */ }
    })();
  }, []);

  // React to query param tab changes later as well (e.g., user clicks from Calendar)
  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search || '');
      const tab = (params.get('tab') || '').toLowerCase();
      if (['bookings','calendar','profile','autoSchedule'].includes(tab) && tab !== activeTab) {
        setActiveTab(tab);
      }
    } catch (_) {}
  }, [location.search]);

  const handleLogout = async () => {
    try {
      // Clear HttpOnly admin cookie on the server
      await api.post('/auth/admin/logout');
    } catch (_) { /* ignore */ }
    // Clear local token just in case
    localStorage.removeItem('adminToken');
    // Redirect to the new Telegram login landing
    window.location.href = '/psychologist';
  };

  const renderActiveTab = () => {
    // Extract focus id from query for Bookings tab highlight
    let focusId = null;
    try {
      const params = new URLSearchParams(location.search || '');
      focusId = params.get('focus');
    } catch (_) {}
    switch (activeTab) {
      case 'bookings':
        return <BookingsTab practitionerTimezone={practitionerTimezone} focusId={focusId} />;
      case 'calendar':
        return <CalendarTab practitionerTimezone={practitionerTimezone} />;
      case 'schedule':
        return <ScheduleSettingsTab practitionerTimezone={practitionerTimezone} />;
      case 'profile':
        return <ProfileSettings practitionerTimezone={practitionerTimezone} onTimezoneUpdate={setPractitionerTimezone} />;
      default:
        return <CalendarTab practitionerTimezone={practitionerTimezone} />;
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
              <div className="mt-2 text-xs text-brand-secondary flex flex-col sm:flex-row sm:items-center gap-1">
                {practitionerSlug && (
                  <span>
                    Кабинет: <a className="underline" href={`/psychologist/${practitionerSlug}`} target="_blank" rel="noreferrer">/psychologist/{practitionerSlug}</a>
                  </span>
                )}
                {practitionerPublicSlug && (
                  <span>
                    Форма записи: <a className="underline" href={`/p/${practitionerPublicSlug}`} target="_blank" rel="noreferrer">/p/{practitionerPublicSlug}</a>
                  </span>
                )}
              </div>
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
        <nav className="bg-white border-b border-gray-200 px-6 py-3">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('calendar')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'calendar'
                  ? 'border-brand-accent text-brand-accent'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Календарь
            </button>
            <button
              onClick={() => setActiveTab('bookings')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'bookings'
                  ? 'border-brand-accent text-brand-accent'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Записи клиентов
            </button>
            <button
              onClick={() => setActiveTab('schedule')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'schedule'
                  ? 'border-brand-accent text-brand-accent'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Настройки расписания
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'profile'
                  ? 'border-brand-accent text-brand-accent'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Профиль
            </button>
          </div>
        </nav>

        {renderActiveTab()}

      </main>
    </div>
  );
};

export default AdminApp;
