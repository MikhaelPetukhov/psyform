import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api';
import { useI18n } from '../locale/i18n';

function AuthCallback() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(t('authCallback.verifying'));

  useEffect(() => {
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search || '');
        const token = (params.get('token') || '').trim();
        const slug = (params.get('p') || '').trim();
        if (slug) {
          try { localStorage.setItem('practitionerSlug', slug); } catch (_) {}
        }
        if (!token) {
          setMessage(t('authCallback.noToken'));
          setLoading(false);
          return;
        }
        await api.post('/auth/tg/verify', { code: token });
        // Signal BookingForm to auto-open calendar/modal after redirect
        try { localStorage.setItem('autoOpenBooking', '1'); } catch (_) {}
        toast.success(t('authCallback.success'));
        // Clean URL then redirect
        try {
          const cleanUrl = '/';
          window.history.replaceState({}, '', cleanUrl);
        } catch (_) {}
        navigate('/', { replace: true });
      } catch (err) {
        const msg = err?.response?.data?.message || t('authCallback.fail');
        setMessage(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="px-6 py-4 rounded-xl bg-white shadow border border-gray-200 text-sm">
        {loading ? (
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand-accent"></div>
            <div className="text-brand-text">{message}</div>
          </div>
        ) : (
          <div className="text-brand-text">{message}</div>
        )}
      </div>
    </div>
  );
}

export default AuthCallback;
