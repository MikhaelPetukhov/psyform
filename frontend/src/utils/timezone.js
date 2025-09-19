import { DateTime } from 'luxon';

export const DEFAULT_TIMEZONE = 'Europe/Moscow';
export const USER_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * Format time for display with timezone info
 * @param {string} utcISOString - UTC time in ISO format
 * @param {string} timezone - Display timezone
 * @param {object} options - Formatting options
 * @returns {object} Formatted time info
 */
export function formatTimeWithZone(utcISOString, timezone = DEFAULT_TIMEZONE, options = {}) {
  if (!utcISOString) return null;
  
  const dt = DateTime.fromISO(utcISOString, { zone: 'UTC' }).setZone(timezone);
  
  return {
    time: dt.toFormat(options.format || 'HH:mm'),
    date: dt.toFormat('dd.MM.yyyy'),
    full: dt.toFormat('dd.MM.yyyy HH:mm'),
    iso: dt.toISO(),
    timezone: timezone,
    offset: dt.offsetNameShort,
    zoneName: dt.zoneName,
    offsetDisplay: `UTC${dt.offset >= 0 ? '+' : ''}${Math.floor(dt.offset / 60)}`
  };
}

/**
 * Get timezone display name
 * @param {string} timezone 
 * @returns {string}
 */
export function getTimezoneDisplayName(timezone) {
  const names = {
    'Europe/Moscow': 'МСК',
    'Europe/London': 'GMT',
    'America/New_York': 'EST',
    'America/Los_Angeles': 'PST',
    'Asia/Tokyo': 'JST',
    'Australia/Sydney': 'AEST',
    'UTC': 'UTC'
  };
  
  return names[timezone] || timezone;
}

/**
 * Format time range with dual timezone display
 * @param {object} timeRange - API timeRange object
 * @param {boolean} showUserTimezone - Show user's timezone
 * @returns {object}
 */
export function formatTimeRangeDisplay(timeRange, showUserTimezone = false) {
  const moscowStart = formatTimeWithZone(timeRange.start_at_utc, 'Europe/Moscow');
  const moscowEnd = formatTimeWithZone(timeRange.end_at_utc, 'Europe/Moscow');
  
  const result = {
    moscow: {
      time: `${moscowStart.time}–${moscowEnd.time}`,
      date: moscowStart.date,
      full: `${moscowStart.time}–${moscowEnd.time} МСК (${moscowStart.offsetDisplay})`,
      timezone: 'МСК'
    }
  };

  if (showUserTimezone && USER_TIMEZONE !== 'Europe/Moscow') {
    const userStart = formatTimeWithZone(timeRange.start_at_utc, USER_TIMEZONE);
    const userEnd = formatTimeWithZone(timeRange.end_at_utc, USER_TIMEZONE);
    
    result.user = {
      time: `${userStart.time}–${userEnd.time}`,
      date: userStart.date,
      full: `${userStart.time}–${userEnd.time} ${getTimezoneDisplayName(USER_TIMEZONE)} (${userStart.offsetDisplay})`,
      timezone: getTimezoneDisplayName(USER_TIMEZONE)
    };
  }

  return result;
}

/**
 * Get current time in specified timezone
 * @param {string} timezone 
 * @returns {object}
 */
export function getCurrentTime(timezone = DEFAULT_TIMEZONE) {
  const now = DateTime.now().setZone(timezone);
  return {
    time: now.toFormat('HH:mm'),
    date: now.toFormat('yyyy-MM-dd'),
    full: now.toFormat('dd.MM.yyyy HH:mm'),
    iso: now.toISO(),
    timezone
  };
}

/**
 * Create time input for API
 * @param {string} time - Time in HH:mm format
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} timezone - Source timezone
 * @returns {object}
 */
export function createTimeInput(time, date, timezone = DEFAULT_TIMEZONE) {
  return {
    startTime: time,
    date,
    timezone
  };
}

/**
 * Check if user is in Moscow timezone
 * @returns {boolean}
 */
export function isUserInMoscow() {
  return USER_TIMEZONE === 'Europe/Moscow';
}

/**
 * Get timezone offset string
 * @param {string} timezone 
 * @returns {string}
 */
export function getTimezoneOffset(timezone) {
  const dt = DateTime.now().setZone(timezone);
  const offset = dt.offset / 60;
  return `UTC${offset >= 0 ? '+' : ''}${offset}`;
}
