import React, { useState } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

import Cleave from 'cleave.js/react';
import 'cleave.js/dist/addons/cleave-phone.i18n';

import { TimeRangeDisplay } from '../TimezoneDisplay';
import { normalizePhoneForSubmit } from '../../utils/phoneFormat';
import { createBooking } from '../../api/calendar';

const AddBookingModal = ({ slot, onClose, onCreated, practitionerTimezone }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [telegram, setTelegram] = useState('');
  const [comment, setComment] = useState('');

  if (!slot) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      const normalizedPhone = normalizePhoneForSubmit(phone || '');
      await createBooking({
        name,
        phone: normalizedPhone,
        telegram,
        comment,
        preferredContact: 'phone',
        slotId: slot.id,
      });
      if (onCreated) onCreated();
      onClose();
    } catch (error) {
      console.error('Failed to create booking', error);
      const message = error?.response?.data?.msg || error?.response?.data?.message || 'Ошибка при создании записи';
      toast.error(message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg w-80 shadow-lg flex flex-col gap-3">
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
          onChange={(event) => setName(event.target.value)}
          className="border rounded px-2 py-1 text-sm"
        />
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
        <input
          type="text"
          placeholder="Telegram"
          value={telegram}
          onChange={(event) => setTelegram(event.target.value)}
          className="border rounded px-2 py-1 text-sm"
        />
        <textarea
          placeholder="Комментарий (необязательно)"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
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
          <button type="submit" className="px-3 py-1 rounded text-sm bg-brand-accent text-white">
            Записать
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddBookingModal;
