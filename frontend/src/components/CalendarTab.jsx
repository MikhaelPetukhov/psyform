import React, { useEffect, useMemo, useState } from 'react';
import { FiLogOut, FiSettings, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { isSameDay } from 'date-fns';

import ScheduleSettingsTab from './ScheduleSettingsTab';
import RescheduleModal from './RescheduleModal';
import CalendarHeader from './calendar/CalendarHeader';
import CalendarSidebar from './calendar/CalendarSidebar';
import CalendarView from './calendar/CalendarView';
import BookingDetailsModal from './calendar/BookingDetailsModal';
import AddBookingModal from './calendar/AddBookingModal';
import ManualBookingModal from './calendar/ManualBookingModal';
import CreateSlotModal from './calendar/CreateSlotModal';
import { useCalendarData } from '../hooks/useCalendarData';
import { useNowInTimezone } from '../hooks/useNowInTimezone';
import { deleteSlot } from '../api/calendar';
import '../styles/calendar.css';

const CalendarTab = ({ practitionerTimezone = 'Europe/Moscow' }) => {
  const { events, slots, loadingBookings, loadingSlots, refreshData } = useCalendarData();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('month');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [slotModal, setSlotModal] = useState(null);
  const [manualOpen, setManualOpen] = useState(null);
  const [createSlotOpen, setCreateSlotOpen] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(null);
  const [gridLoading, setGridLoading] = useState(false);

  const { nowStr, zoneLabel } = useNowInTimezone(practitionerTimezone);

  const handleGoToday = () => {
    const today = new Date();
    setSelectedDate(today);
    setCurrentMonth(today);
  };

  useEffect(() => {
    setGridLoading(true);
    const timer = setTimeout(() => setGridLoading(false), 250);
    return () => clearTimeout(timer);
  }, [currentMonth, viewMode]);

  const eventsForSelectedDate = useMemo(
    () =>
      events
        .filter((event) => isSameDay(event.start, selectedDate))
        .sort((a, b) => a.start - b.start),
    [events, selectedDate]
  );

  const slotsForSelectedDate = useMemo(
    () =>
      slots
        .filter((slot) => isSameDay(new Date(slot.slotTime), selectedDate))
        .sort((a, b) => new Date(a.slotTime) - new Date(b.slotTime)),
    [slots, selectedDate]
  );

  const handleSlotDelete = async (slot) => {
    if (!window.confirm('Удалить этот слот?')) return;

    try {
      await deleteSlot(slot.id);
      refreshData();
      toast.success('Слот удален');
    } catch (error) {
      const message = error?.response?.data?.msg || 'Ошибка удаления слота';
      toast.error(message);
    }
  };

  const openSettings = () => {
    setMenuOpen(false);
    setSettingsOpen(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    window.location.href = '/psychologist';
  };

  return (
    <div className={`w-full ${menuOpen ? 'menu-open' : ''}`}>
      <CalendarHeader
        nowStr={nowStr}
        zoneLabel={zoneLabel}
        onTimezoneClick={() => toast('Выбор часового пояса появится скоро')}
      />

      <div className="max-w-[1200px] mx-auto px-4">
        <div className="rounded-2xl bg-white shadow-sm border p-6">
          <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
            <CalendarSidebar
              selectedDate={selectedDate}
              events={eventsForSelectedDate}
              slots={slotsForSelectedDate}
              loadingBookings={loadingBookings}
              loadingSlots={loadingSlots}
              onCreateSlot={(date) => setCreateSlotOpen(date)}
              onManualBooking={(date) => setManualOpen(date)}
              onEventSelect={setSelectedEvent}
              onSlotSelect={setSlotModal}
              onSlotDelete={handleSlotDelete}
            />
            <CalendarView
              currentMonth={currentMonth}
              viewMode={viewMode}
              selectedDate={selectedDate}
              events={events}
              slots={slots}
              eventsForSelectedDate={eventsForSelectedDate}
              slotsForSelectedDate={slotsForSelectedDate}
              gridLoading={gridLoading}
              onCurrentMonthChange={setCurrentMonth}
              onViewModeChange={setViewMode}
              onDateSelect={setSelectedDate}
              onCreateSlot={(date) => setCreateSlotOpen(date)}
              onEventSelect={setSelectedEvent}
            />
          </div>
        </div>
      </div>

      <BookingDetailsModal
        booking={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        practitionerTimezone={practitionerTimezone}
        onUpdated={refreshData}
        onReschedule={(booking) => setRescheduleOpen(booking)}
      />

      <AddBookingModal
        slot={slotModal}
        onClose={() => setSlotModal(null)}
        onCreated={refreshData}
        practitionerTimezone={practitionerTimezone}
      />

      {manualOpen && (
        <ManualBookingModal
          defaultDate={manualOpen}
          onClose={() => setManualOpen(null)}
          onCreated={refreshData}
          practitionerTimezone={practitionerTimezone}
        />
      )}

      {createSlotOpen && (
        <CreateSlotModal
          defaultDate={createSlotOpen}
          onClose={() => setCreateSlotOpen(null)}
          onCreated={refreshData}
          existingBookings={events}
          practitionerTimezone={practitionerTimezone}
        />
      )}

      {settingsOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center" style={{ zIndex: 70 }}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] overflow-auto relative">
            <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b bg-white">
              <h3 className="text-lg font-semibold">Настройки расписания</h3>
              <div className="flex gap-2">
                <button type="button" className="px-3 py-1 text-sm border rounded" onClick={handleGoToday}>
                  Сегодня
                </button>
                <button
                  type="button"
                  className="px-3 py-1 text-sm rounded bg-gray-100 hover:bg-gray-200"
                  onClick={() => setSettingsOpen(false)}
                >
                  Закрыть
                </button>
              </div>
            </div>
            <div className="p-4">
              <ScheduleSettingsTab />
            </div>
          </div>
        </div>
      )}

      <RescheduleModal
        isOpen={!!rescheduleOpen}
        booking={rescheduleOpen}
        onClose={() => setRescheduleOpen(null)}
        onRescheduled={refreshData}
      />

      <div className="menu-backdrop" onClick={() => setMenuOpen(false)}></div>
      <div className="calendar-menu">
        <button className="menu-close" onClick={() => setMenuOpen(false)} aria-label="Close menu">
          <FiX />
        </button>
        <div className="h-full flex flex-col justify-between">
          <div className="p-4"></div>
          <div className="p-4">
            <button
              className="w-full flex items-center gap-2 px-3 py-2 rounded border bg-white hover:bg-gray-100"
              onClick={openSettings}
              type="button"
            >
              <FiSettings />
              <span>Настройки</span>
            </button>
            <button
              className="mt-2 w-full flex items-center gap-2 px-3 py-2 rounded border border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
              onClick={handleLogout}
              type="button"
            >
              <FiLogOut />
              <span>Выйти из профиля</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarTab;
