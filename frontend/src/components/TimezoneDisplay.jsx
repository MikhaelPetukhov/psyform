import React, { useMemo } from 'react';
import { parseISO } from 'date-fns';
import { getCityByTimezone } from '../utils/russianCities';

const normalizeOffsetLabel = (label) => {
  if (!label) return null;
  const cleaned = label.replace('GMT', 'UTC').replace(/\s+/g, '');
  const match = cleaned.match(/^UTC([+-]?)(\d{1,2})(?::?(\d{2}))?/i);
  if (!match) return cleaned;

  const sign = match[1] === '-' ? '-' : '+';
  const hours = parseInt(match[2], 10);
  const minutes = match[3] ? parseInt(match[3], 10) : 0;

  if (!Number.isFinite(hours)) return cleaned;

  if (!minutes) {
    return `UTC${sign}${hours}`;
  }

  const paddedMinutes = minutes.toString().padStart(2, '0');
  return `UTC${sign}${hours}:${paddedMinutes}`;
};

export const getTimezoneMetadata = (timezone) => {
  if (!timezone) {
    return {
      cityName: null,
      offsetLabel: null,
      shortLabel: null,
      displayLabel: '',
    };
  }

  const city = getCityByTimezone(timezone);
  const cityName = city?.name || null;
  let offsetLabel = null;

  if (city?.utcOffset) {
    offsetLabel = normalizeOffsetLabel(`UTC${city.utcOffset}`);
  }

  let shortLabel = null;
  try {
    const parts = new Intl.DateTimeFormat('ru-RU', { timeZone: timezone, timeZoneName: 'short' }).formatToParts(new Date());
    const tzName = parts.find(p => p.type === 'timeZoneName')?.value;
    shortLabel = normalizeOffsetLabel(tzName || '') || null;
  } catch (_) {
    shortLabel = null;
  }

  if (!offsetLabel && shortLabel) {
    offsetLabel = shortLabel;
  }

  const displayLabel = cityName
    ? `${cityName}${offsetLabel ? ` (${offsetLabel})` : ''}`
    : (offsetLabel || timezone);

  return {
    cityName,
    offsetLabel,
    shortLabel,
    displayLabel,
  };
};

export const getTimezoneDisplayLabel = (timezone) => getTimezoneMetadata(timezone).displayLabel;

/**
 * Простой компонент для отображения времени
 * Для психологов - в их выбранном часовом поясе
 * Для клиентов - в локальном времени с fallback в МСК
 */
const TimezoneDisplay = ({ 
  utcTime, 
  practitionerTimezone = null,
  isAdmin = false,
  showDate = false,
  className = '',
  clientTimezoneOverride = null,
}) => {

  // Определяем часовой пояс
  const timezone = useMemo(() => {
    // Для психологов - используем их выбранный часовой пояс
    if (isAdmin && practitionerTimezone) {
      return practitionerTimezone;
    }
    
    // Для клиентов - локальное время с fallback в МСК
    if (!isAdmin) {
      if (clientTimezoneOverride) return clientTimezoneOverride;
      // Сначала пробуем взять выбор клиента из localStorage
      let storedTz = null;
      try {
        storedTz = (typeof window !== 'undefined') ? localStorage.getItem('clientTimezone') : null;
      } catch (_) {}
      if (storedTz && typeof storedTz === 'string') return storedTz;
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
      } catch (e) {
        return 'Europe/Moscow';
      }
    }
    
    // Fallback для админки без указанной зоны
    return 'Europe/Moscow';
  }, [isAdmin, practitionerTimezone, clientTimezoneOverride]);

  // Парсим UTC время
  const utcDate = useMemo(() => {
    if (!utcTime) return null;
    try {
      if (typeof utcTime === 'string') {
        return parseISO(utcTime);
      }
      return new Date(utcTime);
    } catch (e) {
      console.warn('Invalid UTC time:', utcTime);
      return null;
    }
  }, [utcTime]);

  // Форматируем время
  const formatTime = (date, includeDate = false) => {
    if (!date) return '—';
    
    try {
      const options = {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: timezone,
        hour12: false
      };
      
      if (includeDate) {
        options.day = '2-digit';
        options.month = '2-digit';
        options.year = 'numeric';
      }
      
      return new Intl.DateTimeFormat('ru-RU', options).format(date);
    } catch (e) {
      console.warn('Error formatting time:', e);
      return '—';
    }
  };


  if (!utcDate) {
    return <span className={className}>—</span>;
  }

  const timeString = formatTime(utcDate, showDate);
  
  // Подпись о московском времени для клиентов как fallback
  const showMoscowLabel = !isAdmin && timezone === 'Europe/Moscow';
  
  return (
    <span className={className}>
      {timeString}
      {showMoscowLabel && <span className="text-xs text-gray-500 ml-1">Все времена указаны по московскому времени (UTC+3)</span>}
    </span>
  );
};

/**
 * Простой компонент для отображения времени
 */
export const SimpleTimeDisplay = ({ 
  utcTime, 
  practitionerTimezone = null,
  isAdmin = false,
  className = '',
  clientTimezoneOverride = null,
}) => {
  return (
    <TimezoneDisplay 
      utcTime={utcTime}
      practitionerTimezone={practitionerTimezone}
      isAdmin={isAdmin}
      className={className}
      clientTimezoneOverride={clientTimezoneOverride}
    />
  );
};

/**
 * Компонент для отображения временного диапазона
 */
export const TimeRangeDisplay = ({
  startTime,
  endTime,
  practitionerTimezone = null,
  isAdmin = false,
  className = '',
  clientTimezoneOverride = null,
  showTimezoneLabel = false,
  timezoneLabelClassName = 'ml-1 text-xs font-medium text-brand-secondary',
}) => {
  const timezone = useMemo(() => {
    // Для психологов - используем их выбранный часовой пояс
    if (isAdmin && practitionerTimezone) {
      return practitionerTimezone;
    }
    
    // Для клиентов - локальное время с fallback в МСК
    if (!isAdmin) {
      if (clientTimezoneOverride) return clientTimezoneOverride;
      let storedTz = null;
      try {
        storedTz = (typeof window !== 'undefined') ? localStorage.getItem('clientTimezone') : null;
      } catch (_) {}
      if (storedTz && typeof storedTz === 'string') return storedTz;
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
      } catch (e) {
        return 'Europe/Moscow';
      }
    }
    
    return 'Europe/Moscow';
  }, [isAdmin, practitionerTimezone, clientTimezoneOverride]);

  const formatTimeRange = (start, end) => {
    if (!start || !end) return '—';
    
    try {
      const startDate = typeof start === 'string' ? parseISO(start) : new Date(start);
      const endDate = typeof end === 'string' ? parseISO(end) : new Date(end);
      
      const options = {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: timezone,
        hour12: false
      };
      
      const startFormatted = new Intl.DateTimeFormat('ru-RU', options).format(startDate);
      const endFormatted = new Intl.DateTimeFormat('ru-RU', options).format(endDate);
      
      return `${startFormatted}–${endFormatted}`;
    } catch (e) {
      console.warn('Error formatting time range:', e);
      return '—';
    }
  };

  const timeRange = formatTimeRange(startTime, endTime);
  const timezoneMeta = useMemo(() => getTimezoneMetadata(timezone), [timezone]);
  const label = timezoneMeta.displayLabel;
  const showLabel = showTimezoneLabel && label && timeRange !== '—';
  const showMoscowLabel = !isAdmin && timezone === 'Europe/Moscow' && !showTimezoneLabel;

  return (
    <span className={className}>
      <span className={showLabel ? 'inline-flex items-center' : undefined}>
        <span>{timeRange}</span>
        {showLabel && (
          <span className={timezoneLabelClassName}>
            · {label}
          </span>
        )}
      </span>
      {showMoscowLabel && <span className="text-xs text-gray-500 ml-1">Все времена указаны по московскому времени (UTC+3)</span>}
    </span>
  );
};

export default TimezoneDisplay;
