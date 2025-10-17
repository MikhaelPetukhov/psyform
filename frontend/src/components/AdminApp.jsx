import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../api';
import { useI18n } from '../locale/i18n';

import BookingsTab from './BookingsTab';
import CalendarTab from './CalendarTab';
import ScheduleSettingsTab from './ScheduleSettingsTab';
import ProfileSettings from './ProfileSettings';


const AdminApp = () => {
  const location = useLocation();
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const saved = localStorage.getItem('adminActiveTab');
      if (['bookings','calendar','profile','schedule'].includes(saved)) return saved;
    } catch (_) {}
    return 'calendar';
  });
  const [practitionerSlug, setPractitionerSlug] = useState(typeof window !== 'undefined' ? (localStorage.getItem('practitionerSlug') || '') : '');
  const [practitionerPublicSlug, setPractitionerPublicSlug] = useState(typeof window !== 'undefined' ? (localStorage.getItem('practitionerPublicSlug') || '') : '');
  const [practitionerTimezone, setPractitionerTimezone] = useState('Europe/Moscow');
  const [showProfileBanner, setShowProfileBanner] = useState(false);

  useEffect(() => {
    // Initialize tab from querystring (e.g., ?tab=bookings)
    try {
      const params = new URLSearchParams(location.search || '');
      const tab = (params.get('tab') || '').toLowerCase();
      if (['bookings','calendar','profile','schedule'].includes(tab)) {
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
          setShowProfileBanner(true);
        } else {
          setShowProfileBanner(false);
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

  // Persist active tab between visits
  useEffect(() => {
    try { localStorage.setItem('adminActiveTab', activeTab); } catch (_) {}
  }, [activeTab]);

  // React to query param tab changes later as well (e.g., user clicks from Calendar)
  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search || '');
      const tab = (params.get('tab') || '').toLowerCase();
      if (['bookings','calendar','profile','schedule'].includes(tab) && tab !== activeTab) {
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
        return <ProfileSettings practitionerTimezone={practitionerTimezone} onTimezoneUpdate={setPractitionerTimezone} practitionerPublicSlug={practitionerPublicSlug} />;
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
                {t('admin.header.title')}
              </h1>
              <p className="mt-1 text-sm text-brand-secondary">
                {t('admin.header.subtitle')}
              </p>
              <div className="mt-2 text-xs text-brand-secondary flex flex-col sm:flex-row sm:items-center gap-1">
                {practitionerSlug && (
                  <span>
                    {t('admin.header.cabinet')}: <a className="underline" href={`/psychologist/${practitionerSlug}`} target="_blank" rel="noreferrer">/psychologist/{practitionerSlug}</a>
                  </span>
                )}
                {practitionerPublicSlug && (
                  <span>
                    {t('admin.header.publicForm')}: <a className="underline" href={`/p/${practitionerPublicSlug}`} target="_blank" rel="noreferrer">/p/{practitionerPublicSlug}</a>
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-lg font-semibold text-sm transition-colors bg-red-50 text-red-600 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              {t('admin.header.logout')}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {showProfileBanner && (
          <div className="mb-4 p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold">{t('admin.profileBanner.title')}</div>
              <div className="text-sm">{t('admin.profileBanner.text')}</div>
            </div>
            <button
              onClick={() => setActiveTab('profile')}
              className="px-3 py-2 rounded-lg bg-amber-600 text-white text-sm hover:bg-amber-700"
            >{t('admin.profileBanner.cta')}</button>
          </div>
        )}
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
              {t('admin.tabs.calendar')}
            </button>
            <button
              onClick={() => setActiveTab('bookings')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'bookings'
                  ? 'border-brand-accent text-brand-accent'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t('admin.tabs.bookings')}
            </button>
            <button
              onClick={() => setActiveTab('schedule')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'schedule'
                  ? 'border-brand-accent text-brand-accent'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t('admin.tabs.schedule')}
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'profile'
                  ? 'border-brand-accent text-brand-accent'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t('admin.tabs.profile')}
            </button>
          </div>
        </nav>

        {renderActiveTab()}

      </main>
    </div>
  );
};

export default AdminApp;
