import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import api from '../api';
import { toast } from 'react-hot-toast';

const AdminLogin = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { slug: routeSlug } = useParams();
  const [slug, setSlug] = useState('');

  // Prefill slug from route /psychologist/:slug/login or from query ?p=
  useEffect(() => {
    // Route param has higher priority
    if (routeSlug && routeSlug.trim()) {
      setSlug(routeSlug.trim());
      return;
    }
    // Then from query string
    try {
      const qs = new URLSearchParams(location.search || '');
      const qSlug = (qs.get('p') || qs.get('slug') || '').trim();
      if (qSlug) {
        setSlug(qSlug);
        return;
      }
    } catch (_) { /* ignore */ }
    // Finally from existing localStorage (if any)
    const stored = localStorage.getItem('practitionerSlug');
    if (stored) setSlug(stored);
  }, [routeSlug, location.search]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Ensure practitioner scoping header is present for login
      // Clear stale practitionerId so slug is used for scoping
      localStorage.removeItem('practitionerId');
      if (slug && slug.trim()) {
        localStorage.setItem('practitionerSlug', slug.trim());
      }
      const response = await api.post('/auth/login', { username: formData.username, password: formData.password });
      
      if (response.data.success) {
        // Tokens now stored in HttpOnly cookies automatically
        localStorage.setItem('practitionerId', response.data.practitionerId || '');
        localStorage.setItem('practitionerSlug', response.data.practitionerSlug || '');
        localStorage.setItem('role', response.data.role || 'admin');
        navigate('/psychologist/dashboard');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Ошибка авторизации');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-background flex items-center justify-center p-4">
      <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-xl border border-gray-200/60 p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-brand-text mb-2">
            Панель управления
          </h1>
          <p className="text-brand-secondary">
            Вход для специалиста
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-medium text-brand-secondary mb-1.5">
              Профиль специалиста (slug)
            </label>
            <input
              type="text"
              name="practitionerSlug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              autoComplete="off"
              className="w-full px-4 py-2.5 bg-white border border-gray-300/70 rounded-lg focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 transition-colors text-sm text-brand-text placeholder-gray-400"
              placeholder="mikhael"
            />
            <p className="mt-1 text-xs text-gray-500">Укажите адрес профиля (например, mikhael). Это нужно для правильной аренды.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-brand-secondary mb-1.5">
              Имя пользователя
            </label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              autoComplete="username"
              className="w-full px-4 py-2.5 bg-white border border-gray-300/70 rounded-lg focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 transition-colors text-sm text-brand-text placeholder-gray-400"
              placeholder="admin"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-brand-secondary mb-1.5">
              Пароль
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              className="w-full px-4 py-2.5 bg-white border border-gray-300/70 rounded-lg focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 transition-colors text-sm text-brand-text placeholder-gray-400"
              placeholder="••••••••"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-5 rounded-xl font-bold text-base transition-all duration-300 transform disabled:cursor-not-allowed bg-brand-accent text-white hover:bg-brand-accent/90 hover:shadow-lg hover:scale-[1.02] focus:outline-none focus:ring-4 focus:ring-brand-accent/30 disabled:bg-gray-300 disabled:text-gray-500 disabled:scale-100 disabled:shadow-none"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                  <span>Вход...</span>
                </div>
              ) : (
                <span>Войти</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;
