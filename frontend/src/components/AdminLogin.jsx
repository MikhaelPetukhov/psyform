import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { toast } from 'react-hot-toast';

const AdminLogin = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('password');
  const [slug, setSlug] = useState('virtualsect');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/auth/admin/me');
        if (!cancelled && res?.data?.ok && res.data.practitionerSlug) {
          try { localStorage.setItem('practitionerSlug', res.data.practitionerSlug); } catch (_) {}
          try { localStorage.setItem('practitionerId', res.data.practitionerId || ''); } catch (_) {}
          if (res.data.practitionerPublicSlug) {
            try { localStorage.setItem('practitionerPublicSlug', res.data.practitionerPublicSlug); } catch (_) {}
          }
          navigate(`/psychologist/${res.data.practitionerSlug}`, { replace: true });
          return;
        }
      } catch (_) { /* not authorized */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password || !slug) return;
    setSubmitting(true);
    try {
      const { data } = await api.post('/auth/login', { username, password }, {
        headers: { 'x-practitioner-slug': slug },
      });
      const respSlug = data?.practitionerSlug || slug;
      const practitionerId = data?.practitionerId;
      if (practitionerId) { try { localStorage.setItem('practitionerId', practitionerId); } catch (_) {} }
      if (respSlug) { try { localStorage.setItem('practitionerSlug', respSlug); } catch (_) {} }
      toast.success('Вход выполнен');
      navigate(`/psychologist/${encodeURIComponent(respSlug)}`);
    } catch (err) {
      toast.error('Неверные учётные данные');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span>Загрузка...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-background flex items-center justify-center p-4">
      <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-xl border border-gray-200/60 p-8">
        <h1 className="text-2xl font-bold mb-6">Вход в кабинет</h1>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1">Логин</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              autoComplete="username"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Slug кабинета</label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            />
            <div className="text-xs text-gray-500 mt-1">Например: virtualsect</div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2 rounded-lg bg-black text-white disabled:opacity-50"
          >
            {submitting ? 'Входим...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;
