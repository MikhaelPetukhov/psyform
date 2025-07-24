import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { toast } from 'react-hot-toast';

const AdminLogin = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

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
      const response = await api.post('/auth/login', formData);
      
      if (response.data.success) {
        localStorage.setItem('adminToken', response.data.token);
        navigate('/psychologist');
        toast.success('Успешная авторизация!');
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
