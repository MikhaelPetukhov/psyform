import React, { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import api from '../api';
import CityTimezonePicker from './CityTimezonePicker';
import { useI18n } from '../locale/i18n';

const ProfileSettings = ({ practitionerTimezone = 'Europe/Moscow', onTimezoneUpdate, practitionerPublicSlug = '' }) => {
  const { t } = useI18n();
  const { register, handleSubmit, reset, setValue, watch } = useForm({
    defaultValues: {
      displayName: '',
      specialization: '',
      price: '',
      about: '',
      clientMessageTemplate: '',
      timezone: ''
    }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedCityMeta, setSelectedCityMeta] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Загрузка профиля + обработка profile.openTimezone в одном эффекте
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
            clientMessageTemplate: data.practitioner.clientMessageTemplate || t('profile.templateDefault'),
            timezone: data.practitioner.timezone || ''
          });
          if (data.practitioner.timezone) {
            setSelectedCityMeta({ timezone: data.practitioner.timezone });
          }
        }

        // После reset() проверяем флаг открытия выбора города
        let shouldOpen = false;
        try { shouldOpen = localStorage.getItem('profile.openTimezone') === '1'; } catch (_) { /* ignore */ }
        if (shouldOpen) {
          try { localStorage.removeItem('profile.openTimezone'); } catch (_) {}
          setValue('timezone', '', { shouldValidate: true, shouldDirty: true });
          setSelectedCityMeta(null);
          setTimeout(() => {
            const scope = document.querySelector('[data-testid="city-timezone-picker"]');
            const input = scope?.querySelector('input') || document.querySelector('input[placeholder]');
            if (input?.scrollIntoView) input.scrollIntoView({ behavior: 'smooth', block: 'start' });
            if (input?.focus) input.focus();
          }, 50);
        }
      } catch (e) {
        toast.error(t('profile.errors.load'));
      } finally {
        setLoading(false);
      }
    })();
  }, [reset, setValue, t]);


  const onSubmit = async (values) => {
    if (!values.timezone || !String(values.timezone).trim()) {
      toast.error(t('profile.errors.timezoneRequired'));
      return;
    }
    setSaving(true);
    const id = toast.loading(t('profile.saving'));
    try {
      await api.put('/practitioners/profile', values);
      // Update timezone in parent component if it changed
      if (values.timezone && values.timezone !== practitionerTimezone) {
        onTimezoneUpdate?.(values.timezone);
      }
      toast.success(t('profile.saved'), { id });
    } catch (e) {
      toast.error(e?.response?.data?.msg || t('profile.saveError'), { id });
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
    return <div className="p-6 text-sm text-brand-secondary">{t('profile.loading')}</div>;
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200/60 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold text-brand-text">{t('profile.title')}</h3>
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="px-3 py-2 text-sm rounded-lg border bg-white hover:bg-gray-50"
        >{t('profile.previewPublic')}</button>
      </div>
      {!watch('timezone') && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          {t('profile.tzBanner')}
        </div>
      )}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-brand-secondary mb-1">{t('profile.fields.displayName')}</label>
          <input {...register('displayName')} type="text" className="w-full px-4 py-2.5 bg-white border border-gray-300/70 rounded-lg" placeholder={t('profile.placeholders.displayName')} />
        </div>
        <div>
          <label className="block text-xs font-medium text-brand-secondary mb-1">{t('profile.fields.specialization')}</label>
          <input {...register('specialization')} type="text" className="w-full px-4 py-2.5 bg-white border border-gray-300/70 rounded-lg" placeholder={t('profile.placeholders.specialization')} />
        </div>
        <div>
          <label className="block text-xs font-medium text-brand-secondary mb-1">{t('profile.fields.price')}</label>
          <input {...register('price')} type="text" className="w-full px-4 py-2.5 bg-white border border-gray-300/70 rounded-lg" placeholder={t('profile.placeholders.price')} />
        </div>
        {!watch('timezone') ? (
          <div>
            <label className="block text-xs font-medium text-brand-secondary mb-2">{t('profile.fields.timezone')}</label>
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
            <div className="text-sm text-gray-500 mb-1">{t('profile.chosenTimezone')}</div>
            <div className="text-lg font-semibold text-emerald-700">{selectedCityMeta?.name || timezone}</div>
            <div className="text-sm text-gray-600">{selectedCityMeta?.admin1 || ''} {selectedCityMeta?.country ? `• ${selectedCityMeta.country}` : ''}</div>
            <div className="text-sm text-gray-600 mt-1">{tzOffset} ({timezone})</div>
            <div className="text-xs text-gray-500 mt-1">{t('profile.currentTime')} {new Date().toLocaleTimeString('ru-RU', { timeZone: timezone, hour12: false })}</div>
            <div className="mt-3">
              <button
                type="button"
                onClick={() => { setValue('timezone', ''); setSelectedCityMeta(null); }}
                className="px-3 py-1.5 text-sm rounded-lg border bg-white hover:bg-gray-50"
              >{t('profile.change')}</button>
            </div>
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-brand-secondary mb-1">{t('profile.fields.about')}</label>
          <textarea {...register('about')} rows={4} className="w-full px-4 py-2.5 bg-white border border-gray-300/70 rounded-lg" placeholder={t('profile.placeholders.about')} />
        </div>
        <div>
          <label className="block text-xs font-medium text-brand-secondary mb-1" title={t('profile.templateHint')}>{t('profile.fields.template')}</label>
          <textarea {...register('clientMessageTemplate')} rows={3} className="w-full px-4 py-2.5 bg-white border border-gray-300/70 rounded-lg" placeholder={t('profile.placeholders.template')} />
          <p className="text-xs text-brand-secondary mt-1">
            {t('profile.templateHint')}
          </p>
          {/* Live preview */}
          <MessageTemplatePreview
            template={watch('clientMessageTemplate')}
            practitionerName={watch('displayName') || t('profile.defaultPractitionerName')}
            timezone={watch('timezone') || practitionerTimezone}
          />
        </div>
        <div className="pt-2">
          <button disabled={saving || !watch('timezone')} type="submit" className="px-4 py-2 rounded-lg bg-brand-accent text-white font-semibold disabled:opacity-60">{saving ? t('profile.saving') : t('profile.save')}</button>
        </div>
      </form>

      {previewOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="relative w-full max-w-4xl bg-white rounded-xl shadow-xl overflow-hidden">
            <button
              onClick={() => setPreviewOpen(false)}
              className="absolute top-2 right-2 px-3 py-1.5 text-sm rounded bg-gray-100 hover:bg-gray-200"
            >{t('profile.modal.close')}</button>
            <div className="h-[80vh]">
              {practitionerPublicSlug ? (
                <iframe
                  title="Public Page Preview"
                  src={`/p/${practitionerPublicSlug}`}
                  className="w-full h-full border-0"
                />
              ) : (
                <div className="p-6 text-sm text-brand-secondary">{t('profile.modal.noPublicLink')}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function MessageTemplatePreview({ template, practitionerName, timezone }) {
  const { t } = useI18n();
  const clientName = 'Иван';
  const dt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  let dateStr;
  let timeStr;
  try {
    dateStr = dt.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric', timeZone: timezone });
    timeStr = dt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: timezone });
  } catch (_) {
    dateStr = dt.toLocaleDateString('ru-RU');
    timeStr = dt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }
  const text = String(template || '')
    .replace(/\{\{\s*clientName\s*\}\}/g, clientName)
    .replace(/\{\{\s*practitionerName\s*\}\}/g, practitionerName)
    .replace(/\{\{\s*date\s*\}\}/g, dateStr)
    .replace(/\{\{\s*time\s*\}\}/g, timeStr);
  return (
    <div className="mt-2 p-3 rounded-lg bg-gray-50 border border-gray-200 text-sm text-brand-text">
      <div className="text-xs text-brand-secondary mb-1">{t('profile.templateExampleTitle')}</div>
      <div className="whitespace-pre-line">{text}</div>
    </div>
  );
}

export default ProfileSettings;


