const { DateTime } = require('luxon');

/**
 * Simplified timezone utilities for psychologist-client system
 * - Database stores everything in UTC (timestamptz)
 * - Psychologists work in their chosen timezone
 * - Clients see local time with fallback to Moscow
 */

const DEFAULT_TIMEZONE = 'Europe/Moscow';

// Popular timezones for psychologist selection
const POPULAR_TIMEZONES = [
  'Europe/Moscow',
  'Europe/Kaliningrad', 
  'Europe/Samara',
  'Asia/Yekaterinburg',
  'Asia/Omsk',
  'Asia/Krasnoyarsk',
  'Asia/Irkutsk',
  'Asia/Yakutsk',
  'Asia/Vladivostok',
  'Asia/Magadan',
  'Asia/Kamchatka',
  'Europe/Kiev',
  'Europe/Minsk',
  'Asia/Almaty',
  'Asia/Tashkent',
  'Asia/Tbilisi'
];

/**
 * Convert local time to UTC
 * @param {string|Date} localTime - Local time
 * @param {string} timezone - Source timezone (default: Europe/Moscow)
 * @returns {Date} UTC Date object
 */
function toUTC(localTime, timezone = DEFAULT_TIMEZONE) {
  if (!localTime) return null;
  
  const dt = DateTime.fromISO(localTime.toString(), { zone: timezone });
  if (!dt.isValid) {
    throw new Error(`Invalid date/time: ${localTime}`);
  }
  
  return dt.toUTC().toJSDate();
}

/**
 * Convert UTC time to specific timezone
 * @param {Date} utcTime - UTC time
 * @param {string} timezone - Target timezone (default: Europe/Moscow)
 * @returns {string} ISO string in target timezone
 */
function fromUTC(utcTime, timezone = DEFAULT_TIMEZONE) {
  if (!utcTime) return null;
  
  const dt = DateTime.fromJSDate(utcTime, { zone: 'UTC' });
  return dt.setZone(timezone).toISO();
}

/**
 * Format time for display with timezone info
 * @param {Date} utcTime - UTC time
 * @param {string} timezone - Display timezone
 * @param {object} options - Formatting options
 * @returns {object} Formatted time info
 */
function formatTimeWithZone(utcTime, timezone = DEFAULT_TIMEZONE, options = {}) {
  if (!utcTime) return null;
  
  const dt = DateTime.fromJSDate(utcTime, { zone: 'UTC' }).setZone(timezone);
  
  return {
    time: dt.toFormat(options.format || 'HH:mm'),
    date: dt.toFormat('dd.MM.yyyy'),
    full: dt.toFormat('dd.MM.yyyy HH:mm'),
    iso: dt.toISO(),
    timezone: timezone,
    offset: dt.offsetNameShort,
    zoneName: dt.zoneName
  };
}

/**
 * Get timezone offset info
 * @param {string} timezone 
 * @returns {object} Timezone info
 */
function getTimezoneInfo(timezone = DEFAULT_TIMEZONE) {
  const dt = DateTime.now().setZone(timezone);
  return {
    name: timezone,
    offset: dt.offsetNameShort,
    offsetMinutes: dt.offset,
    zoneName: dt.zoneName
  };
}

/**
 * Validate timezone string
 * @param {string} timezone 
 * @returns {boolean}
 */
function isValidTimezone(timezone) {
  if (!timezone) return false;
  const dt = DateTime.now().setZone(timezone);
  // Luxon does not throw on invalid zone; check isValid and zoneName
  return !!(dt && dt.isValid && dt.zone && typeof dt.zone.name === 'string' && dt.zone.name.toLowerCase() === String(timezone).toLowerCase());
}

/**
 * Create time range for API responses
 * @param {Date|string} startUTC 
 * @param {Date|string} endUTC 
 * @param {string} sourceTimezone 
 * @returns {object}
 */
function createTimeRange(startUTC, endUTC, sourceTimezone = DEFAULT_TIMEZONE) {
  // Convert strings to DateTime objects if needed
  const startDateTime = typeof startUTC === 'string' ? DateTime.fromISO(startUTC, { zone: 'utc' }) : DateTime.fromJSDate(startUTC, { zone: 'utc' });
  const endDateTime = typeof endUTC === 'string' ? DateTime.fromISO(endUTC, { zone: 'utc' }) : DateTime.fromJSDate(endUTC, { zone: 'utc' });
  
  return {
    start_at_utc: startDateTime.toISO(),
    end_at_utc: endDateTime.toISO(),
    source_timezone: sourceTimezone,
    display: {
      moscow: {
        start: formatTimeWithZone(startDateTime.toJSDate(), 'Europe/Moscow'),
        end: formatTimeWithZone(endDateTime.toJSDate(), 'Europe/Moscow')
      },
      source: sourceTimezone !== 'Europe/Moscow' ? {
        start: formatTimeWithZone(startDateTime.toJSDate(), sourceTimezone),
        end: formatTimeWithZone(endDateTime.toJSDate(), sourceTimezone)
      } : null
    }
  };
}

/**
 * Parse time input from frontend
 * @param {string} timeString - Time in format "HH:mm" or ISO string
 * @param {string} date - Date in format "YYYY-MM-DD"
 * @param {string} timezone - Source timezone
 * @returns {Date} UTC Date object
 */
function parseTimeInput(timeString, date, timezone = DEFAULT_TIMEZONE) {
  let dateTimeString;
  
  if (timeString.includes('T') || timeString.includes('Z')) {
    // Already ISO format
    dateTimeString = timeString;
  } else {
    // Combine date and time
    dateTimeString = `${date}T${timeString}:00`;
  }
  
  return toUTC(dateTimeString, timezone);
}

/**
 * Format time for client or psychologist display
 * @param {Date} utcTime - UTC time from database
 * @param {string} timezone - Target timezone for display
 * @returns {string} Formatted time in HH:mm format
 */
function formatTimeForDisplay(utcTime, timezone = DEFAULT_TIMEZONE) {
  if (!utcTime) return null;
  
  const dt = DateTime.fromJSDate(utcTime, { zone: 'UTC' });
  return dt.setZone(timezone).toFormat('HH:mm');
}

/**
 * Get timezone display name for UI
 * @param {string} timezone - IANA timezone identifier
 * @returns {string} Human-readable timezone name
 */
function getTimezoneDisplayName(timezone) {
  const names = {
    'Europe/Moscow': 'Москва (UTC+3)',
    'Europe/Kaliningrad': 'Калининград (UTC+2)', 
    'Europe/Samara': 'Самара (UTC+4)',
    'Asia/Yekaterinburg': 'Екатеринбург (UTC+5)',
    'Asia/Omsk': 'Омск (UTC+6)',
    'Asia/Krasnoyarsk': 'Красноярск (UTC+7)',
    'Asia/Irkutsk': 'Иркутск (UTC+8)',
    'Asia/Yakutsk': 'Якутск (UTC+9)',
    'Asia/Vladivostok': 'Владивосток (UTC+10)',
    'Asia/Magadan': 'Магадан (UTC+11)',
    'Asia/Kamchatka': 'Камчатка (UTC+12)',
    'Europe/Kiev': 'Киев (UTC+2)',
    'Europe/Minsk': 'Минск (UTC+3)',
    'Asia/Almaty': 'Алматы (UTC+6)',
    'Asia/Tashkent': 'Ташкент (UTC+5)',
    'Asia/Tbilisi': 'Тбилиси (UTC+4)'
  };
  
  return names[timezone] || timezone;
}

/**
 * Get practitioner timezone from database or default
 * @param {object} practitioner - Practitioner object with timezone field
 * @returns {string} IANA timezone identifier
 */
function getPractitionerTimezone(practitioner) {
  if (!practitioner) return DEFAULT_TIMEZONE;
  return practitioner.timezone || DEFAULT_TIMEZONE;
}

/**
 * Legacy formatSlotTime function for backward compatibility
 * @param {Date} utcTime - UTC time from database
 * @param {string} sourceTimezone - Original timezone when slot was created
 * @returns {string} Formatted time in HH:mm format
 */
function formatSlotTime(utcTime, sourceTimezone = DEFAULT_TIMEZONE) {
  return formatTimeForDisplay(utcTime, sourceTimezone);
}

module.exports = {
  DEFAULT_TIMEZONE,
  POPULAR_TIMEZONES,
  toUTC,
  fromUTC,
  formatTimeWithZone,
  getTimezoneInfo,
  isValidTimezone,
  createTimeRange,
  parseTimeInput,
  formatTimeForDisplay,
  formatSlotTime,
  getTimezoneDisplayName,
  getPractitionerTimezone
};
