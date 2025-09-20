import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api';

function TelegramLogin({ onLogin, forceModal = false }) {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [overlayFadeOut, setOverlayFadeOut] = useState(false);
  const [botInfo, setBotInfo] = useState({ username: null, link: null });
  const [authCode, setAuthCode] = useState('');
  const [codeInputVisible, setCodeInputVisible] = useState(false);

  // Ensure practitioner scope header is present as early as possible
  // Extract /p/:slug from URL and persist to localStorage before first API call
  useEffect(() => {
    try {
      const path = typeof window !== 'undefined' ? window.location.pathname : '';
      const m = path && path.match(/^\/-?p\/([^/?#]+)/) || path && path.match(/^\/p\/([^/?#]+)/);
      if (m && m[1]) {
        const slug = decodeURIComponent(m[1]);
        try { localStorage.setItem('practitionerPublicSlug', slug); } catch (_) {}
        try { if (typeof window !== 'undefined') window.__PRACTITIONER_PUBLIC_SLUG__ = slug; } catch (_) {}
      }
    } catch (_) { /* ignore */ }
  }, []);

  const fetchMe = async () => {
    try {
      const { data } = await api.get('/auth/tg/me');
      const client = data?.client || null;
      setMe(client);
      if (typeof onLogin === 'function') onLogin(client);
    } catch (e) {
      setMe(null);
      if (typeof onLogin === 'function') onLogin(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMe();
  }, []);

  // Fetch bot username/link for clickable instruction
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/telegram/bot');
        if (!cancelled && data && (data.username || data.link)) {
          setBotInfo({ username: data.username || null, link: data.link || (data.username ? `https://t.me/${data.username}` : null) });
          return;
        }
      } catch (_) { /* ignore, fallback to env below */ }
      // Fallback to frontend env variable
      const envUser = (process.env.REACT_APP_TELEGRAM_BOT_USERNAME || '').trim().replace(/^@/, '');
      if (!cancelled && envUser) {
        setBotInfo({ username: envUser, link: `https://t.me/${envUser}` });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleCodeSubmit = async (e) => {
    e.preventDefault();
    if (!authCode.trim()) return;
    
    setVerifying(true);
    try {
      const { data } = await api.post('/auth/tg/verify', { code: authCode.trim() });
      setMe(data?.client || null);
      toast.success('Авторизация через Telegram выполнена');
      if (typeof onLogin === 'function') onLogin(data?.client || null);
      setCodeInputVisible(false);
      setAuthCode('');
      setOverlayFadeOut(true);
      setTimeout(() => {
        setOverlayVisible(false);
        setOverlayFadeOut(false);
      }, 450);
    } catch (err) {
      const msg = err.response?.data?.message || 'Неверный код';
      toast.error(msg);
    } finally {
      setVerifying(false);
    }
  };

  // Auto-verify via deep link (?token=... or ?code=... & p=slug)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search || '');
      const codeParam = (params.get('token') || params.get('code') || '').trim();
      const slug = (params.get('p') || '').trim();
      if (slug) {
        try { localStorage.setItem('practitionerSlug', slug); } catch (_) {}
      }
      if (!codeParam) return;

      // Show overlay and verify automatically
      setVerifying(true);
      setOverlayVisible(true);
      (async () => {
        try {
          const { data } = await api.post('/auth/tg/verify', { code: codeParam });
          setMe(data?.client || null);
          // Signal BookingForm to auto-open calendar/modal
          try { localStorage.setItem('autoOpenBooking', '1'); } catch (_) {}
          try { window.dispatchEvent(new Event('tg-login-success')); } catch (_) {}
          toast.success('Авторизация через Telegram выполнена');
          if (typeof onLogin === 'function') onLogin(data?.client || null);
        } catch (err) {
          const msg = err.response?.data?.message || 'Не удалось подтвердить вход';
          toast.error(msg);
        } finally {
          setVerifying(false);
          // fade out overlay smoothly
          try {
            setOverlayFadeOut(true);
            setTimeout(() => {
              setOverlayVisible(false);
              setOverlayFadeOut(false);
            }, 450);
          } catch (_) {}
          // Clean URL from sensitive params
          try {
            const cleanUrl = window.location.pathname + (window.location.hash || '');
            window.history.replaceState({}, '', cleanUrl);
          } catch (_) {}
        }
      })();
    } catch (_) { /* ignore */ }
  }, [onLogin]);


  const handleLogout = async () => {
    try {
      await api.post('/auth/tg/logout');
    } catch (err) {
      console.error('Failed to log out client session', err);
    }
    setMe(null);
    toast.success('Вы вышли из аккаунта клиента');
    if (typeof onLogin === 'function') onLogin(null);
  };

  // Fullscreen overlay while verifying deep link (solid background + smooth fadeout)
  const Overlay = () => (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-white transition-opacity duration-500 ${overlayFadeOut ? 'opacity-0' : 'opacity-100'}`}>
      <div className="px-6 py-4 rounded-xl bg-white shadow-lg border border-gray-200 text-sm">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand-accent"></div>
          <div className="text-brand-text">Авторизуем через Telegram…</div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="p-3 bg-gray-50 rounded-lg text-sm text-brand-secondary">Проверяем авторизацию...</div>
    );
  }

  // Mini-account widget (fixed in top-right) when logged in
  const MiniAccount = () => (
    <div className="fixed top-3 right-3 z-40">
      <div className="flex items-center gap-3 px-3 py-2 rounded-full bg-white/90 border border-gray-200 shadow">
        <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-500">
          {me?.firstName ? me.firstName.charAt(0) : 'TG'}
        </div>
        <div className="text-xs text-brand-text font-medium">
          {me?.tgUsername ? `@${me.tgUsername}` : (me?.firstName || 'Клиент')}
        </div>
        <button onClick={handleLogout} className="text-[11px] text-red-600 hover:underline">Выйти</button>
      </div>
    </div>
  );

  // Modal overlay for unauthorized users
  const AuthModal = () => {
    // Generate login link with nonce
    const generateLoginLink = () => {
      const nonce = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const botUsername = botInfo.username || 'PsyForm_bot';
      return `https://t.me/${botUsername}?start=login_${nonce}`;
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="mx-4 p-6 rounded-2xl border border-gray-200 bg-white shadow-2xl max-w-md w-full">
          <div className="text-lg text-brand-text font-semibold mb-4 text-center">Авторизация через Telegram</div>
          <div className="text-sm text-brand-secondary space-y-3 mb-6">
            <p>Для входа на сайт:</p>
            <ol className="list-decimal list-inside space-y-2 ml-4">
              <li>Нажмите кнопку "Войти через Telegram" ниже</li>
              <li>Поделитесь своим контактом в боте</li>
              <li>Нажмите кнопку "Войти на сайт" в боте</li>
              <li>Вы автоматически вернётесь на сайт авторизованным</li>
            </ol>
          </div>
          <div className="text-center space-y-3">
            {!codeInputVisible ? (
              <>
                <a 
                  href={generateLoginLink()}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-block w-full px-6 py-3 bg-[#0088cc] text-white rounded-xl hover:bg-[#006699] transition-colors font-medium"
                >
                  📱 Войти через Telegram
                </a>
                <button
                  onClick={() => setCodeInputVisible(true)}
                  className="block w-full px-6 py-2 text-sm text-brand-secondary hover:text-brand-text transition-colors"
                >
                  Уже получили код? Введите его здесь
                </button>
                <p className="text-xs text-brand-secondary">
                  Откроется ваш Telegram с ботом {botInfo?.username ? (
                    <a
                      href={`https://t.me/${botInfo.username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-brand-text"
                    >
                      @{botInfo.username}
                    </a>
                  ) : (
                    '@PsyForm_bot'
                  )}
                </p>
              </>
            ) : (
              <form onSubmit={handleCodeSubmit} className="space-y-3">
                <input
                  type="text"
                  value={authCode}
                  onChange={(e) => setAuthCode(e.target.value)}
                  placeholder="Введите код из Telegram"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0088cc] focus:border-transparent"
                  disabled={verifying}
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={verifying || !authCode.trim()}
                    className="flex-1 px-4 py-2 bg-[#0088cc] text-white rounded-xl hover:bg-[#006699] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {verifying ? 'Проверяем...' : 'Войти'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {setCodeInputVisible(false); setAuthCode('');}}
                    className="px-4 py-2 text-brand-secondary hover:text-brand-text transition-colors"
                  >
                    Отмена
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Anchor for scrolling from errors */}
      <div id="tg-login" className="h-0 overflow-hidden" aria-hidden="true"></div>
      {me && <MiniAccount />}
      {overlayVisible && <Overlay />}
      
      {/* Optional modal for unauthorized users */}
      {!me && !loading && forceModal && <AuthModal />}

      {me && (
        <div className="p-4 mb-4 rounded-xl border border-green-200 bg-green-50">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-brand-secondary">Вы вошли как</div>
              <div className="text-brand-text font-semibold text-sm">
                {me.firstName || ''} {me.lastName || ''} {me.tgUsername ? `(@${me.tgUsername})` : ''}
              </div>
            </div>
            <button onClick={handleLogout} className="text-sm text-red-600 hover:underline">Выйти</button>
          </div>
        </div>
      )}
    </>
  );
}

export default TelegramLogin;
