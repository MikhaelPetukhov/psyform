import React, { useEffect, useState, useRef } from 'react';
import { FiChevronLeft, FiChevronRight, FiX } from 'react-icons/fi';
import {
  startOfWeek,
  addDays,
  format,
  startOfMonth,
  endOfMonth,
  endOfWeek,
  addMonths,
  subMonths,
  setMonth,
  isSameMonth,
  isSameDay,
} from 'date-fns';
import ru from 'date-fns/locale/ru';
import api from '../api';
import '../styles/calendar.css';

// Month names for the dropdown. Using a fixed year ensures correct locale formatting
const months = Array.from({ length: 12 }, (_, i) =>
  format(new Date(2025, i, 1), 'LLLL', { locale: ru })
);

const BookingDetailsModal = ({ booking, onClose }) => {
  if (!booking) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg w-80 shadow-lg">
        <h4 className="text-lg font-semibold mb-4">Детали записи</h4>
        <p className="text-sm mb-1"><strong>Клиент:</strong> {booking.clientName}</p>
        <p className="text-sm mb-1"><strong>Телефон:</strong> {booking.clientPhone || '—'}</p>
        <p className="text-sm mb-4"><strong>Время:</strong> {format(booking.start, 'dd.MM.yyyy HH:mm')}</p>
        <button
          onClick={onClose}
          className="mt-2 px-4 py-2 rounded-lg bg-brand-accent text-white text-sm font-medium"
        >
          Закрыть
        </button>
      </div>
    </div>
  );
};

const AddBookingModal = ({ slot, onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/bookings', {
        name,
        phone,
        slotId: slot.id,
      });
      onCreated();
      onClose();
    } catch (err) {
      console.error('Failed to create booking', err);
    }
  };

  if (!slot) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded-lg w-80 shadow-lg flex flex-col gap-3"
      >
        <h4 className="text-lg font-semibold mb-1">Записать клиента</h4>
        <p className="text-sm mb-2">
          {format(new Date(slot.slotTime), 'dd.MM.yyyy HH:mm')}
        </p>
        <input
          type="text"
          required
          placeholder="Имя"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
        />
        <input
          type="tel"
          required
          placeholder="Телефон"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
        />
        <div className="flex justify-end gap-2 mt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded text-sm bg-gray-100 hover:bg-gray-200"
          >
            Отмена
          </button>
          <button
            type="submit"
            className="px-3 py-1 rounded text-sm bg-brand-accent text-white"
          >
            Записать
          </button>
        </div>
      </form>
    </div>
  );
};

const CalendarTab = () => {
  const [events, setEvents] = useState([]);
  const [slots, setSlots] = useState([]);

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [slotModal, setSlotModal] = useState(null);
  const [monthOpen, setMonthOpen] = useState(false);
  const monthRef = useRef(null);

  const fetchBookings = async () => {
    try {
      const response = await api.get('/bookings');
      const bookings = response.data;
      const mapped = bookings.map((b) => ({
        id: b.id,
        title: b.clientName,
        start: new Date(b.slotTime),
        end: new Date(b.endTime),
        clientName: b.clientName,
        clientPhone: b.clientPhone,
      }));
      setEvents(mapped);
    } catch (err) {
      console.error('Failed to fetch bookings', err);
    }
  };

  const fetchSlots = async () => {
    try {
      const res = await api.get('/slots');
      const slotGroups = res.data || {};
      const all = [];
      Object.keys(slotGroups).forEach((dateKey) => {
        all.push(...slotGroups[dateKey]);
      });
      setSlots(all);
    } catch (err) {
      console.error('Failed to fetch slots', err);
    }
  };

  const refreshData = () => {
    fetchBookings();
    fetchSlots();
  };

  useEffect(() => {
    fetchBookings();
    fetchSlots();

  }, []);

  useEffect(() => {
    const handleClick = (e) => {
      if (monthRef.current && !monthRef.current.contains(e.target)) {
        setMonthOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const dateFormat = 'd';
  const weeks = [];
  let day = startDate;
  let formattedDate = '';

  while (day <= endDate) {
    const days = [];
    for (let i = 0; i < 7; i++) {
      formattedDate = format(day, dateFormat, { locale: ru });
      const cloneDay = day;
      const dayEvents = events.filter((e) => isSameDay(e.start, cloneDay));

      const daySlots = slots.filter((s) => isSameDay(new Date(s.slotTime), cloneDay));

      days.push(
        <div
          className={`calendar__day ${!isSameMonth(day, monthStart) ? 'inactive' : ''} ${isSameDay(day, selectedDate) ? 'today' : ''}`}
          key={day}
          onClick={() => setSelectedDate(cloneDay)}
        >
          <span className="calendar__date">{formattedDate}</span>

          <span className={`calendar__task${isSameDay(day, selectedDate) ? ' calendar__task--today' : ''}`}>{dayEvents.length}/{daySlots.length}</span>
        </div>
      );
      day = addDays(day, 1);
    }
    weeks.push(<section className="calendar__week" key={day}>{days}</section>);
  }

  const nextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const prevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleMonthSelect = (idx) => {
    setCurrentMonth(setMonth(currentMonth, idx));
    setMonthOpen(false);
  };

  const eventsForSelectedDate = events
    .filter((e) => isSameDay(e.start, selectedDate))
    .sort((a, b) => a.start - b.start);


  const slotsForSelectedDate = slots
    .filter((s) => isSameDay(new Date(s.slotTime), selectedDate))
    .sort((a, b) => new Date(a.slotTime) - new Date(b.slotTime));

  return (

    <div className={`calendar-contain ${menuOpen ? 'menu-open' : ''}`}>
      <section className="title-bar">
        <button className="title-bar__burger" onClick={() => setMenuOpen(!menuOpen)}>
          <span className="burger__lines">Menu</span>
        </button>
        <span className="title-bar__year">
          {format(currentMonth, 'yyyy', { locale: ru })}
        </span>
        <span className="title-bar__month" ref={monthRef}>
          <button
            type="button"
            className="title-bar__month-button"
            onClick={() => setMonthOpen((o) => !o)}
          >
            {format(currentMonth, 'LLLL', { locale: ru })}
          </button>
          <ul className={`month-dropdown ${monthOpen ? 'open' : ''}`}>
            {months.map((m, idx) => (
              <li key={m} onClick={() => handleMonthSelect(idx)}>
                {m}
              </li>
            ))}
          </ul>
        </span>
        <div className="title-bar__controls">
          <button
            className="title-bar__minimize"
            onClick={prevMonth}
            aria-label="Предыдущий месяц"
          >
            <FiChevronLeft />
          </button>
          <button
            className="title-bar__maximize"
            onClick={nextMonth}
            aria-label="Следующий месяц"
          >
            <FiChevronRight />
          </button>
          <div className="title-bar__close"></div>
        </div>
      </section>

      <aside className="calendar__sidebar">
        <h2 className="sidebar__heading">
          {format(selectedDate, 'EEEE', { locale: ru })}
          <br />
          {format(selectedDate, 'd MMMM', { locale: ru })}
        </h2>
        <ul className="sidebar__list">
          {eventsForSelectedDate.length === 0 && (
            <li className="sidebar__list-item">Записей нет</li>
          )}
          {eventsForSelectedDate.map((evt) => (
            <li
              key={evt.id}
              className="sidebar__list-item"
              onClick={() => setSelectedEvent(evt)}
            >
              <span className="list-item__time">{format(evt.start, 'HH:mm')}</span>
              {evt.title}
            </li>
          ))}
        </ul>
        {slotsForSelectedDate.length > 0 && (
          <>
            <h3 className="sidebar__heading text-xl mt-6">Свободные слоты</h3>
            <ul className="sidebar__list">
              {slotsForSelectedDate.map((slot) => (
                <li
                  key={slot.id}
                  className="sidebar__list-item cursor-pointer text-brand-accent"
                  onClick={() => setSlotModal(slot)}
                >
                  <span className="list-item__time">{format(slot.slotTime, 'HH:mm')}</span>
                  Добавить запись
                </li>
              ))}
            </ul>
          </>
        )}

      </aside>

      <section className="calendar__days">
        <section className="calendar__top-bar">
          {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => (
            <span key={d} className="top-bar__days">
              {d}
            </span>
          ))}
        </section>
        {weeks}
      </section>

      <BookingDetailsModal booking={selectedEvent} onClose={() => setSelectedEvent(null)} />

      <AddBookingModal
        slot={slotModal}
        onClose={() => setSlotModal(null)}
        onCreated={refreshData}
      />

      <div
        className="menu-backdrop"
        onClick={() => setMenuOpen(false)}
      ></div>
      <div className="calendar-menu">
        <button
          className="menu-close"
          onClick={() => setMenuOpen(false)}
          aria-label="Close menu"
        >
          <FiX />
        </button>
        {/* Placeholder for upcoming menu */}
      </div>
    </div>
  );
};

export default CalendarTab;

