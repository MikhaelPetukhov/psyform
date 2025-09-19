import React, { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import api from '../api';
import CityTimezonePicker from './CityTimezonePicker';

const ProfileSettings = ({ practitionerTimezone = 'Europe/Moscow', onTimezoneUpdate }) => {
  const { register, handleSubmit, reset, setValue, watch } = useForm({
    defaultValues: {
      displayName: '',
      specialization: '',
      price: '',
      about: '',
      clientMessageTemplate: 'Здравствуйте, {{clientName}}! Вы записаны на {{date}}. Ссылка придёт перед началом сеанса.',
      timezone: ''
    }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedCityMeta, setSelectedCityMeta] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { data } = await api.get('/practitioners/profile');
        if (data?.practitioner) {
          reset({
            displayName: data.practitioner.displayName || '',
            specialization: data.practitioner.specialization || '',
            price: data.practitioner.price || '',
            about: data.practitioner.about || '',
            clientMessageTemplate: data.practitioner.clientMessageTemplate || 'Здравствуйте, {{clientName}}! Вы записаны на {{date}}. Ссылка придёт перед началом сеанса.',
            timezone: data.practitioner.timezone || ''
          });
          if (data.practitioner.timezone) {
            setSelectedCityMeta({ timezone: data.practitioner.timezone });
          }
        }
      } catch (e) {
        toast.error('Не удалось загрузить профиль');
      } finally {
        setLoading(false);
      }
    })();
  }, [reset]);

  const onSubmit = async (values) => {
    if (!values.timezone || !String(values.timezone).trim()) {
      toast.error('Для начала работы укажите город и часовой пояс');
      return;
    }
    setSaving(true);
    const id = toast.loading('Сохраняем профиль...');
    try {
      await api.put('/practitioners/profile', values);
      // Update timezone in parent component if it changed
      if (values.timezone && values.timezone !== practitionerTimezone) {
        onTimezoneUpdate?.(values.timezone);
      }
      toast.success('Профиль сохранён', { id });
    } catch (e) {
      toast.error(e?.response?.data?.msg || 'Ошибка сохранения', { id });
    } finally {
      setSaving(false);
    }
  };

  // Helpers for selected city card
  const timezone = watch('timezone');
  const tzOffset = useMemo(() => {
    if (!timezone) return '';
    try {
      const parts = new Intl.DateTimeFormat('ru-RU', { timeZone: timezone, timeZoneName: 'short' }).formatToParts(new Date());
      const name = parts.find(p => p.type === 'timeZoneName')?.value || '';
      return name.replace('GMT', 'UTC');
    } catch (_) { return ''; }
  }, [timezone]);

  if (loading) {
    return <div className="p-6 text-sm text-brand-secondary">Загрузка профиля…</div>;
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200/60 p-6">
      <h3 className="text-xl font-semibold text-brand-text mb-4">Настройки профиля</h3>
      {!watch('timezone') && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          Для начала работы укажите ваш город и часовой пояс. Это необходимо для корректного отображения времени.
        </div>
      )}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-brand-secondary mb-1">ФИО / Отображаемое имя</label>
          <input {...register('displayName')} type="text" className="w-full px-4 py-2.5 bg-white border border-gray-300/70 rounded-lg" placeholder="Иван Иванов" />
        </div>
        <div>
          <label className="block text-xs font-medium text-brand-secondary mb-1">Специализация</label>
          <input {...register('specialization')} type="text" className="w-full px-4 py-2.5 bg-white border border-gray-300/70 rounded-lg" placeholder="Психотерапевт" />
        </div>
        <div>
          <label className="block text-xs font-medium text-brand-secondary mb-1">Цена приёма</label>
          <input {...register('price')} type="text" className="w-full px-4 py-2.5 bg-white border border-gray-300/70 rounded-lg" placeholder="5000 ₽" />
        </div>
        {!watch('timezone') ? (
          <div>
            <label className="block text-xs font-medium text-brand-secondary mb-2">Ваш часовой пояс</label>
            <CityTimezonePicker
              value={watch('timezone')}
              onSelect={(tz, meta) => {
                setValue('timezone', tz, { shouldValidate: true, shouldDirty: true });
                setSelectedCityMeta({ ...meta, timezone: tz });
              }}
            />
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="text-sm text-gray-500 mb-1">Выбранный часовой пояс</div>
            <div className="text-lg font-semibold text-emerald-700">{selectedCityMeta?.name || timezone}</div>
            <div className="text-sm text-gray-600">{selectedCityMeta?.admin1 || ''} {selectedCityMeta?.country ? `• ${selectedCityMeta.country}` : ''}</div>
            <div className="text-sm text-gray-600 mt-1">{tzOffset} ({timezone})</div>
            <div className="text-xs text-gray-500 mt-1">Текущее время: {new Date().toLocaleTimeString('ru-RU', { timeZone: timezone, hour12: false })}</div>
            <div className="mt-3">
              <button
                type="button"
                onClick={() => { setValue('timezone', ''); setSelectedCityMeta(null); }}
                className="px-3 py-1.5 text-sm rounded-lg border bg-white hover:bg-gray-50"
              >Изменить</button>
            </div>
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-brand-secondary mb-1">О себе</label>
          <textarea {...register('about')} rows={4} className="w-full px-4 py-2.5 bg-white border border-gray-300/70 rounded-lg" placeholder="Краткая информация о вас" />
        </div>
        <div>
          <label className="block text-xs font-medium text-brand-secondary mb-1">Шаблон сообщения клиенту</label>
          <textarea {...register('clientMessageTemplate')} rows={3} className="w-full px-4 py-2.5 bg-white border border-gray-300/70 rounded-lg" placeholder="Здравствуйте, {{clientName}}! Вы записаны на {{date}}." />
          <p className="text-xs text-brand-secondary mt-1">
            Поддерживаются переменные: {'{{clientName}}'}, {'{{practitionerName}}'}, {'{{date}}'}, {'{{time}}'}.
          </p>
        </div>
        <div className="pt-2">
          <button disabled={saving || !watch('timezone')} type="submit" className="px-4 py-2 rounded-lg bg-brand-accent text-white font-semibold disabled:opacity-60">{saving ? 'Сохранение…' : 'Сохранить'}</button>
        </div>
      </form>
    </div>
  );
};

export default ProfileSettings;
