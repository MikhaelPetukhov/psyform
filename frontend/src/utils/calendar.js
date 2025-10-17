export const getClientsFocusUrl = (bookingId) => {
  try {
    const slug = typeof window !== 'undefined' ? (localStorage.getItem('practitionerSlug') || '') : '';
    if (slug) {
      return `/psychologist/${encodeURIComponent(slug)}?tab=bookings&focus=${encodeURIComponent(bookingId)}`;
    }
    return `/psychologist?tab=bookings&focus=${encodeURIComponent(bookingId)}`;
  } catch (error) {
    return `/psychologist?tab=bookings&focus=${encodeURIComponent(bookingId)}`;
  }
};

// Build Google Calendar event URL for a booking
export const buildGoogleCalendarUrl = (booking, practitionerTimezone = 'Europe/Moscow') => {
  const fmt = (d) => {
    const dt = new Date(d);
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const day = String(dt.getUTCDate()).padStart(2, '0');
    const hh = String(dt.getUTCHours()).padStart(2, '0');
    const mm = String(dt.getUTCMinutes()).padStart(2, '0');
    const ss = String(dt.getUTCSeconds()).padStart(2, '0');
    return `${y}${m}${day}T${hh}${mm}${ss}Z`;
  };

  const start = fmt(booking?.start);
  const end = fmt(booking?.end);
  const base = 'https://calendar.google.com/calendar/render?action=TEMPLATE';
  const dates = `dates=${start}/${end}`;
  const ctz = `ctz=${encodeURIComponent(practitionerTimezone || 'Europe/Moscow')}`;
  return `${base}&${dates}&${ctz}`;
};
