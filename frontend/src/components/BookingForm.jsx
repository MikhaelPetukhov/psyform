import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import api from '../api';
import { DayPicker } from 'react-day-picker';
import { FiCalendar } from 'react-icons/fi';
import { format, isSameDay, startOfDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import 'react-day-picker/dist/style.css';

const LoadingSpinner = () => (
  <div className="flex flex-col items-center justify-center p-10 bg-brand-background rounded-2xl">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-accent"></div>
    <p className="mt-4 text-brand-secondary">Загружаем расписание...</p>
  </div>
);

const BookingForm = () => {
  const [slots, setSlots] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAndGroupSlots = async () => {
      try {
        setLoading(true);
        const response = await api.get('/slots');
        setSlots(response.data);
        setError(null);
      } catch (err) {
        setError('Не удалось загрузить доступное время. Пожалуйста, попробуйте обновить страницу.');
        console.error('Error fetching or grouping slots:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAndGroupSlots();
  }, []);
  const [selectedDate, setSelectedDate] = useState(undefined);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm();

  useEffect(() => {
    if (selectedSlot) {
      setValue('slotId', selectedSlot.id);
    } else {
      setValue('slotId', null);
    }
  }, [selectedSlot, setValue]);

  const availableDates = Object.keys(slots).map(dateStr => new Date(dateStr));

  const isDateAvailable = (date) => {
    return availableDates.some(availableDate => isSameDay(date, availableDate));
  };

  const handleDateSelect = (date) => {
    if (date && isDateAvailable(date)) {
      setSelectedDate(date);
      setSelectedSlot(null); // Reset selected slot when date changes
    } else {
      setSelectedDate(undefined);
    }
  };

  const getTimeSlotsForDate = (date) => {
    if (!date) return [];
    const dateKey = startOfDay(date).toISOString();
    return slots[dateKey] || [];
  };

  const onSubmit = async (data) => {
    if (!selectedSlot) {
      toast.error('Пожалуйста, выберите время консультации.');
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading('Создаем вашу запись...');

    try {
      await api.post('/bookings', {
        name: data.name,
        email: data.email,
        phone: data.phone,
        comment: data.comment,
        slotId: selectedSlot.id,
      });

      toast.success('Вы успешно записаны! Ожидайте подтверждения по email.', { id: toastId, duration: 6000 });
      reset();
      setSelectedDate(undefined);
      setSelectedSlot(null);
      // TODO: We might need to re-fetch slots here if we don't do it automatically
    } catch (error) {
      const errorMessage = error.response?.data?.msg || 'Не удалось создать запись. Возможно, это время уже занято. Пожалуйста, обновите страницу и попробуйте снова.';
      toast.error(errorMessage, { id: toastId, duration: 6000 });
      console.error('Booking error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const today = startOfDay(new Date());

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

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-background flex items-center justify-center p-4">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-brand-background flex items-center justify-center p-4">
        <div className="text-center py-10 text-red-500 bg-red-50 p-4 rounded-lg">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-background flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-5xl mx-auto bg-white rounded-2xl shadow-lg border border-gray-200/60 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2">
          {/* -- START LEFT COLUMN -- */}
          <div className="p-6 sm:p-8 border-r border-gray-200/60">
            <h2 className="text-xl font-bold text-brand-text mb-1">Запись на консультацию</h2>
            <p className="text-brand-secondary mb-6 text-sm">1. Выберите удобную дату и время</p>
            <DayPicker
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              locale={ru}
              fromDate={today}
              disabled={date => !isDateAvailable(date)}
              classNames={dayPickerClassNames}
            />

            {selectedDate && (
              <div className="mt-6 pt-6 border-t border-gray-200/60">
                <h3 className="text-base font-semibold text-brand-text mb-4">Доступное время на {format(selectedDate, 'd MMMM', { locale: ru })}:</h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {getTimeSlotsForDate(selectedDate).length > 0 ? (
                    getTimeSlotsForDate(selectedDate).map((slot) => (
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
                    ))
                  ) : (
                    <div className="col-span-full text-center py-10 border-2 border-dashed border-gray-200 rounded-xl">
                      <p className="font-medium text-brand-secondary">Нет свободных слотов.</p>
                      <p className="text-xs text-brand-secondary/80 mt-1">Выберите другой день.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!selectedDate && (
                <div className="mt-6 pt-6 border-t border-gray-200/60 text-center flex flex-col justify-center items-center h-48">
                    <FiCalendar className="w-10 h-10 text-brand-accent/50 mb-4" />
                    <p className="font-medium text-brand-secondary">Выберите дату в календаре</p>
                    <p className="text-sm text-brand-secondary/80 mt-1">чтобы увидеть доступное время</p>
                </div>
            )}
          </div>
          {/* -- END LEFT COLUMN -- */}

          {/* -- START RIGHT COLUMN -- */}
          <div className="p-6 sm:p-8 bg-gray-50/50 rounded-r-2xl">
            <h2 className="text-xl font-bold text-brand-text mb-1">Ваши данные</h2>
            <p className="text-brand-secondary mb-6 text-sm">2. Заполните форму для завершения</p>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-brand-secondary mb-1.5">Имя *</label>
                <input
                  type="text"
                  {...register('name', { required: 'Имя обязательно для заполнения' })}
                  className="w-full px-4 py-2.5 bg-white border border-gray-300/70 rounded-lg focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 transition-colors text-sm text-brand-text placeholder-gray-400"
                  placeholder="Анастасия"
                />
                {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-brand-secondary mb-1.5">Email *</label>
                <input
                  type="email"
                  {...register('email', {
                    required: 'Email обязателен',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Некорректный email адрес'
                    }
                  })}
                  className="w-full px-4 py-2.5 bg-white border border-gray-300/70 rounded-lg focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 transition-colors text-sm text-brand-text placeholder-gray-400"
                  placeholder="you@example.com"
                />
                {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-brand-secondary mb-1.5">Телефон</label>
                <input
                  type="tel"
                  {...register('phone')}
                  className="w-full px-4 py-2.5 bg-white border border-gray-300/70 rounded-lg focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 transition-colors text-sm text-brand-text placeholder-gray-400"
                  placeholder="+7 (999) 123-45-67"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-brand-secondary mb-1.5">Комментарий</label>
                <textarea
                  {...register('comment')}
                  rows="3"
                  className="w-full px-4 py-2.5 bg-white border border-gray-300/70 rounded-lg focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 transition-colors text-sm text-brand-text placeholder-gray-400"
                  placeholder="Ваш запрос или пожелания к консультации..."
                />
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedSlot}
                  className="w-full py-3 px-5 rounded-xl font-bold text-base transition-all duration-300 transform disabled:cursor-not-allowed bg-brand-accent text-white hover:bg-brand-accent/90 hover:shadow-lg hover:scale-[1.02] focus:outline-none focus:ring-4 focus:ring-brand-accent/30 disabled:bg-gray-300 disabled:text-gray-500 disabled:scale-100 disabled:shadow-none"
                >
                  {isSubmitting ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                      <span>Создаем запись...</span>
                    </div>
                  ) : (
                    <span>Записаться на консультацию</span>
                  )}
                </button>
                
                {selectedSlot && (
                   <p className="mt-3 text-xs text-center text-brand-secondary">
                      Вы записываетесь на <span className="font-semibold text-brand-text">{format(new Date(selectedSlot.slotTime), 'd MMMM yyyy', { locale: ru })} в {format(new Date(selectedSlot.slotTime), 'HH:mm')}</span>
                   </p>
                )}
              </div>
            </form>
          </div>
          {/* -- END RIGHT COLUMN -- */}
        </div>
      </div>
    </div>
  );
};

export default BookingForm;
