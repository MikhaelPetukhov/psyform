import React, { useEffect, useRef, useState } from 'react';
import { addMinutes, format, parse } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import toast from 'react-hot-toast';

import Cleave from 'cleave.js/react';
import 'cleave.js/dist/addons/cleave-phone.i18n';

import { normalizePhoneForSubmit } from '../../utils/phoneFormat';
import { createBooking, getScheduleSettings, searchClients } from '../../api/calendar';

const ManualBookingModal = ({
  defaultDate,
  onClose,
  onCreated,
  practitionerTimezone = 'Europe/Moscow',
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [telegram, setTelegram] = useState('');
  const [comment, setComment] = useState('');
  const [dateStr, setDateStr] = useState(format(defaultDate || new Date(), 'yyyy-MM-dd'));
  const [timeStart, setTimeStart] = useState('10:00');
  const [timeEnd, setTimeEnd] = useState('11:00');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef(null);
  const [scheduleSettings, setScheduleSettings] = useState(null);
  const [autoEndEnabled, setAutoEndEnabled] = useState(true);

  useEffect(() => {
    const handler = (event) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await getScheduleSettings();
        setScheduleSettings(data);
      } catch (error) {
        // ignore schedule settings load failure
      }
    })();
  }, []);

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
    if (!name || name.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        const response = await searchClients(name.trim());
        setSuggestions(response.data || []);
        setShowSuggestions(true);
      } catch (error) {
        // ignore search errors
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [name]);

  const applySuggestion = (suggestion) => {
    setName(suggestion.name || '');
    setPhone(suggestion.phone || '');
    setTelegram(suggestion.telegram || '');
    setShowSuggestions(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);

    try {
      const normalizedPhone = normalizePhoneForSubmit(phone || '');
      const slotTime = fromZonedTime(`${dateStr}T${timeStart}:00`, practitionerTimezone);
      const endTime = fromZonedTime(`${dateStr}T${timeEnd}:00`, practitionerTimezone);

      await createBooking({
        name,
        phone: normalizedPhone,
        telegram,
        comment,
        preferredContact: 'phone',
        slotTime: slotTime.toISOString(),
        endTime: endTime.toISOString(),
      });
      if (onCreated) onCreated();
      onClose();
    } catch (error) {
      console.error('Failed to create manual booking', error);
      const message = error?.response?.data?.msg || error?.response?.data?.message || 'Ошибка при создании записи';
      toast.error(message);
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
        <div className="relative" ref={suggestionsRef}>
          <label className="text-xs text-gray-500">Имя</label>
          <input
            type="text"
            required
            placeholder="Имя"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onFocus={() => suggestions.length && setShowSuggestions(true)}
            className="border rounded px-2 py-1 text-sm w-full"
          />
          {showSuggestions && suggestions.length > 0 && (
            <ul className="absolute z-10 mt-1 bg-white border rounded w-full max-h-40 overflow-auto text-sm shadow">
              {suggestions.map((suggestion, index) => (
                <li
                  key={index}
                  className="px-2 py-1 hover:bg-gray-100 cursor-pointer"
                  onClick={() => applySuggestion(suggestion)}
                >
                  <div className="font-medium">{suggestion.name}</div>
                  <div className="text-xs text-gray-500">
                    {suggestion.phone || '—'} {suggestion.telegram ? `• @${suggestion.telegram}` : ''}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <label className="text-xs text-gray-500">Телефон</label>
        <Cleave
          options={{ phone: true, phoneRegionCode: 'RU' }}
          value={phone}
          onChange={(event) => {
            let value = event.target.value || '';
            if (value === '7' || value === '8' || value === '9') {
              value = '+7 ' + (value === '9' ? '9' : '');
            }
            setPhone(value);
          }}
          className="border rounded px-2 py-1 text-sm"
          placeholder="+7 977 288-14-99"
          required
        />
        <label className="text-xs text-gray-500">Telegram</label>
        <input
          type="text"
          placeholder="Telegram"
          value={telegram}
          onChange={(event) => setTelegram(event.target.value)}
          className="border rounded px-2 py-1 text-sm"
        />
        <label className="text-xs text-gray-500">Комментарий</label>
        <textarea
          placeholder="Комментарий (необязательно)"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          rows="3"
          className="border rounded px-2 py-1 text-sm"
        />
        <div className="flex justify-end gap-2 mt-2">
          <button type="button" onClick={onClose} className="px-3 py-1 rounded text-sm bg-gray-100 hover:bg-gray-200">
            Отмена
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-3 py-1 rounded text-sm bg-brand-accent text-white"
          >
            {loading ? 'Сохранение...' : 'Создать'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ManualBookingModal;
