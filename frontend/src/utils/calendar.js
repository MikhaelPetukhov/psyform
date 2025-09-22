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
