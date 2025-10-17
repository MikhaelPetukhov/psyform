import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import api from '../api';
import { FiSave, FiLoader, FiAlertTriangle, FiClock, FiCoffee, FiCalendar } from 'react-icons/fi';
import CalendarModal from './CalendarModal';
import { useI18n } from '../locale/i18n';

// Days of week are localized via schedule.dowShort (Mon..Sun)

const ScheduleSettingsTab = ({ practitionerTimezone = 'Europe/Moscow' }) => {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const daysOfWeek = useMemo(() => {
    const arr = t('schedule.dowShort');
    const names = Array.isArray(arr) ? arr : ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
    return [
      { id: 1, name: names[0] },
      { id: 2, name: names[1] },
      { id: 3, name: names[2] },
      { id: 4, name: names[3] },
      { id: 5, name: names[4] },
      { id: 6, name: names[5] },
      { id: 0, name: names[6] },
    ];
  }, [t]);

  const { register, handleSubmit, reset, watch } = useForm({
    defaultValues: {
      workingDays: [],
      workingHours: { start: '09:00', end: '18:00' },
      sessionDuration: 60,
      breakBetweenSessions: 15,
      lunchBreak: { enabled: false, start: '13:00', end: '14:00' },
      generationPeriodDays: 30,
      autoGenerateEnabled: false,
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
          autoGenerateEnabled: !!settings.autoGenerateEnabled,
        };
        
        reset(formValues);
        setError(null);
      } catch (err) {
        setError(t('schedule.errorLoad'));
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

    const toastId = toast.loading(t('schedule.savingSettings'));
    setIsSubmitting(true);
    try {
      await api.put('/admin/schedule-settings', formattedData);
      toast.success(t('schedule.saved'), { id: toastId });
      setPreviewOpen(true);
    } catch (err) {
      toast.error(err.response?.data?.msg || t('errors.generic'), { id: toastId });
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateSlots = async () => {
    setIsGenerating(true);
    const toastId = toast.loading(t('schedule.generatingStart'));

    try {
      const response = await api.post('/slots/generate');
      toast.success(response.data.msg, { id: toastId });
      setPreviewOpen(true);
    } catch (error) {
      const errorMessage = error.response?.data?.msg || t('errors.generic');
      toast.error(errorMessage, { id: toastId });
    } finally {
      setIsGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-16">
        <FiLoader className="mx-auto h-12 w-12 text-brand-accent animate-spin" />
        <h4 className="mt-4 text-lg font-medium text-brand-text">{t('schedule.loading')}</h4>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16 bg-red-50 p-6 rounded-lg">
        <FiAlertTriangle className="mx-auto h-12 w-12 text-red-500" />
        <h4 className="mt-4 text-lg font-medium text-red-700">{t('errors.generic')}</h4>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-8 rounded-xl shadow-lg space-y-8">
      <div className="flex items-center justify-between">
        <div className="text-sm text-brand-secondary" title={t('schedule.tzHint')}>
          {t('schedule.tzCurrent')}<span className="font-medium text-brand-text">{practitionerTimezone}</span>
        </div>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Working Days */}
        <div>
          <h3 className="text-xl font-semibold text-brand-text flex items-center"><FiCalendar className="mr-3 text-brand-accent"/>{t('schedule.headings.workingDays')}</h3>
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
          <h3 className="text-xl font-semibold text-brand-text flex items-center"><FiClock className="mr-3 text-brand-accent"/>{t('schedule.headings.workingHours')}</h3>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="workingHours.start" className="block text-sm font-medium text-brand-secondary mb-1">{t('schedule.labels.startOfDay')}</label>
              <input type="time" id="workingHours.start" {...register('workingHours.start')} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-accent focus:border-brand-accent" />
            </div>
            <div>
              <label htmlFor="workingHours.end" className="block text-sm font-medium text-brand-secondary mb-1">{t('schedule.labels.endOfDay')}</label>
              <input type="time" id="workingHours.end" {...register('workingHours.end')} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-accent focus:border-brand-accent" />
            </div>
          </div>
        </div>

        {/* Session and Breaks */}
        <div>
          <h3 className="text-xl font-semibold text-brand-text flex items-center"><FiCoffee className="mr-3 text-brand-accent"/>{t('schedule.headings.sessionsAndBreaks')}</h3>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="sessionDuration" className="block text-sm font-medium text-brand-secondary mb-1">{t('schedule.labels.sessionDuration')}</label>
              <input type="number" id="sessionDuration" {...register('sessionDuration', { required: true, valueAsNumber: true })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-accent focus:border-brand-accent" />
            </div>
            <div>
              <label htmlFor="breakBetweenSessions" className="block text-sm font-medium text-brand-secondary mb-1">{t('schedule.labels.breakBetweenSessions')}</label>
              <input type="number" id="breakBetweenSessions" {...register('breakBetweenSessions', { required: true, valueAsNumber: true })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-accent focus:border-brand-accent" />
            </div>
          </div>
        </div>

        {/* Lunch Break */}
        <div>
          <h3 className="text-xl font-semibold text-brand-text flex items-center"><FiCoffee className="mr-3 text-brand-accent"/>{t('schedule.headings.lunchBreak')}</h3>
          <div className="mt-4 space-y-4">
            <div className="flex items-center">
              <input type="checkbox" id="lunchBreak.enabled" {...register('lunchBreak.enabled')} className="h-4 w-4 text-brand-accent focus:ring-brand-accent border-gray-300 rounded"/>
              <label htmlFor="lunchBreak.enabled" className="ml-2 block text-sm font-medium text-brand-secondary">{t('schedule.labels.lunchEnabled')}</label>
            </div>
            {lunchBreakEnabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-6 border-l-2 border-brand-accent/30">
                <div>
                  <label htmlFor="lunchBreak.start" className="block text-sm font-medium text-brand-secondary mb-1">{t('schedule.labels.lunchStart')}</label>
                  <input type="time" id="lunchBreak.start" {...register('lunchBreak.start')} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-accent focus:border-brand-accent"/>
                </div>
                <div>
                  <label htmlFor="lunchBreak.end" className="block text-sm font-medium text-brand-secondary mb-1">{t('schedule.labels.lunchEnd')}</label>
                  <input type="time" id="lunchBreak.end" {...register('lunchBreak.end')} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-accent focus:border-brand-accent"/>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Generation Period */}
        <div>
          <h3 className="text-xl font-semibold text-brand-text flex items-center"><FiCalendar className="mr-3 text-brand-accent"/>{t('schedule.headings.generationPeriod')}</h3>
          <div className="mt-4">
            <label htmlFor="generationPeriodDays" className="block text-sm font-medium text-brand-secondary mb-1">{t('schedule.labels.periodDays')}</label>
            <input type="number" id="generationPeriodDays" {...register('generationPeriodDays', { required: true, valueAsNumber: true, min: 1, max: 90 })} className="w-full md:w-1/2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-accent focus:border-brand-accent"/>
          </div>
        </div>

        {/* Auto-generation Settings */}
        <div>
          <h3 className="text-xl font-semibold text-brand-text">{t('schedule.headings.autoGeneration')}</h3>
          <p className="text-sm text-brand-secondary mt-1">{t('schedule.quickGenText')}</p>
          <div className="mt-3 flex items-center gap-2">
            <input id="autoGenerateEnabled" type="checkbox" {...register('autoGenerateEnabled')} className="h-4 w-4 text-brand-accent focus:ring-brand-accent border-gray-300 rounded" />
            <label htmlFor="autoGenerateEnabled" className="text-sm text-brand-text">{t('schedule.labels.autoGenerateEnabled')}</label>
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
            {isSubmitting ? t('schedule.saving') : t('schedule.save')}
          </button>
        </div>
      </form>

      <div className="mt-6 pt-6 border-t border-gray-200">
        <h3 className="text-lg leading-6 font-medium text-gray-900">{t('schedule.headings.quickGen')}</h3>
        <p className="mt-1 text-sm text-gray-500">
          {t('schedule.quickGenText')}
        </p>
        <div className="mt-4">
          <button
            type="button"
            onClick={handleGenerateSlots}
            disabled={isSubmitting || isGenerating}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
          >
            {isGenerating ? t('schedule.generating') : t('schedule.generateNow')}
          </button>
        </div>
      </div>

      <CalendarModal isOpen={previewOpen} onClose={() => setPreviewOpen(false)} />
    </div>
  );
};

export default ScheduleSettingsTab;
