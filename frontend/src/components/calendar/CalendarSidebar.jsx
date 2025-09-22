import React from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

import { getBookingStatusClass } from '../../utils/bookingStatus';
import { getClientsFocusUrl } from '../../utils/calendar';

const CalendarSidebar = ({
  selectedDate,
  events,
  slots,
  loadingBookings,
  loadingSlots,
  onCreateSlot,
  onManualBooking,
  onEventSelect,
  onSlotSelect,
  onSlotDelete,
}) => (
  <aside className="rounded-lg bg-gray-50 border p-4">
    <div>
      <div className="text-sm text-gray-500 capitalize">{format(selectedDate, 'eeee', { locale: ru })}</div>
      <div className="text-2xl font-bold leading-tight">{format(selectedDate, 'd MMMM', { locale: ru })}</div>
    </div>
    <div className="mt-4 flex gap-2">
      <button
        className="px-3 py-2 rounded-lg text-sm bg-gray-900 text-white hover:bg-black"
        onClick={() => onCreateSlot(selectedDate)}
      >
        Создать слот
      </button>
      <button
        className="px-3 py-2 rounded-lg text-sm bg-gray-100 hover:bg-gray-200"
        onClick={() => onManualBooking(selectedDate)}
      >
        Назначить сессию
      </button>
    </div>

    <div className="mt-6">
      {loadingBookings ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <ul className="space-y-2">
          {events.length === 0 && (
            <li className="text-sm text-gray-500 flex items-center justify-between">
              <span>Нет записей на этот день</span>
              <button
                className="px-3 py-1 rounded-lg text-xs bg-gray-900 text-white hover:bg-black"
                onClick={() => onCreateSlot(selectedDate)}
              >
                Создать слот
              </button>
            </li>
          )}
          {events.map((event) => (
            <li
              key={event.id}
              className={`rounded-xl border shadow-sm p-3 cursor-pointer hover:shadow-md transition ${getBookingStatusClass(
                event.status,
                event.clientConfirmation,
              )}`}
              onClick={() => onEventSelect(event)}
            >
              <div className="text-sm font-medium">
                <span className="font-mono">{format(event.start, 'HH:mm')}–{format(event.end, 'HH:mm')}</span> · {event.title}
              </div>
              {event.telegramHandle && (
                <div className="text-xs mt-1">
                  <a
                    href={getClientsFocusUrl(event.id)}
                    onClick={(eventClick) => {
                      eventClick.stopPropagation();
                      window.location.href = getClientsFocusUrl(event.id);
                    }}
                    className="text-brand-accent hover:underline"
                  >
                    @{event.telegramHandle}
                  </a>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>

    {slots.length > 0 && (
      <div className="mt-6">
        <h3 className="text-lg font-semibold">Свободные слоты</h3>
        {loadingSlots ? (
          <div className="space-y-3 mt-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-8 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <ul className="space-y-2 mt-2">
            {slots.map((slot) => (
              <li
                key={slot.id}
                className="rounded-xl border p-3 shadow-sm text-brand-text flex items-center justify-between hover:shadow-md transition cursor-pointer"
                onClick={() => onSlotSelect(slot)}
              >
                <span className="text-sm">
                  {format(new Date(slot.slotTime), 'HH:mm')}–{format(new Date(slot.endTime), 'HH:mm')}
                </span>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onSlotDelete(slot);
                  }}
                  className="px-2 py-1 text-xs rounded bg-red-50 text-red-600 hover:bg-red-100"
                >
                  Удалить
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    )}
  </aside>
);

export default CalendarSidebar;
