import api from '../api';

export async function createCall(bookingId, ttlMinutes) {
  const { data } = await api.post('/calls', { bookingId, ttlMinutes });
  return data;
}

export async function inviteCall(id, payload = {}) {
  const { data } = await api.post(`/calls/${id}/invite`, payload);
  return data;
}

export async function closeCall(id) {
  const { data } = await api.post(`/calls/${id}/close`);
  return data;
}

export async function getCallStatus(id) {
  const { data } = await api.get(`/calls/${id}/status`);
  return data;
}

export async function logCallEvent(id, event, metadata = null) {
  const { data } = await api.post(`/calls/${id}/log`, { event, metadata });
  return data;
}

export async function getInviteCandidates(id) {
  const { data } = await api.get(`/calls/${id}/invite/candidates`);
  return data?.rows || [];
}
