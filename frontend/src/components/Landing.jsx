import React from 'react';
import { useI18n } from '../locale/i18n';

const Landing = () => {
  const { t } = useI18n();
  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-background">
      <h1 className="text-4xl sm:text-6xl font-extrabold text-brand-text">{t('landing.title')}</h1>
    </div>
  );
};

export default Landing;
