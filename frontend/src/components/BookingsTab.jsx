import React, { useState, useEffect, useRef } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { FiCalendar, FiPhone, FiUser, FiInfo, FiLoader, FiAlertTriangle, FiCheck, FiX } from 'react-icons/fi';
import RescheduleModal from './RescheduleModal';
import { SiTelegram } from 'react-icons/si';

const StatusBadge = ({ status, clientConfirmation, onSendConfirmationRequest, bookingId }) => {
  const baseClasses = "px-3 py-1 text-xs font-semibold rounded-full inline-block";
  let specificClasses = "";
  let text = status;
  let isClickable = false;

  if (clientConfirmation === 'pending') {
    specificClasses = "bg-yellow-100 text-yellow-800 cursor-pointer hover:bg-yellow-200";
    text = 'Ожидает подтверждения';
    isClickable = true;
  } else if (clientConfirmation === 'confirmed') {
    specificClasses = "bg-green-100 text-green-800";
    text = 'Подтверждена';
  } else if (clientConfirmation === 'declined') {
    specificClasses = "bg-red-100 text-red-800";
    text = 'Отменена клиентом';
  }

  if (!clientConfirmation) {
    switch (status) {
      case 'confirmed':
        specificClasses = "bg-green-100 text-green-800";
        text = 'Подтверждена';
        break;
      case 'cancelled':
        specificClasses = "bg-red-100 text-red-800";
        text = 'Отменена';
        break;
      case 'completed':
        specificClasses = "bg-green-100 text-green-800";
        text = 'Завершена';
        break;
      default:
        specificClasses = "bg-yellow-100 text-yellow-800 cursor-pointer hover:bg-yellow-200";
        text = 'Ожидает подтверждения';
        isClickable = true;
        break;
    }
  }

  const handleClick = () => {
    if (isClickable && onSendConfirmationRequest) {
      onSendConfirmationRequest(bookingId);
    }
  };

  return (
    <span 
      className={`${baseClasses} ${specificClasses} ${isClickable ? 'transition-colors' : ''}`}
      onClick={handleClick}
      title={isClickable ? 'Нажмите, чтобы отправить запрос на подтверждение' : ''}
    >
      {text}
    </span>
  );
};

const BookingsTab = ({ practitionerTimezone = 'Europe/Moscow', focusId = null }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleBooking, setRescheduleBooking] = useState(null);
  const [highlightId, setHighlightId] = useState(null);
  const rowRefs = useRef({});
  // Telegram lookup is persisted on the server at booking creation

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        setLoading(true);
        const response = await api.get('/bookings');
        // The API returns a direct array of bookings, so response.data is the array itself.
        setBookings(response.data);
        setError(null);
      } catch (err) {
        setError('Ошибка загрузки записей');
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, []);

  // When bookings are loaded/updated and we have focusId -> scroll and highlight
  useEffect(() => {
    if (!focusId || !bookings || bookings.length === 0) return;
    const idStr = String(focusId);
    const found = bookings.find((b) => String(b.id) === idStr);
    if (!found) return;
    setHighlightId(found.id);
    // Scroll into view gently
    try {
      const el = rowRefs.current[found.id];
      if (el && el.scrollIntoView) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } catch (_) {}
    // Remove highlight after 2.5s
    const t = setTimeout(() => setHighlightId(null), 2500);
    return () => clearTimeout(t);
  }, [focusId, bookings]);

  // Removed hover-lookup and tooltip logic

  const handleSendConfirmationRequest = async (bookingId) => {
    try {
      await api.post(`/bookings/${bookingId}/send-confirmation`);
      toast.success('Запрос на подтверждение отправлен клиенту');
    } catch (error) {
      console.error('Error sending confirmation request:', error);
      
      const errorMsg = error?.response?.data?.msg
        || (error?.response?.status === 400 ? 'Не удалось отправить: клиент не найден или не связан с Telegram' : null)
        || 'Ошибка при отправке запроса на подтверждение';
      toast.error(errorMsg, { duration: 6000 });
    }
  };

  const handleDelete = async (booking) => {
    const name = booking.clientName || 'клиент';
    const ok = window.confirm(`Действительно удалить запись для клиента «${name}»?`);
    if (!ok) return;
    const id = toast.loading('Удаляем запись...');
    try {
      await api.delete(`/bookings/${booking.id}`);
      setBookings((prev) => prev.filter((b) => b.id !== booking.id));
      toast.success('Запись удалена', { id });
    } catch (e) {
      toast.error(e?.response?.data?.msg || 'Не удалось удалить запись', { id });
    }
  };

  const openReschedule = (booking) => {
    setRescheduleBooking(booking);
    setRescheduleOpen(true);
  };

  const handleRescheduled = (updated) => {
    setBookings((prev) => prev.map((b) => (b.id === updated.id ? { ...b, ...updated } : b)));
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="text-center py-16">
          <FiLoader className="mx-auto h-12 w-12 text-brand-accent animate-spin" />
          <h4 className="mt-4 text-lg font-medium text-brand-text">Загрузка записей...</h4>
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-16 border-2 border-dashed border-red-200 rounded-xl bg-red-50">
          <FiAlertTriangle className="mx-auto h-12 w-12 text-red-400" />
          <h4 className="mt-4 text-lg font-medium text-red-700">Произошла ошибка</h4>
          <p className="mt-1 text-sm text-red-600">{error}</p>
        </div>
      );
    }

    if (bookings.length === 0) {
      return (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
          <FiCalendar className="mx-auto h-12 w-12 text-gray-300" />
          <h4 className="mt-4 text-lg font-medium text-brand-text">Записей пока нет</h4>
          <p className="mt-1 text-sm text-brand-secondary">Когда клиенты начнут бронировать время, их записи появятся здесь.</p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200/70">
          <thead className="bg-gray-50/50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-brand-secondary uppercase tracking-wider"><FiUser className="inline-block mr-2 -mt-0.5" />Клиент</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-brand-secondary uppercase tracking-wider"><FiCalendar className="inline-block mr-2 -mt-0.5" />Дата и время</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-brand-secondary uppercase tracking-wider"><FiPhone className="inline-block mr-2 -mt-0.5" />Телефон</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-brand-secondary uppercase tracking-wider">Телеграм</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-brand-secondary uppercase tracking-wider"><FiInfo className="inline-block mr-2 -mt-0.5" />Статус</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200/70">
            {bookings.map((booking) => (
              <tr
                key={booking.id}
                ref={(el) => { rowRefs.current[booking.id] = el; }}
                className={`group transition-colors ${highlightId === booking.id ? 'ring-2 ring-brand-accent bg-brand-light-accent/20' : 'hover:bg-gray-50/70'}`}
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-brand-text">
                  <button
                    onClick={() => handleDelete(booking)}
                    title="Удалить запись"
                    className="inline-flex items-center justify-center mr-2 text-red-500 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <FiX className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openReschedule(booking)}
                    title="Перезаписать клиента"
                    className="inline-flex items-center justify-center mr-2 text-brand-accent hover:text-brand-accent/80 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <FiCalendar className="w-4 h-4" />
                  </button>
                  {booking.clientName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-brand-secondary">
                  {new Date(booking.slotTime).toLocaleString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-brand-secondary">
                  <div className="inline-flex items-center space-x-2">
                    <FiPhone className="w-4 h-4 text-gray-500" />
                    <span>{booking.clientPhone || '-'}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-brand-secondary">
                  {(() => {
                    const handle = (booking.telegramUsername || booking.clientTelegram || '').replace(/^@/, '');
                    if (booking.telegramFound && handle) {
                      return (
                        <span className="inline-flex items-center space-x-2">
                          <SiTelegram className="w-4 h-4 text-blue-500" />
                          <a
                            href={`https://t.me/${handle}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand-accent hover:underline"
                          >
                            @{handle}
                          </a>
                          <FiCheck className="w-4 h-4 text-green-500" />
                        </span>
                      );
                    }
                    if (handle) {
                      return (
                        <span className="inline-flex items-center space-x-2">
                          <SiTelegram className="w-4 h-4 text-gray-400" />
                          <a
                            href={`https://t.me/${handle}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand-accent hover:underline"
                          >
                            @{handle}
                          </a>
                        </span>
                      );
                    }
                    return '-';
                  })()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <StatusBadge 
                    status={booking.status} 
                    clientConfirmation={booking.clientConfirmation}
                    onSendConfirmationRequest={handleSendConfirmationRequest}
                    bookingId={booking.id}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200/60 p-6">
      <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-brand-text">Записи клиентов</h3>
      </div>
      <div>
        {renderContent()}
      </div>
      <RescheduleModal
        isOpen={rescheduleOpen}
        booking={rescheduleBooking}
        onClose={() => setRescheduleOpen(false)}
        onRescheduled={handleRescheduled}
      />
    </div>
  );
};

export default BookingsTab;