import React, { useMemo, useState } from 'react';
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { FiChevronLeft, FiChevronRight, FiPlus } from 'react-icons/fi';

import { getBookingStatusClass } from '../../utils/bookingStatus';
import ContactIcon from './ContactIcon';
import { SimpleTimeDisplay } from '../TimezoneDisplay';
import { useI18n } from '../../locale/i18n';

const CalendarView = ({
  currentMonth,
  viewMode,
  selectedDate,
  events,
  slots,
  eventsForSelectedDate,
  slotsForSelectedDate,
  gridLoading,
  practitionerTimezone,
  onCurrentMonthChange,
  onViewModeChange,
  onDateSelect,
  onCreateSlot,
  onEventSelect,
}) => {
  const { t } = useI18n();
  const [hoveredDate, setHoveredDate] = useState(null);

  const monthMatrix = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const weeks = [];
    let day = startDate;

    while (day <= endDate) {
      const days = [];
      for (let i = 0; i < 7; i += 1) {
        const cloneDay = day;
        const dayEvents = events.filter((event) => isSameDay(event.start, cloneDay));
        const daySlots = slots.filter((slot) => isSameDay(new Date(slot.slotTime), cloneDay));
        days.push({
          date: cloneDay,
          label: format(cloneDay, 'd', { locale: ru }),
          inMonth: isSameMonth(cloneDay, monthStart),
          isSelected: isSameDay(cloneDay, selectedDate),
          isToday: isSameDay(cloneDay, new Date()),
          eventsCount: dayEvents.length,
          slotsCount: daySlots.length,
        });
        day = addDays(day, 1);
      }
      weeks.push(days);
    }

    return weeks;
  }, [currentMonth, events, slots, selectedDate]);

  const weekDays = useMemo(() => {
    const weekStart = startOfWeek(currentMonth, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  }, [currentMonth]);

  const dowShort = useMemo(() => {
    const arr = t('schedule.dowShort');
    return Array.isArray(arr) ? arr : ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  }, [t]);

  const handleNext = () => {
    if (viewMode === 'month') {
      onCurrentMonthChange(addMonths(currentMonth, 1));
    } else if (viewMode === 'week') {
      onCurrentMonthChange(addDays(currentMonth, 7));
    } else {
      onCurrentMonthChange(addDays(currentMonth, 1));
    }
  };

  const handlePrev = () => {
    if (viewMode === 'month') {
      onCurrentMonthChange(subMonths(currentMonth, 1));
    } else if (viewMode === 'week') {
      onCurrentMonthChange(addDays(currentMonth, -7));
    } else {
      onCurrentMonthChange(addDays(currentMonth, -1));
    }
  };

  const handleGoToday = () => {
    const today = new Date();
    onCurrentMonthChange(today);
    onDateSelect(today);
  };

  const handleViewChange = (mode) => {
    onViewModeChange(mode);
    onCurrentMonthChange(selectedDate);
  };

  const renderMonthView = () => (
    <div className="space-y-1.5">
      {monthMatrix.map((week, weekIndex) => (
        <div key={weekIndex} className="grid grid-cols-7 gap-1.5">
          {week.map((dayInfo) => (
            <div
              key={dayInfo.date.toISOString()}
              onClick={() => onDateSelect(new Date(dayInfo.date))}
              onMouseEnter={() => setHoveredDate(dayInfo.date)}
              onMouseLeave={() => setHoveredDate(null)}
              className={`relative group rounded-xl border bg-white shadow-sm hover:shadow-md transition p-2 h-28 ${
                dayInfo.inMonth ? '' : 'opacity-50'
              } ${
                dayInfo.isSelected
                  ? 'ring-2 ring-gray-900'
                  : dayInfo.isToday
                  ? 'ring-2 ring-red-500/60'
                  : ''
              } ${gridLoading ? 'animate-pulse' : ''}`}
            >
              <span className="absolute top-2 right-2 text-base text-gray-700">{dayInfo.label}</span>
              {(dayInfo.eventsCount > 0 || dayInfo.slotsCount > 0) && (
                <div className="absolute bottom-2 left-2 text-xs text-gray-600 font-mono">
                  {dayInfo.eventsCount}/{dayInfo.slotsCount}
                </div>
              )}
              {hoveredDate && isSameDay(hoveredDate, dayInfo.date) && dayInfo.inMonth && (
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onCreateSlot(dayInfo.date);
                  }}
                  className="absolute bottom-2 right-2 w-7 h-7 bg-gray-900 hover:bg-black text-white rounded-full flex items-center justify-center text-xs"
                  title={t('calendarView.createSlotTitle')}
                >
                  <FiPlus />
                </button>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );

  const renderWeekView = () => (
    <section className="calendar__week" key="week">
      {weekDays.map((day) => {
        const dayEvents = events
          .filter((event) => isSameDay(event.start, day))
          .sort((a, b) => a.start - b.start);
        const daySlots = slots
          .filter((slot) => isSameDay(new Date(slot.slotTime), day))
          .sort((a, b) => new Date(a.slotTime) - new Date(b.slotTime));

        return (
          <div
            className={`calendar__day ${isSameDay(day, selectedDate) ? 'today' : ''}`}
            key={day.toISOString()}
            onClick={() => onDateSelect(day)}
          >
            <span className="calendar__date">{format(day, 'd', { locale: ru })}</span>
            <span
              aria-hidden="true"
              className={`calendar__task${
                isSameDay(day, selectedDate) ? ' calendar__task--today' : ''
              }${dayEvents.length || daySlots.length ? '' : ' calendar__task--empty'}`}
            >
              {dayEvents.length}/{daySlots.length}
            </span>
            <ul className="sidebar__list">
              {dayEvents.map((event) => (
                <li
                  key={event.id}
                  className={`sidebar__list-item cursor-pointer ${getBookingStatusClass(
                    event.status,
                    event.clientConfirmation,
                  )} contact-${event.preferredContact || 'phone'}`}
                  onClick={(eventClick) => {
                    eventClick.stopPropagation();
                    onEventSelect(event);
                  }}
                >
                  <SimpleTimeDisplay
                    utcTime={event.start}
                    isAdmin={true}
                    practitionerTimezone={practitionerTimezone}
                    className="list-item__time inline"
                  />
                  <ContactIcon method={event.preferredContact} />
                  <span className="list-item__title">{event.title}</span>
                </li>
              ))}
              {dayEvents.length === 0 && (
                <li className="sidebar__list-item text-gray-500">{t('calendarView.noEntries')}</li>
              )}
            </ul>
          </div>
        );
      })}
    </section>
  );

  const renderDayView = () => (
    <section className="calendar__week" key="day">
      <div className="calendar__day today">
        <span className="calendar__date">{format(selectedDate, 'd', { locale: ru })}</span>
        <span
          aria-hidden="true"
          className={`calendar__task calendar__task--today${
            eventsForSelectedDate.length || slotsForSelectedDate.length ? '' : ' calendar__task--empty'
          }`}
        >
          {eventsForSelectedDate.length}/{slotsForSelectedDate.length}
        </span>
        <ul className="sidebar__list">
          {eventsForSelectedDate.map((event) => (
            <li
              key={event.id}
              className={`sidebar__list-item cursor-pointer ${getBookingStatusClass(
                event.status,
                event.clientConfirmation,
              )} contact-${event.preferredContact || 'phone'}`}
              onClick={() => onEventSelect(event)}
            >
              <SimpleTimeDisplay
                utcTime={event.start}
                isAdmin={true}
                practitionerTimezone={practitionerTimezone}
                className="list-item__time inline"
              />
              <ContactIcon method={event.preferredContact} />
              <span className="list-item__title">{event.title}</span>
            </li>
          ))}
          {eventsForSelectedDate.length === 0 && (
            <li className="sidebar__list-item text-gray-500">{t('calendarView.noEntriesToday')}</li>
          )}
        </ul>
      </div>
    </section>
  );

  return (
    <section className="rounded-lg bg-gray-50 border p-4 min-h-[540px]">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrev}
            aria-label={t('calendarView.prev')}
            className="w-8 h-8 flex items-center justify-center rounded-full border hover:bg-gray-50"
          >
            <FiChevronLeft />
          </button>
          <div className="text-lg font-medium">{format(currentMonth, 'LLLL yyyy', { locale: ru })}</div>
          <button
            onClick={handleNext}
            aria-label={t('calendarView.next')}
            className="w-8 h-8 flex items-center justify-center rounded-full border hover:bg-gray-50"
          >
            <FiChevronRight />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleGoToday}
            type="button"
            className="px-3 py-1 rounded-full text-sm border bg-white hover:bg-gray-50"
          >
            {t('calendarView.today')}
          </button>
          <div className="inline-flex bg-gray-100 rounded-full p-1">
            <button
              type="button"
              onClick={() => handleViewChange('month')}
              className={`px-3 py-1 rounded-full text-sm ${viewMode === 'month' ? 'bg-gray-900 text-white' : 'text-gray-700'}`}
            >
              {t('calendarView.month')}
            </button>
            <button
              type="button"
              onClick={() => handleViewChange('week')}
              className={`px-3 py-1 rounded-full text-sm ${viewMode === 'week' ? 'bg-gray-900 text-white' : 'text-gray-700'}`}
            >
              {t('calendarView.week')}
            </button>
            <button
              type="button"
              onClick={() => handleViewChange('day')}
              className={`px-3 py-1 rounded-full text-sm ${viewMode === 'day' ? 'bg-gray-900 text-white' : 'text-gray-700'}`}
            >
              {t('calendarView.day')}
            </button>
          </div>
        </div>
      </div>
      {viewMode !== 'day' && (
        <div className="grid grid-cols-7 text-xs text-gray-500 mb-2">
          {dowShort.map((dayLabel) => (
            <div key={dayLabel} className="text-center">
              {dayLabel}
            </div>
          ))}
        </div>
      )}

      {viewMode === 'month' ? renderMonthView() : viewMode === 'week' ? renderWeekView() : renderDayView()}
    </section>
  );
};

export default CalendarView;
