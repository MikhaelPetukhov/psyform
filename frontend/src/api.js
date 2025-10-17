import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Add a request interceptor to include practitioner headers
api.interceptors.request.use(
  (config) => {
    // Tokens are now handled via HttpOnly cookies automatically
    // Remove localStorage token handling for security

    // Attach practitioner headers for multi-tenant scoping
    try {
      // Prefer explicit ID, fallback to slug, then public slug
      const pId = localStorage.getItem('practitionerId') || (typeof window !== 'undefined' && window.__PRACTITIONER_ID__);
      const pSlug = localStorage.getItem('practitionerSlug') || (typeof window !== 'undefined' && window.__PRACTITIONER_SLUG__);
      const pPublicSlug = localStorage.getItem('practitionerPublicSlug') || (typeof window !== 'undefined' && window.__PRACTITIONER_PUBLIC_SLUG__);
      if (pId) {
        config.headers['x-practitioner-id'] = pId;
      }
      if (pSlug) {
        config.headers['x-practitioner-slug'] = pSlug;
      }
      if (!pId && !pSlug && pPublicSlug) {
        config.headers['x-practitioner-public-slug'] = pPublicSlug;
      }
    } catch (e) {
      // no-op: do not block request if headers can't be set
    }
    // Attach client timezone for better UX and correct booking sourceTimezone
    try {
      const tz = localStorage.getItem('clientTimezone') || (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : null);
      if (tz) config.headers['x-client-timezone'] = tz;
    } catch (_) { /* ignore */ }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;

// Global response interceptor for user-friendly error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    try {
      const status = error?.response?.status;
      const suppress = error?.config && (error.config._suppressGlobalError || error.config.headers?.['X-Suppress-Error']);
      if (!suppress) {
        if (status >= 500) {
          toast.error('Произошла ошибка на сервере. Попробуйте ещё раз.');
        } else if (!error.response) {
          toast.error('Не удалось подключиться к серверу. Проверьте соединение и попробуйте ещё раз.');
        }
      }
    } catch (_) { /* ignore */ }
    return Promise.reject(error);
  }
);
