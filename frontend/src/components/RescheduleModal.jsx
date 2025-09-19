import React, { useEffect, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { ru } from 'date-fns/locale';
import { format, isSameDay, startOfDay, parse } from 'date-fns';
import api from '../api';
import { toast } from 'react-hot-toast';

const RescheduleModal = ({ isOpen, booking, onClose, onRescheduled }) => {
  const [slots, setSlots] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(undefined);
  const [selectedSlot, setSelectedSlot] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const { data } = await api.get('/slots');
        if (!cancelled) setSlots(data || {});
      } catch (e) {
        toast.error('Не удалось загрузить слоты');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    // Preselect the date of the current booking
    if (booking?.slotTime) {
      const d = startOfDay(new Date(booking.slotTime));
      setSelectedDate(d);
    }
  }, [isOpen, booking]);

  const availableDates = Object.keys(slots).map(dateStr =>
    parse(dateStr, 'yyyy-MM-dd', new Date())
  );

  const isDateAvailable = (date) => {
    return availableDates.some(availableDate => isSameDay(date, availableDate));
  };

  const getTimeSlotsForDate = (date) => {
    if (!date) return [];
    const dateKey = format(startOfDay(date), 'yyyy-MM-dd');
    return slots[dateKey] || [];
  };

  const handleSubmit = async () => {
    if (!selectedSlot) {
      toast.error('Выберите новое время');
      return;
    }
    const id = toast.loading('Переносим запись...');
    try {
      const { data } = await api.patch(`/bookings/${booking.id}/reschedule`, { slotId: selectedSlot.id });
      toast.success('Запись перенесена', { id });
      if (onRescheduled) onRescheduled(data);
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.msg || 'Не удалось перенести запись', { id });
    }
  };

  if (!isOpen) return null;

  const dayPickerClassNames = {
    root: 'border-0',
    caption: 'flex justify-center items-center h-10',
    caption_label: 'text-lg font-medium text-brand-text',
    nav: 'flex items-center',
    nav_button: 'h-8 w-8 flex items-center justify-center rounded-full hover:bg-brand-light-accent transition-colors',
    nav_button_previous: 'mr-2',
    nav_button_next: 'ml-2',
    table: 'w-full border-collapse mt-4',
    head_row: 'flex justify-between',
    head_cell: 'w-10 h-10 flex items-center justify-center text-sm font-normal text-brand-secondary',
    row: 'flex w-full mt-2 justify-between',
    cell: 'w-10 h-10 text-center',
    day: 'w-10 h-10 flex items-center justify-center rounded-full transition-colors hover:bg-brand-light-accent',
    day_today: 'font-bold text-brand-accent',
    day_selected: 'bg-brand-accent text-white hover:bg-brand-accent/90',
    day_disabled: 'text-gray-300 cursor-not-allowed',
    day_outside: 'text-gray-300',
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden">
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-500 hover:text-gray-700">✕</button>
        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="p-6 border-r border-gray-200/60">
            <h3 className="text-lg font-semibold text-brand-text mb-2">Выберите новую дату</h3>
            <DayPicker
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              locale={ru}
              fromDate={new Date()}
              disabled={(date) => !isDateAvailable(date)}
              classNames={dayPickerClassNames}
            />
          </div>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-brand-text mb-2">Доступное время</h3>
            {!selectedDate ? (
              <p className="text-sm text-brand-secondary">Сначала выберите дату</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {getTimeSlotsForDate(selectedDate).map((slot) => (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => setSelectedSlot(slot)}
                    className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors duration-200 border ${
                      selectedSlot?.id === slot.id
                        ? 'bg-brand-accent text-white border-brand-accent shadow-md'
                        : 'bg-white text-brand-text border-gray-300/80 hover:border-brand-accent hover:text-brand-accent'
                    }`}
                  >
                    {format(new Date(slot.slotTime), 'HH:mm')}
                  </button>
                ))}
                {getTimeSlotsForDate(selectedDate).length === 0 && (
                  <div className="col-span-full text-sm text-brand-secondary">Нет свободных слотов</div>
                )}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={onClose} className="px-4 py-2 rounded-lg border">Отмена</button>
              <button onClick={handleSubmit} disabled={!selectedSlot || loading} className="px-4 py-2 rounded-lg bg-brand-accent text-white disabled:opacity-50">Перенести</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RescheduleModal;
