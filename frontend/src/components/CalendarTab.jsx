import React, { useEffect, useState } from 'react';
import {
  startOfWeek,
  addDays,
  format,
  startOfMonth,
  endOfMonth,
  endOfWeek,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
} from 'date-fns';
import ru from 'date-fns/locale/ru';
import api from '../api';
import '../styles/calendar.css';

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

const CalendarTab = () => {
  const [events, setEvents] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
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
    fetchBookings();
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
      days.push(
        <div
          className={`calendar__day ${!isSameMonth(day, monthStart) ? 'inactive' : ''} ${isSameDay(day, selectedDate) ? 'today' : ''}`}
          key={day}
          onClick={() => setSelectedDate(cloneDay)}
        >
          <span className="calendar__date">{formattedDate}</span>
          <span className={`calendar__task${isSameDay(day, selectedDate) ? ' calendar__task--today' : ''}`}>{dayEvents.length}</span>
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

  const eventsForSelectedDate = events
    .filter((e) => isSameDay(e.start, selectedDate))
    .sort((a, b) => a.start - b.start);

  return (
    <div className={`calendar-contain ${menuOpen ? 'menu-open' : ''}`}>
      <section className="title-bar">
        <button className="title-bar__burger" onClick={() => setMenuOpen(!menuOpen)}>
          <span className="burger__lines">Menu</span>
        </button>
        <span className="title-bar__year">
          {format(currentMonth, 'LLLL yyyy', { locale: ru })}
        </span>
        <span className="title-bar__month">Month</span>
        <div className="title-bar__controls">
          <div className="title-bar__minimize" onClick={nextMonth}></div>
          <div className="title-bar__maximize" onClick={prevMonth}></div>
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
      {menuOpen && (
        <div className="calendar-menu">
          {/* Placeholder for upcoming menu */}
        </div>
      )}
    </div>
  );
};

export default CalendarTab;
