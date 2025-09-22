import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import Cleave from 'cleave.js/react';
import 'cleave.js/dist/addons/cleave-phone.i18n';
import toast from 'react-hot-toast';
import api from '../api';
import { DayPicker } from 'react-day-picker';
import { FiCalendar } from 'react-icons/fi';
import TelegramLogin from './TelegramLogin';
import ClientTimezoneSelector from './ClientTimezoneSelector';
import { format, isSameDay, startOfDay, parse } from 'date-fns';
import { ru } from 'date-fns/locale';
import 'react-day-picker/dist/style.css';
import { normalizePhoneForSubmit, isValidRuPhone } from '../utils/phoneFormat';
import { FiCheckCircle } from 'react-icons/fi';
import { TimeRangeDisplay } from './TimezoneDisplay';

const LoadingSpinner = () => (
  <div className="flex flex-col items-center justify-center p-10 bg-brand-background rounded-2xl">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-accent"></div>
    <p className="mt-4 text-brand-secondary">Загружаем расписание...</p>
  </div>
);

const findNextAvailableSlot = (slotsMap = {}) => {
  const sortedDateKeys = Object.keys(slotsMap).sort();

  for (const dateKey of sortedDateKeys) {
    const slotsForDate = Array.isArray(slotsMap[dateKey]) ? [...slotsMap[dateKey]] : [];
    slotsForDate.sort((a, b) => new Date(a.slotTime).getTime() - new Date(b.slotTime).getTime());

    if (slotsForDate.length > 0) {
      return { dateKey, slot: slotsForDate[0] };
    }
  }

  return null;
};

const BookingForm = () => {
  const { slug: routeSlug } = useParams();
  const [slots, setSlots] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Убрали автопоказ админского календаря из публичной формы по соображениям безопасности
  const [selectedDate, setSelectedDate] = useState(undefined);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [autoSelected, setAutoSelected] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // const [isCalendarOpen, setIsCalendarOpen] = useState(false); // удалено: не показываем админский календарь в публичной форме
  const [phoneLocked, setPhoneLocked] = useState(false);
  const [clientTimezone, setClientTimezone] = useState(() => {
    try {
      const stored = (typeof window !== 'undefined') ? localStorage.getItem('clientTimezone') : null;
      if (stored && typeof stored === 'string') return stored;
    } catch (_) {}
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Moscow';
    } catch (_) {
      return 'Europe/Moscow';
    }
  });

  const selectedDateRef = useRef(selectedDate);

  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  const updateSelectedDate = useCallback((date) => {
    selectedDateRef.current = date;
    setSelectedDate(date);
  }, [setSelectedDate, selectedDateRef]);

  const applyAutoSelection = useCallback((incomingSlots = {}) => {
    const nextInfo = findNextAvailableSlot(incomingSlots);

    if (!nextInfo) {
      if (!selectedDateRef.current) {
        setSelectedSlot(null);
        updateSelectedDate(undefined);
      }
      setAutoSelected(false);
      return;
    }

    if (!selectedDateRef.current) {
      const parsedDate = parse(nextInfo.dateKey, 'yyyy-MM-dd', new Date());
      updateSelectedDate(parsedDate);
      setSelectedSlot(nextInfo.slot);
      setAutoSelected(true);
    }
  }, [selectedDateRef, updateSelectedDate, setSelectedSlot, setAutoSelected]);

  const fetchAndGroupSlots = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/slots', { params: { ts: Date.now() } });
      const fetchedSlots = response.data || {};
      setSlots(fetchedSlots);
      setError(null);
      applyAutoSelection(fetchedSlots);
    } catch (err) {
      setError('Не удалось загрузить доступное время. Пожалуйста, попробуйте обновить страницу.');
      console.error('Error fetching or grouping slots:', err);
    } finally {
      setLoading(false);
    }
  }, [applyAutoSelection]);

  const handleClientTimezoneChange = (tz) => {
    try { if (typeof window !== 'undefined') localStorage.setItem('clientTimezone', tz); } catch (_) {}
    setClientTimezone(tz);
  };

  useEffect(() => {
    // Apply practitioner scoping from route param /p/:slug
    try {
      if (routeSlug && routeSlug.trim()) {
        localStorage.removeItem('practitionerId');
        localStorage.removeItem('practitionerSlug');
        localStorage.setItem('practitionerPublicSlug', routeSlug.trim());
        if (typeof window !== 'undefined') {
          window.__PRACTITIONER_ID__ = undefined;
          window.__PRACTITIONER_SLUG__ = undefined;
          window.__PRACTITIONER_PUBLIC_SLUG__ = routeSlug.trim();
        }
      }
    } catch (_) {}
  }, [routeSlug]);

  useEffect(() => {
    fetchAndGroupSlots();
  }, [fetchAndGroupSlots]);

  useEffect(() => {
    applyAutoSelection(slots);
  }, [slots, applyAutoSelection]);

  // Re-fetch when user returns to tab or window gains focus (e.g., after admin created a slot on another tab)
  useEffect(() => {
    const onFocus = () => { fetchAndGroupSlots(); };
    const onVisibility = () => {
      try {
        if (document.visibilityState === 'visible') fetchAndGroupSlots();
      } catch (_) {}
    };
    try { window.addEventListener('focus', onFocus); } catch (_) {}
    try { document.addEventListener('visibilitychange', onVisibility); } catch (_) {}
    return () => {
      try { window.removeEventListener('focus', onFocus); } catch (_) {}
      try { document.removeEventListener('visibilitychange', onVisibility); } catch (_) {}
    };
  }, [fetchAndGroupSlots]);

  const { register, handleSubmit, formState: { errors }, reset, setValue, control, watch } = useForm();

  const handleTelegramLogin = (client) => {
    // If client is logged in and has a Telegram phone, auto-fill and lock the phone field
    if (client && client.tgPhone) {
      const digits = String(client.tgPhone).replace(/\D/g, '');
      const display = digits.startsWith('+') ? digits : `+${digits}`;
      setValue('phone', display, { shouldValidate: true, shouldDirty: false });
      setPhoneLocked(true);

      // Prefer Telegram as contact method and prefill username
      if (client.tgUsername) {
        const uname = client.tgUsername.startsWith('@') ? client.tgUsername : `@${client.tgUsername}`;
        setValue('telegram', uname, { shouldValidate: true, shouldDirty: false });
      }
      setValue('preferredContact', 'telegram', { shouldValidate: true, shouldDirty: true });
    } else {
      // No client or no phone -> unlock and clear to allow manual input (if ever needed)
      setPhoneLocked(false);
      setValue('phone', '', { shouldValidate: true, shouldDirty: false });
      setValue('preferredContact', undefined, { shouldValidate: true, shouldDirty: false });
      setValue('telegram', '', { shouldValidate: false, shouldDirty: false });
    }
  };

  useEffect(() => {
    if (selectedSlot) {
      setValue('slotId', selectedSlot.id);
    } else {
      setValue('slotId', null);
    }
  }, [selectedSlot, setValue]);

  const availableDates = Object.keys(slots).map(dateStr =>
    parse(dateStr, 'yyyy-MM-dd', new Date())
  );

  const nextAvailableSlot = useMemo(() => {
    const nextInfo = findNextAvailableSlot(slots);
    if (!nextInfo) return null;

    return {
      ...nextInfo,
      date: parse(nextInfo.dateKey, 'yyyy-MM-dd', new Date()),
    };
  }, [slots]);

  const isDateAvailable = (date) => {
    return availableDates.some(availableDate => isSameDay(date, availableDate));
  };

  const handleDateSelect = (date) => {
    if (date && isDateAvailable(date)) {
      setAutoSelected(false);
      updateSelectedDate(date);
      setSelectedSlot(null); // Reset selected slot when date changes
    } else {
      setAutoSelected(false);
      updateSelectedDate(undefined);
      setSelectedSlot(null);
    }
  };

  const getTimeSlotsForDate = (date) => {
    if (!date) return [];
    const dateKey = format(startOfDay(date), 'yyyy-MM-dd');
    return slots[dateKey] || [];
  };

  const onSubmit = async (data) => {
    if (!phoneLocked) {
      toast.error('Сначала подтвердите телефон через Telegram (рекомендуется) или WhatsApp');
      try {
        const el = document.getElementById('phone-verify') || document.getElementById('tg-login');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (_) {}
      return;
    }
    if (!selectedSlot) {
      toast.error('Пожалуйста, выберите время консультации.');
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading('Создаем вашу запись...');

    try {
      const normalizedPhone = normalizePhoneForSubmit(data.phone || '');
      await api.post('/bookings', {
        name: data.name,
        phone: normalizedPhone,
        telegram: data.telegram,
        preferredContact: data.preferredContact,
        comment: data.comment,
        slotId: selectedSlot.id,
      });

      toast.success('Вы успешно записаны! Подтверждение отправлено в Telegram (если вы вошли). Ссылка на видеосессию придёт ближе к началу.', { id: toastId, duration: 8000 });
      reset();
      updateSelectedDate(undefined);
      setSelectedSlot(null);
      setAutoSelected(false);
      // Обновляем доступные слоты после успешного бронирования
      await fetchAndGroupSlots();
    } catch (error) {
      if (error?.response?.status === 401) {
        toast.error('Требуется подтверждение телефона: выберите Telegram или WhatsApp ниже', { id: toastId, duration: 6000 });
        const el = document.getElementById('phone-verify') || document.getElementById('tg-login');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (error?.response?.status === 403) {
        toast.error('Для бронирования подтвердите номер через Telegram или WhatsApp. В Telegram нажмите «Поделиться номером», затем «Войти».', { id: toastId, duration: 8000 });
        const el = document.getElementById('phone-verify') || document.getElementById('tg-login');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        const errorMessage = error.response?.data?.msg || 'Не удалось создать запись. Возможно, это время уже занято. Пожалуйста, обновите страницу и попробуйте снова.';
        toast.error(errorMessage, { id: toastId, duration: 6000 });
        console.error('Booking error:', error);
      }
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
    <>
    <div className="min-h-screen bg-brand-background flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-5xl mx-auto bg-white rounded-2xl shadow-lg border border-gray-200/60 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2">
          {/* -- START LEFT COLUMN -- */}
          <div className="p-6 sm:p-8 border-r border-gray-200/60">
            <h2 className="text-xl font-bold text-brand-text mb-1">Запись на консультацию</h2>
            <p className="text-brand-secondary mb-6 text-sm">1. Выберите удобную дату и время</p>
            {/* Кнопка открытия админского календаря удалена для публичной формы */}
            <DayPicker
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              locale={ru}
              fromDate={today}
              disabled={date => !isDateAvailable(date)}
              classNames={dayPickerClassNames}
            />

            {autoSelected && selectedSlot && selectedDate && (
              <div className="mt-6 px-4 py-3 rounded-xl border border-brand-accent/30 bg-brand-accent/10 flex items-start gap-3 shadow-sm">
                <FiCheckCircle className="w-5 h-5 text-brand-accent mt-0.5 animate-bounce" />
                <div className="text-left text-sm text-brand-secondary">
                  <p className="font-semibold text-brand-text">Мы подобрали ближайший свободный сеанс автоматически</p>
                  <p className="mt-1 text-xs text-brand-secondary/80 animate-pulse">Если время не подходит — выберите другой вариант в расписании.</p>
                  <div className="mt-2 text-sm font-medium text-brand-text">
                    {format(selectedDate, 'd MMMM', { locale: ru })}
                    <span className="mx-1 text-brand-secondary">·</span>
                    <TimeRangeDisplay
                      startTime={selectedSlot.slotTime}
                      endTime={selectedSlot.endTime}
                      isAdmin={false}
                      className="inline-flex flex-wrap items-center leading-tight"
                      clientTimezoneOverride={clientTimezone}
                    />
                  </div>
                </div>
              </div>
            )}

            {selectedDate && (
              <div className="mt-6 pt-6 border-t border-gray-200/60">
                <h3 className="text-base font-semibold text-brand-text mb-4">Доступное время на {format(selectedDate, 'd MMMM', { locale: ru })}:</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-4">
                  {getTimeSlotsForDate(selectedDate).length > 0 ? (
                    getTimeSlotsForDate(selectedDate).map((slot) => (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => {
                          if (selectedSlot?.id !== slot.id) {
                            setAutoSelected(false);
                          }
                          setSelectedSlot(slot);
                        }}
                        className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors duration-200 border ${
                          selectedSlot?.id === slot.id
                            ? 'bg-brand-accent text-white border-brand-accent shadow-lg ring-2 ring-brand-accent ring-offset-2 ring-offset-white'
                            : 'bg-white text-brand-text border-gray-300/80 hover:border-brand-accent hover:text-brand-accent'
                        }`}
                      >
                        <TimeRangeDisplay
                          startTime={slot.slotTime}
                          endTime={slot.endTime}
                          isAdmin={false}
                          className="inline-flex flex-col text-left"
                          clientTimezoneOverride={clientTimezone}
                        />
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
                <FiCalendar className="w-12 h-12 text-brand-accent/60 mb-4 animate-bounce" />
                {nextAvailableSlot ? (
                  <>
                    <p className="text-sm uppercase tracking-wide text-brand-secondary/70">Следующий доступный сеанс:</p>
                    <p className="mt-2 text-lg font-semibold text-brand-text">
                      {format(nextAvailableSlot.date, 'd MMMM', { locale: ru })}
                    </p>
                    <div className="mt-1 text-sm text-brand-secondary flex items-center justify-center gap-2">
                      <TimeRangeDisplay
                        startTime={nextAvailableSlot.slot.slotTime}
                        endTime={nextAvailableSlot.slot.endTime}
                        isAdmin={false}
                        className="inline-flex flex-wrap items-center leading-tight"
                        clientTimezoneOverride={clientTimezone}
                      />
                    </div>
                    <p className="mt-4 text-xs text-brand-secondary/80 animate-pulse">Мы автоматически подставим ближайший сеанс — подтвердите или выберите другое время.</p>
                  </>
                ) : (
                  <>
                    <p className="font-medium text-brand-secondary">Свободные сеансы скоро появятся</p>
                    <p className="text-sm text-brand-secondary/80 mt-1">Сейчас нет доступных записей — загляните позже.</p>
                  </>
                )}
              </div>
            )}
          </div>
          {/* -- END LEFT COLUMN -- */}

          {/* -- START RIGHT COLUMN -- */}
          <div className="p-6 sm:p-8 bg-gray-50/50 rounded-r-2xl">
            <h2 className="text-xl font-bold text-brand-text mb-1">Ваши данные</h2>
            <p className="text-brand-secondary mb-6 text-sm">2. Сначала подтвердите телефон в Telegram, затем заполните форму</p>
            {/* Telegram login block (отвечает за авто‑верификацию и мини‑аккаунт, UI не навязчивый) */}
            <TelegramLogin onLogin={handleTelegramLogin} forceModal={false} />
            
            {/* Client timezone selector */}
            <div className="mb-6">
              <ClientTimezoneSelector 
                selectedTimezone={clientTimezone}
                onTimezoneChange={handleClientTimezoneChange}
                showMoscowToggle={true}
              />
            </div>
            
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-brand-secondary mb-1.5">Телефон</label>
                <Controller
                  name="phone"
                  control={control}
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Cleave
                      value={value || ''}
                      options={{
                        phone: true,
                        phoneRegionCode: 'RU',
                      }}
                      onChange={(e) => {
                        let v = e.target.value || '';
                        if (v === '7' || v === '8' || v === '9') {
                          v = '+7 ' + (v === '9' ? '9' : '');
                        }
                        onChange(v);
                      }}
                      onBlur={onBlur}
                      disabled={phoneLocked}
                      className={`w-full px-4 py-2.5 ${phoneLocked ? 'bg-gray-100' : 'bg-white'} border border-gray-300/70 rounded-lg focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 transition-colors text-sm text-brand-text placeholder-gray-400`}
                      placeholder="+7 977 288-14-99"
                    />
                  )}
                />
                {phoneLocked && (
                  <p className="mt-1 text-xs text-green-700">Номер подтвержден через Telegram</p>
                )}
              </div>

              {/* Phone verification options (Telegram / WhatsApp) */}
              <PhoneVerificationSection phone={watch('phone')} phoneLocked={phoneLocked} />

              {/* Telegram username field (standalone). Visible when Telegram is selected or locked; when locked, it's disabled with a gray note. */}
              <TelegramUsernameField register={register} watch={watch} tgLocked={phoneLocked} />

              {phoneLocked && (
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
              )}

              {phoneLocked && (
                <div>
                  <label className="block text-xs font-medium text-brand-secondary mb-1.5">Комментарий</label>
                  <textarea
                    {...register('comment')}
                    rows="3"
                    className="w-full px-4 py-2.5 bg-white border border-gray-300/70 rounded-lg focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 transition-colors text-sm text-brand-text placeholder-gray-400"
                    placeholder="Ваш запрос или пожелания к консультации..."
                  />
                </div>
              )}

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedSlot || !phoneLocked}
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
                   <div className="mt-3 text-xs text-center text-brand-secondary">
                      <p>Вы записываетесь на <span className="font-semibold text-brand-text">{format(new Date(selectedSlot.slotTime), 'd MMMM yyyy', { locale: ru })}</span></p>
                      <div className="mt-2">
                        <TimeRangeDisplay 
                          startTime={selectedSlot.slotTime}
                          endTime={selectedSlot.endTime}
                          isAdmin={false}
                          className="text-center"
                          clientTimezoneOverride={clientTimezone}
                        />
                      </div>
                   </div>
                )}
              </div>
            </form>
          </div>
          {/* -- END RIGHT COLUMN -- */}
        </div>
      </div>
    </div>
    {/* CalendarModal удалён для исключения доступа к админскому календарю из публичной формы */}
    </>
  );
};

function TelegramUsernameField({ register, watch, tgLocked = false }) {
  const selected = watch('preferredContact');
  const [tgStatus, setTgStatus] = useState({ checking: false, ok: null, message: '' });

  const onTelegramBlur = async (e) => {
    if (!tgLocked && selected !== 'telegram') return;
    const username = (e.target.value || '').trim();
    if (!username) {
      setTgStatus({ checking: false, ok: null, message: '' });
      return;
    }
    const validBasic = /^@?\w{5,}$/.test(username);
    if (!validBasic) {
      setTgStatus({ checking: false, ok: false, message: 'Некорректный Telegram username' });
      return;
    }
    setTgStatus({ checking: true, ok: null, message: '' });
    try {
      await api.get('/telegram/username', { params: { username } });
      setTgStatus({ checking: false, ok: true, message: 'Пользователь найден' });
    } catch (err) {
      setTgStatus({ checking: false, ok: false, message: 'Пользователь не найден' });
    }
  };

  return (
    <div className={`${tgLocked || selected === 'telegram' ? 'opacity-100 max-h-[200px] mt-1' : 'opacity-0 max-h-0 overflow-hidden -mt-3'} transition-all duration-300`}>
      {(tgLocked || selected === 'telegram') && (
        <div className="mt-3">
          {/* Keep preferredContact in form values when locked */}
          {tgLocked && <input type="hidden" value="telegram" {...register('preferredContact')} />}
          <label className="block text-xs font-medium text-brand-secondary mb-1.5">{`Telegram username${tgLocked ? '' : ' *'}`}</label>
          <input
            type="text"
            {...register('telegram', {
              validate: (v) => {
                if (tgLocked) return true;
                if (watch('preferredContact') !== 'telegram') return true;
                return (!!v && /^@?\w{5,}$/.test(v)) || 'Укажите корректный Telegram username';
              }
            })}
            onBlur={onTelegramBlur}
            disabled={tgLocked}
            className={`w-full px-4 py-2.5 ${tgLocked ? 'bg-gray-100' : 'bg-white'} border border-gray-300/70 rounded-lg focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 transition-colors text-sm text-brand-text placeholder-gray-400`}
            placeholder="@username"
          />
          {tgStatus.message && (
            <p className={`mt-1 text-xs ${tgStatus.ok ? 'text-green-600' : 'text-brand-secondary'}`}>{tgStatus.message}</p>
          )}
          {tgLocked && (
            <p className="mt-1 text-xs text-brand-secondary">Telegram будет предпочтительным способом связи</p>
          )}
        </div>
      )}
    </div>
  );
}

export default BookingForm;

// Inline section that offers Telegram/WhatsApp verification after phone input
function PhoneVerificationSection({ phone, phoneLocked }) {
  const [botInfo, setBotInfo] = useState({ username: null, link: null });
  const [checkingWa, setCheckingWa] = useState(false);
  const hasValidRuPhone = isValidRuPhone(phone || '');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/telegram/bot');
        if (!cancelled && data && (data.username || data.link)) {
          setBotInfo({ username: data.username || null, link: data.link || (data.username ? `https://t.me/${data.username}` : null) });
          return;
        }
      } catch (_) {}
      const fallback = (process.env.REACT_APP_TELEGRAM_BOT_USERNAME || '').trim().replace(/^@/, '');
      if (!cancelled && fallback) setBotInfo({ username: fallback, link: `https://t.me/${fallback}` });
    })();
    return () => { cancelled = true; };
  }, []);

  const handleTelegramVerify = () => {
    const botUsername = botInfo.username || 'PsyForm_bot';
    const nonce = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    const url = `https://t.me/${botUsername}?start=login_${nonce}`;
    try { window.open(url, '_blank', 'noopener,noreferrer'); } catch (_) {}
  };

  const handleWhatsAppVerify = async () => {
    if (!hasValidRuPhone) {
      toast.error('Введите корректный российский номер');
      return;
    }
    const businessPhone = (process.env.REACT_APP_WHATSAPP_BUSINESS_PHONE || '').replace(/[^0-9]/g, '');
    if (!businessPhone) {
      toast.error('Канал WhatsApp пока не настроен (не указан номер бизнеса)');
      return;
    }
    setCheckingWa(true);
    try {
      const normalized = normalizePhoneForSubmit(phone || '');
      const { data } = await api.get('/whatsapp/check', { params: { phone: normalized } });
      const configured = !!data?.configured;
      const ok = !!data?.valid;
      const msg = 'Здравствуйте! Хочу подтвердить номер для записи на консультацию.';
      const waUrl = `https://wa.me/${businessPhone}?text=${encodeURIComponent(msg)}`;
      if (!configured) {
        toast('Проверка WhatsApp недоступна, откроем чат для ручного подтверждения');
        try { window.open(waUrl, '_blank', 'noopener,noreferrer'); } catch (_) {}
        return;
      }
      if (ok) {
        try { window.open(waUrl, '_blank', 'noopener,noreferrer'); } catch (_) {}
      } else {
        toast.error('Номер не найден в WhatsApp');
      }
    } catch (e) {
      toast.error('Не удалось выполнить проверку WhatsApp');
    } finally {
      setCheckingWa(false);
    }
  };

  return (
    <div id="phone-verify" className={`transition-all duration-300 ${(!phoneLocked) ? 'opacity-100 mt-2' : 'opacity-0 max-h-0 overflow-hidden -mt-3'}`}>
      {!phoneLocked && (
        <div className="mt-1">
          <label className="block text-xs font-medium text-brand-secondary mb-2">Подтвердите владение номером</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleTelegramVerify}
              className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold bg-[#0088cc] text-white hover:bg-[#0077b6] transition-colors border border-[#0088cc]"
            >
              ✈️ Подтвердить через Telegram
            </button>
            <button
              type="button"
              onClick={handleWhatsAppVerify}
              disabled={checkingWa || !hasValidRuPhone}
              className={`w-full px-4 py-2.5 rounded-lg text-sm font-semibold border transition-colors ${(!hasValidRuPhone)
                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                : 'bg-white text-[#128C7E] border-[#25D366] hover:bg-[#25D366]/10'}`}
            >
              {checkingWa ? 'Проверяем WhatsApp…' : 'Подтвердить через WhatsApp'}
            </button>
          </div>
          <p className="mt-2 text-xs text-brand-secondary">Рекомендуем Telegram — быстрый вход одной кнопкой через бота {botInfo?.username ? `@${botInfo.username}` : ''}.</p>
          {!hasValidRuPhone && (
            <p className="mt-1 text-[11px] text-brand-secondary">Для WhatsApp сначала введите корректный номер выше</p>
          )}
        </div>
      )}
    </div>
  );
}
