import React from 'react';
import toast from 'react-hot-toast';

import { TimeRangeDisplay } from '../TimezoneDisplay';
import { getClientsFocusUrl } from '../../utils/calendar';
import { deleteBooking } from '../../api/calendar';

const BookingDetailsModal = ({ booking, onClose, practitionerTimezone, onUpdated, onReschedule }) => {
  if (!booking) return null;

  const handleCopyLink = async () => {
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const url = baseUrl + getClientsFocusUrl(booking.id);
      await navigator.clipboard.writeText(url);
      toast.success('Ссылка на запись скопирована');
    } catch (error) {
      toast('Не удалось скопировать ссылку');
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Отменить (удалить) эту запись?')) return;

    try {
      await deleteBooking(booking.id);
      toast.success('Запись отменена');
      if (onUpdated) onUpdated();
      onClose();
    } catch (error) {
      toast.error(error?.response?.data?.msg || 'Не удалось отменить запись');
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
                href={getClientsFocusUrl(booking.id)}
                onClick={(event) => {
                  event.preventDefault();
                  window.open(getClientsFocusUrl(booking.id), '_blank', 'noopener,noreferrer');
                }}
                className="ml-2 text-brand-accent hover:underline"
              >
                @{booking.telegramHandle}
              </a>
            )}
          </div>
          <div>
            <span className="font-medium">Телефон:</span> {booking.clientPhone || '—'}
          </div>
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
                try {
                  window.open(`https://t.me/${handle}`, '_blank', 'noopener,noreferrer');
                } catch (error) {
                  // ignore
                }
              } else {
                toast('Нет username в Telegram');
              }
            }}
            className="px-3 py-2 rounded-lg border text-sm bg-white hover:bg-gray-50"
          >
            Переписка в Telegram
          </button>
          <button
            onClick={() => onReschedule && onReschedule(booking)}
            className="px-3 py-2 rounded-lg border text-sm bg-white hover:bg-gray-50"
          >
            Перенести
          </button>
          <button
            onClick={handleCancel}
            className="px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-red-600 text-sm hover:bg-red-100"
          >
            Отменить
          </button>
          <button
            onClick={handleCopyLink}
            className="px-3 py-2 rounded-lg border text-sm bg-white hover:bg-gray-50"
          >
            Скопировать ссылку
          </button>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm border bg-white hover:bg-gray-50"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};

export default BookingDetailsModal;
