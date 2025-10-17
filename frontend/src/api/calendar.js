import api from '../api';

export const getBookings = () => api.get('/bookings');

export const getSlots = () => api.get('/slots', { params: { ts: Date.now() } });

export const deleteSlot = (slotId) => api.delete(`/slots/${slotId}`);

export const deleteBooking = (bookingId) => api.delete(`/bookings/${bookingId}`);

export const createBooking = (payload) => api.post('/bookings', payload);

export const createSlot = (payload) => {
  try {
    const pId = localStorage.getItem('practitionerId') || '';
    const key = `${pId}:${payload?.date || ''}:${payload?.startTime || ''}:${payload?.endTime || ''}:${payload?.timezone || ''}`;
    return api.post('/slots/create', payload, { headers: { 'Idempotency-Key': key } });
  } catch (_) {
    return api.post('/slots/create', payload);
  }
};

export const getScheduleSettings = () => api.get('/admin/schedule-settings');

export const searchClients = (query) => api.get('/bookings/clients', { params: { q: query } });
