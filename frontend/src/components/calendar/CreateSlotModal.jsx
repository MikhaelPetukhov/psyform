import React, { useEffect, useState } from 'react';
import { addMinutes, format, parse } from 'date-fns';
import toast from 'react-hot-toast';

import { createSlot, getScheduleSettings } from '../../api/calendar';

const CreateSlotModal = ({
  defaultDate,
  onClose,
  onCreated,
  existingBookings = [],
  practitionerTimezone = 'Europe/Moscow',
}) => {
  const [dateStr, setDateStr] = useState(format(defaultDate || new Date(), 'yyyy-MM-dd'));
  const [timeStart, setTimeStart] = useState('10:00');
  const [timeEnd, setTimeEnd] = useState('11:00');
  const [loading, setLoading] = useState(false);
  const [scheduleSettings, setScheduleSettings] = useState(null);
  const [breakWarning, setBreakWarning] = useState('');
  const [autoEndEnabled, setAutoEndEnabled] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data } = await getScheduleSettings();
        setScheduleSettings(data);

        const dayBookings = existingBookings
          .filter((booking) => format(new Date(booking.start), 'yyyy-MM-dd') === dateStr)
          .sort((a, b) => new Date(a.start) - new Date(b.start));

        if (dayBookings.length > 0 && data) {
          const lastBooking = dayBookings[dayBookings.length - 1];
          const lastEnd = new Date(lastBooking.end);
          const breakMinutes = data.breakBetweenSessions || 15;
          const sessionMinutes = data.sessionDuration || 60;

          const suggestedStart = new Date(lastEnd.getTime() + breakMinutes * 60000);
          const suggestedEnd = new Date(suggestedStart.getTime() + sessionMinutes * 60000);

          setTimeStart(format(suggestedStart, 'HH:mm'));
          setTimeEnd(format(suggestedEnd, 'HH:mm'));
        } else if (data?.workingHours?.start) {
          const sessionMinutes = data.sessionDuration || 60;
          const startTime = parse(data.workingHours.start, 'HH:mm', new Date());
          const endTime = addMinutes(startTime, sessionMinutes);

          setTimeStart(data.workingHours.start);
          setTimeEnd(format(endTime, 'HH:mm'));
        }
      } catch (error) {
        console.warn('Could not load schedule settings:', error);
      }
    };

    if (dateStr) {
      loadSettings();
    }
  }, [dateStr, existingBookings]);

  useEffect(() => {
    if (!autoEndEnabled || !timeStart) return;

    try {
      const minutes = scheduleSettings?.sessionDuration ? Number(scheduleSettings.sessionDuration) : 60;
      const start = parse(timeStart, 'HH:mm', new Date());
      const end = addMinutes(start, Number.isFinite(minutes) && minutes > 0 ? minutes : 60);
      setTimeEnd(format(end, 'HH:mm'));
    } catch (error) {
      // ignore parsing errors
    }
  }, [timeStart, scheduleSettings, autoEndEnabled]);

  useEffect(() => {
    if (!scheduleSettings?.lunchBreak?.enabled || !timeStart || !timeEnd) {
      setBreakWarning('');
      return;
    }

    const { start: lunchStart, end: lunchEnd } = scheduleSettings.lunchBreak;
    const slotStart = parse(timeStart, 'HH:mm', new Date());
    const slotEnd = parse(timeEnd, 'HH:mm', new Date());
    const breakStart = parse(lunchStart, 'HH:mm', new Date());
    const breakEnd = parse(lunchEnd, 'HH:mm', new Date());

    const overlaps =
      (slotStart >= breakStart && slotStart < breakEnd) ||
      (slotEnd > breakStart && slotEnd <= breakEnd) ||
      (slotStart < breakStart && slotEnd > breakEnd);

    if (overlaps) {
      setBreakWarning(`⚠️ Этот слот пересекается с обеденным перерывом (${lunchStart}-${lunchEnd}). Точно желаете создать?`);
    } else {
      setBreakWarning('');
    }
  }, [timeStart, timeEnd, scheduleSettings]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (breakWarning && !window.confirm(breakWarning)) {
      return;
    }

    setLoading(true);
    try {
      await createSlot({
        startTime: timeStart,
        endTime: timeEnd,
        date: dateStr,
        timezone: practitionerTimezone,
      });
      if (onCreated) onCreated();
      onClose();
    } catch (error) {
      console.error('Failed to create slot', error);
      const message = error?.response?.data?.msg || error?.response?.data?.message || 'Ошибка при создании слота';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg w-96 shadow-lg flex flex-col gap-3">
        <h4 className="text-lg font-semibold mb-1">Создать слот</h4>
        <div className="text-xs text-gray-600 mb-3">
          Время указывается в часовом поясе: <span className="font-medium">{practitionerTimezone}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2">
            <label className="text-xs text-gray-500">Дата</label>
            <input
              type="date"
              value={dateStr}
              onChange={(event) => setDateStr(event.target.value)}
              className="border rounded px-2 py-1 text-sm w-full"
              required
            />
          </div>
          <div className="col-span-1">
            <label className="text-xs text-gray-500">Начало</label>
            <input
              type="time"
              value={timeStart}
              onChange={(event) => {
                setTimeStart(event.target.value);
              }}
              className="border rounded px-2 py-1 text-sm w-full"
              required
            />
          </div>
          <div className="col-span-1">
            <label className="text-xs text-gray-500">Окончание</label>
            <input
              type="time"
              value={timeEnd}
              onChange={(event) => {
                setAutoEndEnabled(false);
                setTimeEnd(event.target.value);
              }}
              className="border rounded px-2 py-1 text-sm w-full"
              required
            />
          </div>
        </div>
        {breakWarning && (
          <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">{breakWarning}</div>
        )}
        <div className="flex justify-end gap-2 mt-2">
          <button type="button" onClick={onClose} className="px-3 py-1 rounded text-sm bg-gray-100 hover:bg-gray-200">
            Отмена
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-3 py-1 rounded text-sm bg-brand-accent text-white"
          >
            {loading ? 'Создание...' : 'Создать'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateSlotModal;
