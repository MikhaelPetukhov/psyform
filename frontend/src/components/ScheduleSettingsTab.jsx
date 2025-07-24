import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import api from '../api';
import { FiSave, FiLoader, FiAlertTriangle, FiClock, FiCoffee, FiCalendar } from 'react-icons/fi';

const daysOfWeek = [
  { id: 1, name: 'Пн' },
  { id: 2, name: 'Вт' },
  { id: 3, name: 'Ср' },
  { id: 4, name: 'Чт' },
  { id: 5, name: 'Пт' },
  { id: 6, name: 'Сб' },
  { id: 0, name: 'Вс' },
];

const ScheduleSettingsTab = () => {
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, reset, control, watch } = useForm({
    defaultValues: {
      workingDays: [],
      workingHours: { start: '09:00', end: '18:00' },
      sessionDuration: 60,
      breakBetweenSessions: 15,
      lunchBreak: { enabled: false, start: '13:00', end: '14:00' },
      generationPeriodDays: 30,
    },
  });

  const lunchBreakEnabled = watch('lunchBreak.enabled');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const response = await api.get('/admin/schedule-settings');
        const settings = response.data;
        
        // Ensure settings exist and have defaults before resetting the form
        const formValues = {
          ...settings,
          workingDays: settings.workingDays || [],
          workingHours: settings.workingHours || { start: '09:00', end: '18:00' },
          sessionDuration: settings.sessionDuration || 60,
          breakBetweenSessions: settings.breakBetweenSessions || 15,
          lunchBreak: settings.lunchBreak || { enabled: false, start: '13:00', end: '14:00' },
          generationPeriodDays: settings.generationPeriodDays || 30,
        };
        
        reset(formValues);
        setError(null);
      } catch (err) {
        setError('Не удалось загрузить настройки. Попробуйте обновить страницу.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [reset]);

  const onSubmit = async (data) => {
    // Format data to match the backend's expected structure
    const formattedData = {
      ...data,
      workingDays: data.workingDays.map(d => parseInt(d, 10)),
      sessionDuration: parseInt(data.sessionDuration, 10),
      breakBetweenSessions: parseInt(data.breakBetweenSessions, 10),
      generationPeriodDays: parseInt(data.generationPeriodDays, 10),
    };

    const toastId = toast.loading('Сохранение настроек...');
    setIsSubmitting(true);
    try {
      await api.put('/admin/schedule-settings', formattedData);
      toast.success('Настройки успешно сохранены!', { id: toastId });
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Ошибка при сохранении. Проверьте данные.', { id: toastId });
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateSlots = async () => {
    setIsGenerating(true);
    const toastId = toast.loading('Начинаем генерацию слотов...');

    try {
      const response = await api.post('/slots/generate');
      toast.success(response.data.msg, { id: toastId });
    } catch (error) {
      const errorMessage = error.response?.data?.msg || 'Не удалось сгенерировать слоты. Проверьте настройки и попробуйте снова.';
      toast.error(errorMessage, { id: toastId });
    } finally {
      setIsGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-16">
        <FiLoader className="mx-auto h-12 w-12 text-brand-accent animate-spin" />
        <h4 className="mt-4 text-lg font-medium text-brand-text">Загрузка настроек...</h4>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16 bg-red-50 p-6 rounded-lg">
        <FiAlertTriangle className="mx-auto h-12 w-12 text-red-500" />
        <h4 className="mt-4 text-lg font-medium text-red-700">Ошибка</h4>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-8 rounded-xl shadow-lg space-y-8">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Working Days */}
        <div>
          <h3 className="text-xl font-semibold text-brand-text flex items-center"><FiCalendar className="mr-3 text-brand-accent"/>Рабочие дни</h3>
          <div className="mt-4 grid grid-cols-4 sm:grid-cols-7 gap-2">
            {daysOfWeek.map((day) => (
              <div key={day.id}>
                <input
                  type="checkbox"
                  id={`day-${day.id}`}
                  value={day.id}
                  {...register('workingDays')}
                  className="sr-only peer"
                />
                <label
                  htmlFor={`day-${day.id}`}
                  className="w-full text-center block py-2 px-3 border rounded-lg cursor-pointer text-sm font-medium peer-checked:bg-brand-accent peer-checked:text-white peer-checked:border-brand-accent transition-colors duration-200"
                >
                  {day.name}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Working Hours */}
        <div>
          <h3 className="text-xl font-semibold text-brand-text flex items-center"><FiClock className="mr-3 text-brand-accent"/>Рабочие часы</h3>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="workingHours.start" className="block text-sm font-medium text-brand-secondary mb-1">Начало дня</label>
              <input type="time" id="workingHours.start" {...register('workingHours.start')} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-accent focus:border-brand-accent" />
            </div>
            <div>
              <label htmlFor="workingHours.end" className="block text-sm font-medium text-brand-secondary mb-1">Конец дня</label>
              <input type="time" id="workingHours.end" {...register('workingHours.end')} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-accent focus:border-brand-accent" />
            </div>
          </div>
        </div>

        {/* Session and Breaks */}
        <div>
          <h3 className="text-xl font-semibold text-brand-text flex items-center"><FiCoffee className="mr-3 text-brand-accent"/>Сессии и перерывы</h3>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="sessionDuration" className="block text-sm font-medium text-brand-secondary mb-1">Длительность сессии (мин)</label>
              <input type="number" id="sessionDuration" {...register('sessionDuration', { required: true, valueAsNumber: true })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-accent focus:border-brand-accent" />
            </div>
            <div>
              <label htmlFor="breakBetweenSessions" className="block text-sm font-medium text-brand-secondary mb-1">Перерыв между сессиями (мин)</label>
              <input type="number" id="breakBetweenSessions" {...register('breakBetweenSessions', { required: true, valueAsNumber: true })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-accent focus:border-brand-accent" />
            </div>
          </div>
        </div>

        {/* Lunch Break */}
        <div>
          <h3 className="text-xl font-semibold text-brand-text flex items-center"><FiCoffee className="mr-3 text-brand-accent"/>Обеденный перерыв</h3>
          <div className="mt-4 space-y-4">
            <div className="flex items-center">
              <input type="checkbox" id="lunchBreak.enabled" {...register('lunchBreak.enabled')} className="h-4 w-4 text-brand-accent focus:ring-brand-accent border-gray-300 rounded"/>
              <label htmlFor="lunchBreak.enabled" className="ml-2 block text-sm font-medium text-brand-secondary">Включить обеденный перерыв</label>
            </div>
            {lunchBreakEnabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-6 border-l-2 border-brand-accent/30">
                <div>
                  <label htmlFor="lunchBreak.start" className="block text-sm font-medium text-brand-secondary mb-1">Начало обеда</label>
                  <input type="time" id="lunchBreak.start" {...register('lunchBreak.start')} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-accent focus:border-brand-accent"/>
                </div>
                <div>
                  <label htmlFor="lunchBreak.end" className="block text-sm font-medium text-brand-secondary mb-1">Конец обеда</label>
                  <input type="time" id="lunchBreak.end" {...register('lunchBreak.end')} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-accent focus:border-brand-accent"/>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Generation Period */}
        <div>
          <h3 className="text-xl font-semibold text-brand-text flex items-center"><FiCalendar className="mr-3 text-brand-accent"/>Период генерации</h3>
          <div className="mt-4">
            <label htmlFor="generationPeriodDays" className="block text-sm font-medium text-brand-secondary mb-1">Генерировать слоты на (дней вперед)</label>
            <input type="number" id="generationPeriodDays" {...register('generationPeriodDays', { required: true, valueAsNumber: true, min: 1, max: 90 })} className="w-full md:w-1/2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-accent focus:border-brand-accent"/>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end pt-4 border-t border-gray-200/80">
          <button
            type="submit"
            disabled={isSubmitting || isGenerating}
            className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-semibold rounded-lg shadow-sm text-white bg-brand-accent hover:bg-brand-accent/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-accent disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isSubmitting ? <FiLoader className="animate-spin -ml-1 mr-3 h-5 w-5" /> : <FiSave className="-ml-1 mr-3 h-5 w-5"/>}
            {isSubmitting ? 'Сохранение...' : 'Сохранить изменения'}
          </button>
        </div>
      </form>

      <div className="mt-6 pt-6 border-t border-gray-200">
        <h3 className="text-lg leading-6 font-medium text-gray-900">Автоматическая генерация</h3>
        <p className="mt-1 text-sm text-gray-500">
          Нажмите кнопку ниже, чтобы автоматически создать доступные для записи слоты на основе сохраненных настроек расписания.
        </p>
        <div className="mt-4">
          <button
            type="button"
            onClick={handleGenerateSlots}
            disabled={isSubmitting || isGenerating}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
          >
            {isGenerating ? 'Генерация...' : 'Сгенерировать слоты'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScheduleSettingsTab;
