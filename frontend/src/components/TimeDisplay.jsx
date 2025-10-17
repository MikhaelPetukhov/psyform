// DEPRECATED: Этот компонент больше не используется в UI.
// Используйте компоненты из `components/TimezoneDisplay.jsx` (Intl) вместо Luxon-обёрток.
import React, { useState } from 'react';
import { formatTimeRangeDisplay, isUserInMoscow, getTimezoneOffset, USER_TIMEZONE } from '../utils/timezone';
import { useI18n } from '../locale/i18n';

/**
 * Component for displaying time with timezone support
 */
const TimeDisplay = ({ timeRange, showToggle = false, compact = false }) => {
  const { t } = useI18n();
  const [showUserTimezone, setShowUserTimezone] = useState(false);
  
  if (!timeRange) return null;
  
  const display = formatTimeRangeDisplay(timeRange, showUserTimezone);
  const userInMoscow = isUserInMoscow();

  if (compact) {
    return (
      <span className="time-display">
        <span className="time-main">{display.moscow.time}</span>
        <span className="time-zone"> {t('timeDisplay.msk')}</span>
        {showUserTimezone && display.user && (
          <>
            <span className="time-separator"> • </span>
            <span className="time-user">{display.user.time} {display.user.timezone}</span>
          </>
        )}
      </span>
    );
  }

  return (
    <div className="time-display">
      <div className="time-primary">
        <span className="time-main">{display.moscow.time}</span>
        <span className="time-zone-info"> {t('timeDisplay.msk')} ({getTimezoneOffset('Europe/Moscow')})</span>
      </div>
      
      {showUserTimezone && display.user && (
        <div className="time-secondary">
          <span className="time-user">{display.user.time}</span>
          <span className="time-zone-info"> {display.user.timezone} ({getTimezoneOffset(USER_TIMEZONE)})</span>
        </div>
      )}

      {showToggle && !userInMoscow && (
        <div className="time-toggle">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={showUserTimezone}
              onChange={(e) => setShowUserTimezone(e.target.checked)}
              className="toggle-checkbox"
            />
            <span className="toggle-text">{t('timeDisplay.showInMyTz')}</span>
          </label>
        </div>
      )}
    </div>
  );
};

export default TimeDisplay;
