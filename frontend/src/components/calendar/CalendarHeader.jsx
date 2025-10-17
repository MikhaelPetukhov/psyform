import React from 'react';
import { useI18n } from '../../locale/i18n';

const CalendarHeader = ({ nowStr, zoneLabel, onTimezoneClick }) => {
  const { t } = useI18n();
  const handleEditTimezone = React.useCallback(() => {
    try {
      localStorage.setItem('adminActiveTab', 'profile');
      localStorage.setItem('profile.openTimezone', '1');
    } catch (_) {}
    const slug = (() => {
      try {
        return (
          localStorage.getItem('practitionerSlug') ||
          localStorage.getItem('practitionerPublicSlug') ||
          ''
        );
      } catch (_) { return ''; }
    })();
    window.location.assign(slug ? `/psychologist/${slug}` : '/psychologist');
  }, []);

  const clickHandler = onTimezoneClick || handleEditTimezone;
  return (
    <div className="w-full bg-transparent">
      <div className="max-w-[1200px] mx-auto px-4 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-brand-text">{t('calendarHeader.title')}</h1>
        <button
          type="button"
          onClick={clickHandler}
          className="inline-flex items-center gap-2 rounded-full bg-gray-900 text-white px-3 py-1 text-sm hover:bg-black"
          title={t('calendarHeader.changeTimezoneTitle')}
        >
          <span>{t('calendarHeader.nowLabel')}: {nowStr}</span>
          <span className="opacity-60">·</span>
          <span>{t('calendarHeader.myZoneLabel')}: {zoneLabel}</span>
        </button>
      </div>
    </div>
  );
};

export default CalendarHeader;
