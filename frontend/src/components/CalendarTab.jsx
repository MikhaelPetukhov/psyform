import React, { useEffect, useState, useRef } from 'react';
import { FiChevronLeft, FiChevronRight, FiX, FiPhone, FiPlus, FiCalendar, FiSettings, FiLogOut } from 'react-icons/fi';
import { FaTelegramPlane, FaWhatsapp } from 'react-icons/fa';
import toast from 'react-hot-toast';

import {
  startOfWeek,
  endOfWeek,
  addDays,
  addMinutes,
  format,
  parse,
  parseISO,
  startOfMonth,
  endOfMonth,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  startOfDay,
  setMonth,
} from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import { ru } from 'date-fns/locale';
import TimezoneDisplay, { TimeRangeDisplay, SimpleTimeDisplay } from './TimezoneDisplay';
import Cleave from 'cleave.js/react';
import 'cleave.js/dist/addons/cleave-phone.i18n';
import { normalizePhoneForSubmit } from '../utils/phoneFormat';
import api from '../api';
import ScheduleSettingsTab from './ScheduleSettingsTab';
import RescheduleModal from './RescheduleModal';
import '../styles/calendar.css';

// Helpers for coloring and icons
const statusClass = (status, clientConfirmation) => {
  if (clientConfirmation === 'pending') return 'status-pending';
  if (clientConfirmation === 'confirmed') return 'status-confirmed';
  if (clientConfirmation === 'declined') return 'status-cancelled';
  switch (status) {
    case 'confirmed':
      return 'status-confirmed';
    case 'cancelled':
      return 'status-cancelled';
    case 'completed':
      return 'status-completed';
    default:
      return '';
  }
};

const ContactIcon = ({ method }) => {
  if (method === 'telegram') return <FaTelegramPlane className="contact-icon tg" title="Telegram" />;
  if (method === 'whatsapp') return <FaWhatsapp className="contact-icon wa" title="WhatsApp" />;
  return <FiPhone className="contact-icon ph" title="Телефон" />;
};

// Build link to Bookings tab with focus on a specific booking
const clientsFocusUrl = (bookingId) => {
  try {
    const slug = typeof window !== 'undefined' ? (localStorage.getItem('practitionerSlug') || '') : '';
    if (slug) return `/psychologist/${encodeURIComponent(slug)}?tab=bookings&focus=${encodeURIComponent(bookingId)}`;
    return `/psychologist?tab=bookings&focus=${encodeURIComponent(bookingId)}`;
  } catch (_) {
    return `/psychologist?tab=bookings&focus=${encodeURIComponent(bookingId)}`;
  }
};

// Month names for the dropdown. Using a fixed year ensures correct locale formatting
const months = Array.from({ length: 12 }, (_, i) =>
  format(new Date(2025, i, 1), 'LLLL', { locale: ru })
);

const BookingDetailsModal = ({ booking, onClose, practitionerTimezone, onUpdated, onReschedule }) => {
  if (!booking) return null;

  const toGCalDate = (d) => {
    const iso = new Date(d).toISOString();
    // 2025-08-29T12:30:00.000Z -> 20250829T123000Z
    return iso.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  };
  const buildGoogleCalendarUrl = (b) => {
    const text = encodeURIComponent(`Сессия: ${b.clientName}`);
    const details = encodeURIComponent(`Телефон: ${b.clientPhone || '—'}`);
    const dates = `${toGCalDate(b.start)}/${toGCalDate(b.end)}`;
    const ctz = encodeURIComponent('Europe/Moscow');
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}&ctz=${ctz}`;
  };

  const handleCopyLink = async () => {
    try {
      const url = (typeof window !== 'undefined' ? window.location.origin : '') + clientsFocusUrl(booking.id);
      await navigator.clipboard.writeText(url);
      toast.success('Ссылка на запись скопирована');
    } catch (_) {
      toast('Не удалось скопировать ссылку');
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Отменить (удалить) эту запись?')) return;
    try {
      await api.delete(`/bookings/${booking.id}`);
      toast.success('Запись отменена');
      onUpdated && onUpdated();
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.msg || 'Не удалось отменить запись');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-2xl w-full max-w-xl shadow-xl">
        <h4 className="text-lg font-semibold mb-4">Детали записи</h4>
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium">Клиент:</span> {booking.clientName}
            {booking.telegramHandle && (
              <a
                href={clientsFocusUrl(booking.id)}
                onClick={(e) => { e.preventDefault(); window.open(clientsFocusUrl(booking.id), '_blank', 'noopener,noreferrer'); }}
                className="ml-2 text-brand-accent hover:underline"
              >
                @{booking.telegramHandle}
              </a>
            )}
          </div>
          <div><span className="font-medium">Телефон:</span> {booking.clientPhone || '—'}</div>
          <div>
            <span className="font-medium">Время:</span>
            <div className="mt-1">
              <TimeRangeDisplay
                startTime={booking.start}
                endTime={booking.end}
                practitionerTimezone={practitionerTimezone}
                isAdmin={true}
              />
            </div>
          </div>
          {booking.preferredContact && (
            <div>
              <span className="font-medium">Канал:</span>{' '}
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700">
                {booking.preferredContact}
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
          <button
            onClick={() => {
              if (booking.telegramHandle) {
                const handle = booking.telegramHandle.replace(/^@/, '');
                try { window.open(`https://t.me/${handle}`, '_blank', 'noopener,noreferrer'); } catch (_) {}
              } else {
                toast('Нет username в Telegram');
              }
            }}
            className="px-3 py-2 rounded-lg border text-sm bg-white hover:bg-gray-50"
          >Переписка в Telegram</button>
          <button
            onClick={() => onReschedule && onReschedule(booking)}
            className="px-3 py-2 rounded-lg border text-sm bg-white hover:bg-gray-50"
          >Перенести</button>
          <button
            onClick={handleCancel}
            className="px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-red-600 text-sm hover:bg-red-100"
          >Отменить</button>
          <button
            onClick={handleCopyLink}
            className="px-3 py-2 rounded-lg border text-sm bg-white hover:bg-gray-50"
          >Скопировать ссылку</button>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border bg-white hover:bg-gray-50">Закрыть</button>
        </div>
      </div>
    </div>
  );
};

const AddBookingModal = ({ slot, onClose, onCreated, practitionerTimezone }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [telegram, setTelegram] = useState('');
  const [comment, setComment] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const normalizedPhone = normalizePhoneForSubmit(phone || '');
      await api.post('/bookings', {
        name,
        phone: normalizedPhone,
        telegram,
        comment,
        preferredContact: 'phone',
        slotId: slot.id,
      });
      onCreated();
      onClose();
    } catch (err) {
      console.error('Failed to create booking', err);
      const msg = err?.response?.data?.msg || err?.response?.data?.message || 'Ошибка при создании записи';
      toast.error(msg);
    }
  };

  if (!slot) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded-lg w-80 shadow-lg flex flex-col gap-3"
      >
        <h4 className="text-lg font-semibold mb-1">Записать клиента</h4>
        <div className="text-sm mb-2">
          <div>Дата: {format(new Date(slot.slotTime), 'dd.MM.yyyy')}</div>
          <TimeRangeDisplay 
            startTime={slot.slotTime}
            endTime={slot.endTime}
            practitionerTimezone={practitionerTimezone}
            isAdmin={true}
          />
        </div>
        <input
          type="text"
          required
          placeholder="Имя"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
        />
        <Cleave
          options={{
            phone: true,
            phoneRegionCode: 'RU',
          }}
          value={phone}
          onChange={(e) => {
            let v = e.target.value || '';
            if (v === '7' || v === '8' || v === '9') {
              v = '+7 ' + (v === '9' ? '9' : '');
            }
            setPhone(v);
          }}
          className="border rounded px-2 py-1 text-sm"
          placeholder="+7 977 288-14-99"
          required
        />
        <input
          type="text"
          placeholder="Telegram"
          value={telegram}
          onChange={(e) => setTelegram(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
        />
        <textarea
          placeholder="Комментарий (необязательно)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows="3"
          className="border rounded px-2 py-1 text-sm"
        />
        <div className="flex justify-end gap-2 mt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded text-sm bg-gray-100 hover:bg-gray-200"
          >
            Отмена
          </button>
          <button
            type="submit"
            className="px-3 py-1 rounded text-sm bg-brand-accent text-white"
          >
            Записать
          </button>
        </div>
      </form>
    </div>
  );
};

// Modal for creating a new slot
const CreateSlotModal = ({ defaultDate, onClose, onCreated, existingBookings = [], practitionerTimezone = 'Europe/Moscow' }) => {
  const [dateStr, setDateStr] = useState(format(defaultDate || new Date(), 'yyyy-MM-dd'));
  const [timeStart, setTimeStart] = useState('10:00');
  const [timeEnd, setTimeEnd] = useState('11:00');
  const [loading, setLoading] = useState(false);
  const [scheduleSettings, setScheduleSettings] = useState(null);
  const [breakWarning, setBreakWarning] = useState('');
  const [autoEndEnabled, setAutoEndEnabled] = useState(true);

  // Load schedule settings and suggest smart times
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data } = await api.get('/admin/schedule-settings');
        setScheduleSettings(data);
        
        // Suggest next available time based on existing bookings
        const dayBookings = existingBookings.filter(b => 
          format(new Date(b.start), 'yyyy-MM-dd') === dateStr
        ).sort((a, b) => new Date(a.start) - new Date(b.start));
        
        if (dayBookings.length > 0 && data) {
          const lastBooking = dayBookings[dayBookings.length - 1];
          const lastEnd = new Date(lastBooking.end);
          const breakMinutes = data.breakBetweenSessions || 15;
          const sessionMinutes = data.sessionDuration || 60;
          
          // Suggest start time after last booking + break
          const suggestedStart = new Date(lastEnd.getTime() + breakMinutes * 60000);
          const suggestedEnd = new Date(suggestedStart.getTime() + sessionMinutes * 60000);
          
          setTimeStart(format(suggestedStart, 'HH:mm'));
          setTimeEnd(format(suggestedEnd, 'HH:mm'));
        } else if (data?.workingHours?.start) {
          // Use working hours start as default
          const sessionMinutes = data.sessionDuration || 60;
          const startTime = parse(data.workingHours.start, 'HH:mm', new Date());
          const endTime = addMinutes(startTime, sessionMinutes);
          
          setTimeStart(data.workingHours.start);
          setTimeEnd(format(endTime, 'HH:mm'));
        }
      } catch (e) {
        console.warn('Could not load schedule settings:', e);
      }
    };
    
    if (dateStr) loadSettings();
  }, [dateStr, existingBookings]);
  
  // Auto-calculate end time when start time changes, while auto mode is enabled
  useEffect(() => {
    try {
      if (!autoEndEnabled) return;
      if (!timeStart) return;
      const minutes = (scheduleSettings && scheduleSettings.sessionDuration) ? Number(scheduleSettings.sessionDuration) : 60;
      const start = parse(timeStart, 'HH:mm', new Date());
      const end = addMinutes(start, isFinite(minutes) && minutes > 0 ? minutes : 60);
      setTimeEnd(format(end, 'HH:mm'));
    } catch (_) { /* ignore */ }
  }, [timeStart, scheduleSettings, autoEndEnabled]);

  // Check for break time conflicts
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
    
    // Check if slot overlaps with lunch break
    if ((slotStart >= breakStart && slotStart < breakEnd) || 
        (slotEnd > breakStart && slotEnd <= breakEnd) ||
        (slotStart < breakStart && slotEnd > breakEnd)) {
      setBreakWarning(`⚠️ Этот слот пересекается с обеденным перерывом (${lunchStart}-${lunchEnd}). Точно желаете создать?`);
    } else {
      setBreakWarning('');
    }
  }, [timeStart, timeEnd, scheduleSettings]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (breakWarning && !window.confirm(breakWarning)) {
      return;
    }
    
    setLoading(true);
    try {
      // Send components as expected by backend API: startTime, endTime, date, timezone
      await api.post('/slots/create', {
        startTime: timeStart,
        endTime: timeEnd,
        date: dateStr,
        timezone: practitionerTimezone,
      });
      onCreated();
      onClose();
    } catch (err) {
      console.error('Failed to create slot', err);
      const msg = err?.response?.data?.msg || err?.response?.data?.message || 'Ошибка при создании слота';
      toast.error(msg);
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
            <input type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} className="border rounded px-2 py-1 text-sm w-full" required />
          </div>
          <div className="col-span-1">
            <label className="text-xs text-gray-500">Начало</label>
            <input
              type="time"
              value={timeStart}
              onChange={(e) => {
                setTimeStart(e.target.value);
                // Keep auto mode on start change; user disabling happens on end change
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
              onChange={(e) => {
                setAutoEndEnabled(false); // user manually edits end time -> disable auto mode
                setTimeEnd(e.target.value);
              }}
              className="border rounded px-2 py-1 text-sm w-full"
              required
            />
          </div>
        </div>
        {breakWarning && (
          <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
            {breakWarning}
          </div>
        )}
        <div className="flex justify-end gap-2 mt-2">
          <button type="button" onClick={onClose} className="px-3 py-1 rounded text-sm bg-gray-100 hover:bg-gray-200">Отмена</button>
          <button type="submit" disabled={loading} className="px-3 py-1 rounded text-sm bg-brand-accent text-white">{loading ? 'Создание...' : 'Создать'}</button>
        </div>
      </form>
    </div>
  );
};

// Modal for manual booking by date/time without predefined slot
const ManualBookingModal = ({ defaultDate, onClose, onCreated, practitionerTimezone = 'Europe/Moscow' }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [telegram, setTelegram] = useState('');
  const [comment, setComment] = useState('');
  const [dateStr, setDateStr] = useState(format(defaultDate || new Date(), 'yyyy-MM-dd'));
  const [timeStart, setTimeStart] = useState('10:00');
  const [timeEnd, setTimeEnd] = useState('11:00');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSug, setShowSug] = useState(false);
  const sugRef = useRef(null);
  const [scheduleSettings, setScheduleSettings] = useState(null);
  const [autoEndEnabled, setAutoEndEnabled] = useState(true);

  useEffect(() => {
    const handler = (e) => {
      if (sugRef.current && !sugRef.current.contains(e.target)) setShowSug(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Load schedule settings to know sessionDuration
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/admin/schedule-settings');
        setScheduleSettings(data);
      } catch (_) { /* ignore */ }
    })();
  }, []);

  // Auto-calc end when start changes (until user edits end manually)
  useEffect(() => {
    try {
      if (!autoEndEnabled) return;
      if (!timeStart) return;
      const minutes = (scheduleSettings && scheduleSettings.sessionDuration) ? Number(scheduleSettings.sessionDuration) : 60;
      const start = parse(timeStart, 'HH:mm', new Date());
      const end = addMinutes(start, isFinite(minutes) && minutes > 0 ? minutes : 60);
      setTimeEnd(format(end, 'HH:mm'));
    } catch (_) { /* ignore */ }
  }, [timeStart, scheduleSettings, autoEndEnabled]);

  useEffect(() => {
    if (!name || name.trim().length < 2) { setSuggestions([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await api.get('/bookings/clients', { params: { q: name.trim() } });
        setSuggestions(res.data || []);
        setShowSug(true);
      } catch (e) {
        // ignore
      }
    }, 300);
    return () => clearTimeout(t);
  }, [name]);

  const applySuggestion = (s) => {
    setName(s.name || '');
    setPhone(s.phone || '');
    setTelegram(s.telegram || '');
    setShowSug(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const normalizedPhone = normalizePhoneForSubmit(phone || '');
      const tz = practitionerTimezone;
      const slotTime = fromZonedTime(`${dateStr}T${timeStart}:00`, tz);
      const endTime = fromZonedTime(`${dateStr}T${timeEnd}:00`, tz);
      await api.post('/bookings', {
        name,
        phone: normalizedPhone,
        telegram,
        comment,
        preferredContact: 'phone',
        slotTime: slotTime.toISOString(),
        endTime: endTime.toISOString(),
      });
      onCreated();
      onClose();
    } catch (err) {
      console.error('Failed to create manual booking', err);
      const msg = err?.response?.data?.msg || err?.response?.data?.message || 'Ошибка при создании записи';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg w-96 shadow-lg flex flex-col gap-3">
        <h4 className="text-lg font-semibold mb-1">Назначить сессию</h4>
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-1">
            <label className="text-xs text-gray-500">Дата</label>
            <input type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} className="border rounded px-2 py-1 text-sm w-full" required />
          </div>
          <div className="col-span-1">
            <label className="text-xs text-gray-500">Начало</label>
            <input
              type="time"
              value={timeStart}
              onChange={(e) => {
                setTimeStart(e.target.value);
                // keep auto mode; user disables via end time edit
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
              onChange={(e) => {
                setAutoEndEnabled(false);
                setTimeEnd(e.target.value);
              }}
              className="border rounded px-2 py-1 text-sm w-full"
              required
            />
          </div>
        </div>
        <div className="relative" ref={sugRef}>
          <label className="text-xs text-gray-500">Имя</label>
          <input
            type="text"
            required
            placeholder="Имя"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={() => suggestions.length && setShowSug(true)}
            className="border rounded px-2 py-1 text-sm w-full"
          />
          {showSug && suggestions.length > 0 && (
            <ul className="absolute z-10 mt-1 bg-white border rounded w-full max-h-40 overflow-auto text-sm shadow">
              {suggestions.map((s, idx) => (
                <li key={idx} className="px-2 py-1 hover:bg-gray-100 cursor-pointer" onClick={() => applySuggestion(s)}>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-gray-500">{s.phone || '—'} {s.telegram ? `• @${s.telegram}` : ''}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <label className="text-xs text-gray-500">Телефон</label>
        <Cleave
          options={{ phone: true, phoneRegionCode: 'RU' }}
          value={phone}
          onChange={(e) => {
            let v = e.target.value || '';
            if (v === '7' || v === '8' || v === '9') {
              v = '+7 ' + (v === '9' ? '9' : '');
            }
            setPhone(v);
          }}
          className="border rounded px-2 py-1 text-sm"
          placeholder="+7 977 288-14-99"
          required
        />
        <label className="text-xs text-gray-500">Telegram</label>
        <input type="text" placeholder="Telegram" value={telegram} onChange={(e) => setTelegram(e.target.value)} className="border rounded px-2 py-1 text-sm" />
        <label className="text-xs text-gray-500">Комментарий</label>
        <textarea placeholder="Комментарий (необязательно)" value={comment} onChange={(e) => setComment(e.target.value)} rows="3" className="border rounded px-2 py-1 text-sm" />
        <div className="flex justify-end gap-2 mt-2">
          <button type="button" onClick={onClose} className="px-3 py-1 rounded text-sm bg-gray-100 hover:bg-gray-200">Отмена</button>
          <button type="submit" disabled={loading} className="px-3 py-1 rounded text-sm bg-brand-accent text-white">{loading ? 'Сохранение...' : 'Создать'}</button>
        </div>
      </form>
    </div>
  );
};

const CalendarTab = ({ practitionerTimezone = 'Europe/Moscow' }) => {
  const [events, setEvents] = useState([]);
  const [slots, setSlots] = useState([]);

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('month'); // 'month' | 'week' | 'day'
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [slotModal, setSlotModal] = useState(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [createSlotOpen, setCreateSlotOpen] = useState(false);
  const [monthOpen, setMonthOpen] = useState(false);
  const [hoveredDate, setHoveredDate] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(null);
  const [nowStr, setNowStr] = useState('');
  const [zoneLabel, setZoneLabel] = useState(practitionerTimezone);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [gridLoading, setGridLoading] = useState(false);
  const monthRef = useRef(null);

  const fetchBookings = async () => {
    try {
      setLoadingBookings(true);
      const response = await api.get('/bookings');
      const bookings = response.data;
      const mapped = bookings.map((b) => ({
        id: b.id,
        title: b.clientName,
        start: new Date(b.slotTime),
        end: new Date(b.endTime),
        clientName: b.clientName,
        clientPhone: b.clientPhone,
        telegramHandle: ((b.telegramUsername || b.clientTelegram || '') + '').replace(/^@/, ''),
        status: b.status,
        clientConfirmation: b.clientConfirmation,
        preferredContact: b.preferredContact,
      }));
      setEvents(mapped);
    } catch (err) {
      console.error('Failed to fetch bookings', err);
      const msg = err?.response?.data?.msg || err?.response?.data?.message || 'Ошибка загрузки записей';
      toast.error(msg);
    } finally {
      setLoadingBookings(false);
    }
  };

  const fetchSlots = async () => {
    try {
      setLoadingSlots(true);
      const res = await api.get(`/slots?ts=${Date.now()}`);
      const slotGroups = res.data || {};
      const parsed = [];
      Object.keys(slotGroups).forEach((k) => {
        (slotGroups[k] || []).forEach((s) => parsed.push(s));
      });
      setSlots(parsed);
    } catch (err) {
      console.error('Failed to fetch slots', err);
      const msg = err?.response?.data?.msg || err?.response?.data?.message || 'Ошибка загрузки слотов';
      toast.error(msg);
    } finally {
      setLoadingSlots(false);
    }
  };

  const refreshData = () => {
    fetchBookings();
    fetchSlots();
  };

  useEffect(() => {
    fetchBookings();
    fetchSlots();

  }, []);

  // Brief skeleton animation when month/week/day changes
  useEffect(() => {
    setGridLoading(true);
    const t = setTimeout(() => setGridLoading(false), 250);
    return () => clearTimeout(t);
  }, [currentMonth, viewMode]);

  // Top header clock (update every minute, HH:mm, user's/practitioner's zone)
  useEffect(() => {
    const update = () => {
      try {
        const s = new Intl.DateTimeFormat('ru-RU', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: practitionerTimezone,
        }).format(new Date());
        setNowStr(s);
      } catch (_) {
        setNowStr(new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()));
      }
      try {
        const parts = new Intl.DateTimeFormat('ru-RU', { timeZone: practitionerTimezone, timeZoneName: 'short' }).formatToParts(new Date());
        const tzName = parts.find(p => p.type === 'timeZoneName')?.value || practitionerTimezone;
        setZoneLabel(tzName);
      } catch (_) {
        setZoneLabel(practitionerTimezone);
      }
    };
    update();
    const t = setInterval(update, 60000);
    return () => clearInterval(t);
  }, [practitionerTimezone]);

  useEffect(() => {
    const handleClick = (e) => {
      if (monthRef.current && !monthRef.current.contains(e.target)) {
        setMonthOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const dateFormat = 'd';
  const weeks = [];
  let day = startDate;
  let formattedDate = '';
  const todayStart = startOfDay(new Date());

  while (day <= endDate) {
    const days = [];
    for (let i = 0; i < 7; i++) {
      formattedDate = format(day, dateFormat, { locale: ru });
      const cloneDay = day;
      const dayEvents = events.filter((e) => isSameDay(e.start, cloneDay));
      const daySlots = slots.filter((s) => isSameDay(new Date(s.slotTime), cloneDay));
      const inMonth = isSameMonth(day, monthStart);
      const isSelected = isSameDay(day, selectedDate);
      const isToday = isSameDay(day, new Date());
      const eventsCount = dayEvents.length;
      const slotsCount = daySlots.length;
      days.push(
        <div
          key={day}
          onClick={() => setSelectedDate(cloneDay)}
          onMouseEnter={() => setHoveredDate(cloneDay)}
          onMouseLeave={() => setHoveredDate(null)}
          className={`relative group rounded-xl border bg-white shadow-sm hover:shadow-md transition p-2 h-28 ${inMonth ? '' : 'opacity-50'} ${isSelected ? 'ring-2 ring-gray-900' : (isToday ? 'ring-2 ring-red-500/60' : '')} ${gridLoading ? 'animate-pulse' : ''}`}
        >
          {/* date badge */}
          <span className="absolute top-2 right-2 text-base text-gray-700">{formattedDate}</span>
          {/* counters at bottom */}
          {(eventsCount > 0 || slotsCount > 0) && (
            <div className="absolute bottom-2 left-2 text-xs text-gray-600 font-mono">
              {eventsCount}/{slotsCount}
            </div>
          )}
          {/* hover +slot button */}
          {hoveredDate && isSameDay(hoveredDate, cloneDay) && inMonth && (
            <button
              onClick={(e) => { e.stopPropagation(); setCreateSlotOpen(cloneDay); }}
              className="absolute bottom-2 right-2 w-7 h-7 bg-gray-900 hover:bg-black text-white rounded-full flex items-center justify-center text-xs"
              title="Создать слот"
            >
              <FiPlus />
            </button>
          )}
        </div>
      );
      day = addDays(day, 1);
    }
    weeks.push(
      <section className="grid grid-cols-7 gap-2" key={day}>
        {days}
      </section>
    );
  }

  const nextMonth = () => {
    // Move forward according to view mode
    if (viewMode === 'month') {
      setCurrentMonth(addMonths(currentMonth, 1));
    } else if (viewMode === 'week') {
      setCurrentMonth(addDays(currentMonth, 7));
    } else {
      setCurrentMonth(addDays(currentMonth, 1));
    }
  };

  const prevMonth = () => {
    // Move backward according to view mode
    if (viewMode === 'month') {
      setCurrentMonth(subMonths(currentMonth, 1));
    } else if (viewMode === 'week') {
      setCurrentMonth(addDays(currentMonth, -7));
    } else {
      setCurrentMonth(addDays(currentMonth, -1));
    }
  };

  const handleMonthSelect = (idx) => {
    setCurrentMonth(setMonth(currentMonth, idx));
    setMonthOpen(false);
  };

  const goToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    setSelectedDate(today);
  };

  const changeView = (mode) => {
    setViewMode(mode);
    // Anchor to selected date for better UX when switching modes
    setCurrentMonth(selectedDate);
  };

  const openSettings = () => {
    setMenuOpen(false);
    setSettingsOpen(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    window.location.href = '/psychologist/login';
  };

  const eventsForSelectedDate = events
    .filter((e) => isSameDay(e.start, selectedDate))
    .sort((a, b) => a.start - b.start);


  const slotsForSelectedDate = slots
    .filter((s) => isSameDay(new Date(s.slotTime), selectedDate))
    .sort((a, b) => new Date(a.slotTime) - new Date(b.slotTime));

  // Week view data
  const weekStart = startOfWeek(currentMonth, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekRow = (
    <section className="calendar__week" key="week">
      {weekDays.map((d) => {
        const dayEvents = events
          .filter((e) => isSameDay(e.start, d))
          .sort((a, b) => a.start - b.start);
        const daySlots = slots
          .filter((s) => isSameDay(new Date(s.slotTime), d))
          .sort((a, b) => new Date(a.slotTime) - new Date(b.slotTime));
        return (
          <div
            className={`calendar__day ${isSameDay(d, selectedDate) ? 'today' : ''}`}
            key={d.toISOString()}
            onClick={() => setSelectedDate(d)}
          >
            <span className="calendar__date">{format(d, 'd', { locale: ru })}</span>
            <span
              aria-hidden="true"
              className={`calendar__task${isSameDay(d, selectedDate) ? ' calendar__task--today' : ''}${(dayEvents.length || daySlots.length) ? '' : ' calendar__task--empty'}`}
            >
              {dayEvents.length}/{daySlots.length}
            </span>
            <ul className="sidebar__list">
              {dayEvents.map((evt) => (
                <li
                  key={evt.id}
                  className={`sidebar__list-item cursor-pointer ${statusClass(evt.status, evt.clientConfirmation)} contact-${evt.preferredContact || 'phone'}`}
                  onClick={(e) => { e.stopPropagation(); setSelectedEvent(evt); }}
                >
                  <SimpleTimeDisplay 
                    utcTime={evt.start}
                    isAdmin={true}
                    className="list-item__time inline"
                  />
                  <ContactIcon method={evt.preferredContact} />
                  <span className="list-item__title">{evt.title}</span>
                </li>
              ))}
              {dayEvents.length === 0 && (
                <li className="sidebar__list-item text-gray-500">Нет записей</li>
              )}
            </ul>
          </div>
        );
      })}
    </section>
  );

  // Day view content
  const dayView = (
    <section className="calendar__week" key="day">
      <div className="calendar__day today">
        <span className="calendar__date">{format(selectedDate, 'd', { locale: ru })}</span>
        <span
          aria-hidden="true"
          className={`calendar__task calendar__task--today${(eventsForSelectedDate.length || slotsForSelectedDate.length) ? '' : ' calendar__task--empty'}`}
        >
          {eventsForSelectedDate.length}/{slotsForSelectedDate.length}
        </span>
        <ul className="sidebar__list">
          {eventsForSelectedDate.map((evt) => (
            <li
              key={evt.id}
              className={`sidebar__list-item cursor-pointer ${statusClass(evt.status, evt.clientConfirmation)} contact-${evt.preferredContact || 'phone'}`}
              onClick={() => setSelectedEvent(evt)}
            >
              <SimpleTimeDisplay 
                utcTime={evt.start}
                isAdmin={true}
                className="list-item__time inline"
              />
              <ContactIcon method={evt.preferredContact} />
              <span className="list-item__title">{evt.title}</span>
            </li>
          ))}
          {eventsForSelectedDate.length === 0 && (
            <li className="sidebar__list-item text-gray-500">На этот день записей нет</li>
          )}
        </ul>
      </div>
    </section>
  );

  return (
    <div className={`w-full ${menuOpen ? 'menu-open' : ''}`}>
      {/* Top header */}
      <div className="w-full bg-transparent">
        <div className="max-w-[1200px] mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-brand-text">Панель психолога</h1>
          <button
            type="button"
            onClick={() => toast('Выбор часового пояса появится скоро')}
            className="inline-flex items-center gap-2 rounded-full bg-gray-900 text-white px-3 py-1 text-sm hover:bg-black"
            title="Сменить часовой пояс"
          >
            <span>Сейчас: {nowStr}</span>
            <span className="opacity-60">·</span>
            <span>Моя зона: {zoneLabel}</span>
          </button>
        </div>
      </div>

      {/* Main container with background card */}
      <div className="max-w-[1200px] mx-auto px-4">
        <div className="rounded-2xl bg-white shadow-sm border p-6">
          {/* Content grid */}
          <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
          {/* Sidebar */}
          <aside className="rounded-lg bg-gray-50 border p-4">
            <div>
              <div className="text-sm text-gray-500 capitalize">{format(selectedDate, 'eeee', { locale: ru })}</div>
              <div className="text-2xl font-bold leading-tight">{format(selectedDate, 'd MMMM', { locale: ru })}</div>
            </div>
            <div className="mt-4 flex gap-2">
              <button className="px-3 py-2 rounded-lg text-sm bg-gray-900 text-white hover:bg-black" onClick={() => setCreateSlotOpen(selectedDate)}>
                Создать слот
              </button>
              <button className="px-3 py-2 rounded-lg text-sm bg-gray-100 hover:bg-gray-200" onClick={() => setManualOpen(selectedDate)}>
                Назначить сессию
              </button>
            </div>

            <div className="mt-6">
              {loadingBookings ? (
                <div className="space-y-3">
                  {Array.from({length:4}).map((_,i)=> (
                    <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : (
                <ul className="space-y-2">
                  {eventsForSelectedDate.length === 0 && (
                    <li className="text-sm text-gray-500 flex items-center justify-between">
                      <span>Нет записей на этот день</span>
                      <button className="px-3 py-1 rounded-lg text-xs bg-gray-900 text-white hover:bg-black" onClick={() => setCreateSlotOpen(selectedDate)}>Создать слот</button>
                    </li>
                  )}
                  {eventsForSelectedDate.map((evt) => (
                    <li key={evt.id} className={`rounded-xl border shadow-sm p-3 cursor-pointer hover:shadow-md transition ${statusClass(evt.status, evt.clientConfirmation)}`}
                        onClick={() => setSelectedEvent(evt)}>
                      <div className="text-sm font-medium">
                        <span className="font-mono">{format(evt.start, 'HH:mm')}–{format(evt.end, 'HH:mm')}</span> · {evt.title}
                      </div>
                      {evt.telegramHandle && (
                        <div className="text-xs mt-1">
                          <a
                            href={clientsFocusUrl(evt.id)}
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              window.location.href = clientsFocusUrl(evt.id);
                            }}
                            className="text-brand-accent hover:underline"
                          >
                            @{evt.telegramHandle}
                          </a>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {slotsForSelectedDate.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold">Свободные слоты</h3>
                {loadingSlots ? (
                  <div className="space-y-3 mt-3">
                    {Array.from({length:3}).map((_,i)=> (
                      <div key={i} className="h-8 bg-gray-100 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <ul className="space-y-2 mt-2">
                    {slotsForSelectedDate.map((slot) => (
                      <li key={slot.id} className="rounded-xl border p-3 shadow-sm text-brand-text flex items-center justify-between hover:shadow-md transition cursor-pointer" onClick={() => setSlotModal(slot)}>
                        <span className="text-sm">{format(new Date(slot.slotTime), 'HH:mm')}–{format(new Date(slot.endTime), 'HH:mm')}</span>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (window.confirm('Удалить этот слот?')) {
                              try {
                                await api.delete(`/slots/${slot.id}`);
                                refreshData();
                                toast.success('Слот удален');
                              } catch (err) {
                                const msg = err?.response?.data?.msg || 'Ошибка удаления слота';
                                toast.error(msg);
                              }
                            }
                          }}
                          className="px-2 py-1 text-xs rounded bg-red-50 text-red-600 hover:bg-red-100"
                        >Удалить</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

          </aside>

          {/* Calendar area (card) */}
          <section className="rounded-lg bg-gray-50 border p-4 min-h-[540px]">
            {/* Calendar navbar inside the card */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={prevMonth} aria-label="Предыдущий период" className="w-8 h-8 flex items-center justify-center rounded-full border hover:bg-gray-50">
                  <FiChevronLeft />
                </button>
                <div className="text-lg font-medium">
                  {format(currentMonth, 'LLLL yyyy', { locale: ru })}
                </div>
                <button onClick={nextMonth} aria-label="Следующий период" className="w-8 h-8 flex items-center justify-center rounded-full border hover:bg-gray-50">
                  <FiChevronRight />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={goToday} type="button" className="px-3 py-1 rounded-full text-sm border bg-white hover:bg-gray-50">Сегодня</button>
                <div className="inline-flex bg-gray-100 rounded-full p-1">
                  <button type="button" onClick={() => changeView('month')} className={`px-3 py-1 rounded-full text-sm ${viewMode==='month' ? 'bg-gray-900 text-white' : 'text-gray-700'}`}>Месяц</button>
                  <button type="button" onClick={() => changeView('week')} className={`px-3 py-1 rounded-full text-sm ${viewMode==='week' ? 'bg-gray-900 text-white' : 'text-gray-700'}`}>Неделя</button>
                  <button type="button" onClick={() => changeView('day')} className={`px-3 py-1 rounded-full text-sm ${viewMode==='day' ? 'bg-gray-900 text-white' : 'text-gray-700'}`}>День</button>
                </div>
              </div>
            </div>
            {viewMode !== 'day' && (
              <div className="grid grid-cols-7 text-xs text-gray-500 mb-2">
                {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map((d)=>(
                  <div key={d} className="text-center">{d}</div>
                ))}
              </div>
            )}

            {viewMode === 'month' ? (
              <div className="space-y-1.5">
                {weeks.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-7 gap-1.5">
                    {/* Each row contains 7 day cells already */}
                    {row.props.children}
                  </div>
                ))}
              </div>
            ) : viewMode === 'week' ? weekRow : dayView}
          </section>
          </div>
        </div>
      </div>
      
      <BookingDetailsModal booking={selectedEvent} onClose={() => setSelectedEvent(null)} practitionerTimezone={practitionerTimezone} onUpdated={refreshData} onReschedule={(b) => setRescheduleOpen(b)} />

      <AddBookingModal
        slot={slotModal}
        onClose={() => setSlotModal(null)}
        onCreated={refreshData}
        practitionerTimezone={practitionerTimezone}
      />
      {manualOpen && (
        <ManualBookingModal
          defaultDate={typeof manualOpen === 'object' ? manualOpen : selectedDate}
          onClose={() => setManualOpen(false)}
          onCreated={refreshData}
          practitionerTimezone={practitionerTimezone}
        />
      )}
      {createSlotOpen && (
        <CreateSlotModal
          defaultDate={typeof createSlotOpen === 'object' ? createSlotOpen : selectedDate}
          onClose={() => setCreateSlotOpen(false)}
          onCreated={refreshData}
          existingBookings={events}
          practitionerTimezone={practitionerTimezone}
        />
      )}

      {settingsOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center" style={{ zIndex: 70 }}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] overflow-auto relative">
            <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b bg-white">
              <h3 className="text-lg font-semibold">Настройки расписания</h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="px-3 py-1 text-sm border rounded"
                  onClick={goToday}
                >
                  Сегодня
                </button>
                <button
                  type="button"
                  className="px-3 py-1 text-sm rounded bg-gray-100 hover:bg-gray-200"
                  onClick={() => setSettingsOpen(false)}
                >
                  Закрыть
                </button>
              </div>
            </div>
            <div className="p-4">
              <ScheduleSettingsTab />
            </div>
          </div>
        </div>
      )}

      <RescheduleModal
        isOpen={!!rescheduleOpen}
        booking={rescheduleOpen}
        onClose={() => setRescheduleOpen(null)}
        onRescheduled={refreshData}
      />

      <div
        className="menu-backdrop"
        onClick={() => setMenuOpen(false)}
      ></div>
      <div className="calendar-menu">
        <button
          className="menu-close"
          onClick={() => setMenuOpen(false)}
          aria-label="Close menu"
        >
          <FiX />
        </button>
        <div className="h-full flex flex-col justify-between">
          <div className="p-4">
            {/* You can put profile info or avatar here later */}
          </div>
          <div className="p-4">
            <button
              className="w-full flex items-center gap-2 px-3 py-2 rounded border bg-white hover:bg-gray-100"
              onClick={openSettings}
              type="button"
            >
              <FiSettings />
              <span>Настройки</span>
            </button>
            <button
              className="mt-2 w-full flex items-center gap-2 px-3 py-2 rounded border border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
              onClick={handleLogout}
              type="button"
            >
              <FiLogOut />
              <span>Выйти из профиля</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarTab;

