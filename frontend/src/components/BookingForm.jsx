import React, { useState } from 'react';
import { Calendar } from '@demark-pro/react-booking-calendar';
import '@demark-pro/react-booking-calendar/dist/react-booking-calendar.css';
import { useForm } from 'react-hook-form';
import toast, { Toaster } from 'react-hot-toast';
import axios from 'axios';

const BookingForm = () => {
  const [selectedDates, setSelectedDates] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { register, handleSubmit, formState: { errors }, reset } = useForm();

  const reserved = [
    // Пример заблокированных дат
    {
      startDate: new Date('2025-07-25'),
      endDate: new Date('2025-07-25')
    }
  ];

  const onSubmit = async (data) => {
    if (selectedDates.length === 0) {
      toast.error('Пожалуйста, выберите дату и время');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const bookingData = {
        ...data,
        appointmentDate: selectedDates[0].startDate.toISOString().split('T')[0],
        appointmentTime: selectedDates[0].startDate.toLocaleTimeString('ru-RU', {
          hour: '2-digit',
          minute: '2-digit'
        })
      };

      await axios.post('/api/bookings', bookingData);
      
      toast.success('Запись успешно создана! Вам придет подтверждение на email.');
      reset();
      setSelectedDates([]);
    } catch (error) {
      toast.error('Ошибка при создании записи. Попробуйте еще раз.');
      console.error('Booking error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Запись к психологу Александру
          </h1>
          <p className="text-xl text-gray-600">
            Выберите удобное время для консультации
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="grid md:grid-cols-2 gap-0">
            {/* Календарь */}
            <div className="p-8 bg-gray-50">
              <h2 className="text-2xl font-semibold text-gray-900 mb-6">
                Выберите дату и время
              </h2>
              <Calendar
                selected={selectedDates}
                reserved={reserved}
                onChange={setSelectedDates}
                options={{
                  locale: 'ru',
                  weekStartsOn: 1,
                  format: 'dd/MM/yyyy',
                  minDate: new Date(),
                  maxDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
                }}
                className="w-full"
              />
              
              {selectedDates.length > 0 && (
                <div className="mt-4 p-4 bg-blue-100 rounded-lg">
                  <p className="text-blue-800 font-medium">
                    Выбрано: {selectedDates[0].startDate.toLocaleDateString('ru-RU', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              )}
            </div>

            {/* Форма */}
            <div className="p-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-6">
                Ваши данные
              </h2>
              
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Имя *
                  </label>
                  <input
                    type="text"
                    {...register('clientName', { 
                      required: 'Имя обязательно для заполнения',
                      minLength: { value: 2, message: 'Имя должно содержать минимум 2 символа' }
                    })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ваше имя"
                  />
                  {errors.clientName && (
                    <p className="mt-1 text-sm text-red-600">{errors.clientName.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    {...register('clientEmail', { 
                      required: 'Email обязателен для заполнения',
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: 'Некорректный email адрес'
                      }
                    })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="your@email.com"
                  />
                  {errors.clientEmail && (
                    <p className="mt-1 text-sm text-red-600">{errors.clientEmail.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Телефон *
                  </label>
                  <input
                    type="tel"
                    {...register('clientPhone', { 
                      required: 'Телефон обязателен для заполнения',
                      pattern: {
                        value: /^[\+]?[1-9][\d]{10,14}$/,
                        message: 'Некорректный номер телефона'
                      }
                    })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="+7 (999) 123-45-67"
                  />
                  {errors.clientPhone && (
                    <p className="mt-1 text-sm text-red-600">{errors.clientPhone.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Краткое описание запроса (опционально)
                  </label>
                  <textarea
                    {...register('description')}
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Расскажите кратко, с чем хотели бы поработать..."
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-4 px-6 rounded-lg transition duration-200 text-lg"
                >
                  {isSubmitting ? 'Создание записи...' : 'Записаться на консультацию'}
                </button>
              </form>

              <div className="mt-6 text-sm text-gray-600">
                <p>• Длительность сеанса: 50-70 минут</p>
                <p>• Формат: онлайн (Zoom/Skype)</p>
                <p>• Оплата: за сутки до сеанса</p>
                <p>• Отмена: не менее чем за 24 часа</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <Toaster position="top-right" />
    </div>
  );
};

export default BookingForm;
