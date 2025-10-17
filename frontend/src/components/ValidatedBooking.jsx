import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import BookingForm from './BookingForm';
import { useI18n } from '../locale/i18n';

function Spinner({ message }) {
  return (
    <div className="flex flex-col items-center justify-center p-10 bg-brand-background rounded-2xl">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-accent"></div>
      <p className="mt-4 text-brand-secondary">{message}</p>
    </div>
  );
}

export default function ValidatedBooking() {
  const { slug } = useParams();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notFound, setNotFound] = useState(false);

  const fetchPractitioner = useCallback(async () => {
    const s = (slug || '').trim();
    if (!s) {
      setNotFound(true);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const { data } = await api.get(`/practitioners/public/${encodeURIComponent(s)}`);
      const p = data?.practitioner || null;
      if (!p) {
        setNotFound(true);
        return;
      }
      try {
        // Only set public slug after validation
        localStorage.removeItem('practitionerId');
        localStorage.removeItem('practitionerSlug');
        localStorage.setItem('practitionerPublicSlug', p.publicSlug);
        if (typeof window !== 'undefined') {
          window.__PRACTITIONER_ID__ = undefined;
          window.__PRACTITIONER_SLUG__ = undefined;
          window.__PRACTITIONER_PUBLIC_SLUG__ = p.publicSlug;
        }
      } catch (_) {}
    } catch (e) {
      if (e?.response?.status === 404) {
        setNotFound(true);
      } else {
        setError(t('errors.tryAgain'));
      }
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchPractitioner();
  }, [fetchPractitioner]);

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-background flex items-center justify-center p-4">
        <Spinner message={t('validatedBooking.loading')} />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-brand-background flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow p-6 text-center">
          <h2 className="text-xl font-bold text-brand-text mb-2">{t('validatedBooking.notFoundTitle')}</h2>
          <p className="text-sm text-brand-secondary mb-4">{t('validatedBooking.notFoundText')}</p>
          <a href="/" className="inline-block px-5 py-2.5 rounded-lg bg-brand-accent text-white hover:bg-brand-accent/90">{t('validatedBooking.home')}</a>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-brand-background flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow p-6 text-center">
          <h2 className="text-xl font-bold text-brand-text mb-2">{t('validatedBooking.errorTitle')}</h2>
          <p className="text-sm text-brand-secondary mb-4">{error}</p>
          <button onClick={fetchPractitioner} className="inline-block px-5 py-2.5 rounded-lg bg-brand-accent text-white hover:bg-brand-accent/90">{t('validatedBooking.retry')}</button>
        </div>
      </div>
    );
  }

  // All good
  return <BookingForm />;
}
