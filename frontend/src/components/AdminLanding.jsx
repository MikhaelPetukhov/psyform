import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { toast } from 'react-hot-toast';
import { useI18n } from '../locale/i18n';

const AdminLanding = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [bot, setBot] = useState({ username: null, link: null });
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  // If already authorized (cookie or token), redirect to /psychologist/<slug>
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/auth/admin/me');
        if (!cancelled && res?.data?.ok) {
          if (res.data.practitionerSlug) {
            try { localStorage.setItem('practitionerSlug', res.data.practitionerSlug); } catch(_) {}
            try { localStorage.setItem('practitionerId', res.data.practitionerId || ''); } catch(_) {}
            if (res.data.practitionerPublicSlug) try { localStorage.setItem('practitionerPublicSlug', res.data.practitionerPublicSlug); } catch(_) {}
            navigate(`/psychologist/${res.data.practitionerSlug}`, { replace: true });
            return;
          }
        }
      } catch (_) {
        // not authorized – show landing
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  // Fetch bot info for UI (for a pretty link)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/telegram/bot');
        if (!cancelled && data) {
          setBot({ username: data.username || null, link: data.link || (data.username ? `https://t.me/${data.username}` : null) });
        }
      } catch (_) {
        const envUser = (process.env.REACT_APP_TELEGRAM_BOT_USERNAME || '').trim().replace(/^@/, '');
        if (!cancelled && envUser) setBot({ username: envUser, link: `https://t.me/${envUser}` });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const startTelegramAdminLogin = async () => {
    setStarting(true);
    try {
      const { data } = await api.post('/auth/admin/tg/start');
      const link = data?.link;
      if (link) {
        window.open(link, '_blank', 'noopener');
      } else {
        toast.error(t('adminLanding.errors.linkFailed'));
      }
    } catch (e) {
      toast.error(t('adminLanding.errors.serviceUnavailable'));
    } finally {
      setStarting(false);
    }
  };

  // Убрали ручной ввод кода: вход только через Telegram deep-link

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-background flex items-center justify-center p-4">
        <div className="text-brand-secondary">{t('bookings.loading')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-background flex items-center justify-center p-4">
      <div className="w-full max-w-xl mx-auto bg-white rounded-2xl shadow-xl border border-gray-200/60 p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-brand-text mb-2">{t('adminLanding.title')}</h1>
          <p className="text-brand-secondary">{t('adminLanding.subtitle')}</p>
        </div>

        <div className="space-y-6">
          <div className="text-sm text-brand-secondary">
            <ol className="list-decimal list-inside space-y-2 ml-4">
              <li>{t('adminLanding.steps.one', { handle: bot?.username ? `@${bot.username}` : t('adminLanding.subtitle') })}</li>
              <li>{t('adminLanding.steps.two')}</li>
              <li>{t('adminLanding.steps.three')}</li>
            </ol>
          </div>

          <button
            onClick={startTelegramAdminLogin}
            disabled={starting}
            className="w-full py-3 px-5 rounded-xl font-bold text-base transition-all duration-300 transform disabled:cursor-not-allowed bg-[#0088cc] text-white hover:bg-[#006699] hover:shadow-lg hover:scale-[1.02]"
          >
            {starting ? t('adminLanding.buttons.opening') : t('adminLanding.buttons.start')}
          </button>

          {/* Ручной ввод кода и ссылка на /psychologist/login удалены по требованию: оставляем только Telegram */}
        </div>
      </div>
    </div>
  );
};

export default AdminLanding;
