import React, { useState, useEffect } from 'react';
import api from '../api';
import { FiCalendar, FiPhone, FiUser, FiInfo, FiLoader, FiAlertTriangle } from 'react-icons/fi';

const StatusBadge = ({ status }) => {
  const baseClasses = "px-3 py-1 text-xs font-semibold rounded-full inline-block";
  let specificClasses = "";
  let text = status;

  switch (status) {
    case 'confirmed':
      specificClasses = "bg-green-100 text-green-800";
      text = 'Подтверждена';
      break;
    case 'cancelled':
      specificClasses = "bg-red-100 text-red-800";
      text = 'Отменена';
      break;
    default:
      specificClasses = "bg-yellow-100 text-yellow-800";
      break;
  }

  return <span className={`${baseClasses} ${specificClasses}`}>{text}</span>;
};

const BookingsTab = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        setLoading(true);
        const response = await api.get('/bookings');
        // The API returns a direct array of bookings, so response.data is the array itself.
        setBookings(response.data);
        setError(null);
      } catch (err) {
        setError('Не удалось загрузить записи. Попробуйте обновить страницу.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, []);

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
              <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-brand-secondary uppercase tracking-wider"><FiInfo className="inline-block mr-2 -mt-0.5" />Статус</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200/70">
            {bookings.map((booking) => (
              <tr key={booking.id} className="hover:bg-gray-50/70 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-brand-text">{booking.clientName}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-brand-secondary">
                  {new Date(booking.slotTime).toLocaleString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-brand-secondary">{booking.clientPhone}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <StatusBadge status={booking.status} />
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
    </div>
  );
};

export default BookingsTab;