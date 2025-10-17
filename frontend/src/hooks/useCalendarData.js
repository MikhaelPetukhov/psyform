import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { getBookings, getSlots } from '../api/calendar';

const mapBooking = (booking) => ({
  id: booking.id,
  title: booking.clientName,
  start: new Date(booking.slotTime),
  end: new Date(booking.endTime),
  clientName: booking.clientName,
  clientPhone: booking.clientPhone,
  telegramHandle: ((booking.telegramUsername || booking.clientTelegram || '') + '').replace(/^@/, ''),
  status: booking.status,
  clientConfirmation: booking.clientConfirmation,
  preferredContact: booking.preferredContact,
  sourceTimezone: booking.sourceTimezone,
});

const flattenSlots = (slotGroups) => {
  const result = [];
  Object.keys(slotGroups || {}).forEach((key) => {
    (slotGroups[key] || []).forEach((slot) => {
      result.push(slot);
    });
  });
  return result;
};

export const useCalendarData = () => {
  const [events, setEvents] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const fetchBookings = useCallback(async () => {
    try {
      setLoadingBookings(true);
      const response = await getBookings();
      const bookings = response.data || [];
      setEvents(bookings.map(mapBooking));
    } catch (error) {
      console.error('Failed to fetch bookings', error);
      const message = error?.response?.data?.msg || error?.response?.data?.message || 'Ошибка загрузки записей';
      toast.error(message);
    } finally {
      setLoadingBookings(false);
    }
  }, []);

  const fetchSlots = useCallback(async () => {
    try {
      setLoadingSlots(true);
      const response = await getSlots();
      setSlots(flattenSlots(response.data));
    } catch (error) {
      console.error('Failed to fetch slots', error);
      const message = error?.response?.data?.msg || error?.response?.data?.message || 'Ошибка загрузки слотов';
      toast.error(message);
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  const refreshData = useCallback(() => {
    fetchBookings();
    fetchSlots();
  }, [fetchBookings, fetchSlots]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  return {
    events,
    slots,
    loadingBookings,
    loadingSlots,
    refreshData,
  };
};
