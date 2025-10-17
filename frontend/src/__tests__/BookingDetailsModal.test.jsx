import React from 'react';
import { render, screen } from '@testing-library/react';
import BookingDetailsModal from '../components/calendar/BookingDetailsModal';
import { I18nProvider } from '../locale/i18n';

jest.mock('../api', () => {
  const mock = {
    get: jest.fn(() => Promise.resolve({ data: {} })),
    post: jest.fn(() => Promise.resolve({ data: {} })),
    delete: jest.fn(() => Promise.resolve({ data: {} })),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  };
  return { __esModule: true, default: mock };
});

const renderWithI18n = (ui) => render(<I18nProvider locale="ru">{ui}</I18nProvider>);

describe('BookingDetailsModal - client time block', () => {
  test('renders client time when sourceTimezone differs from practitionerTimezone', () => {
    const booking = {
      id: 'b1',
      clientName: 'Иван',
      clientPhone: '+79990000000',
      telegramHandle: 'ivan',
      start: '2025-03-05T10:00:00.000Z',
      end: '2025-03-05T11:00:00.000Z',
      sourceTimezone: 'Asia/Bangkok',
      preferredContact: 'telegram'
    };

    renderWithI18n(
      <BookingDetailsModal
        booking={booking}
        practitionerTimezone="Europe/Moscow"
        onClose={() => {}}
        onReschedule={() => {}}
      />
    );

    expect(screen.getByText('Время:')).toBeInTheDocument();
    // Client time label
    expect(screen.getByText('Время клиента:')).toBeInTheDocument();
  });

  test('does not render client time when zones are equal', () => {
    const booking = {
      id: 'b1',
      clientName: 'Иван',
      start: '2025-03-05T10:00:00.000Z',
      end: '2025-03-05T11:00:00.000Z',
      sourceTimezone: 'Europe/Moscow',
    };

    renderWithI18n(
      <BookingDetailsModal
        booking={booking}
        practitionerTimezone="Europe/Moscow"
        onClose={() => {}}
      />
    );

    expect(screen.queryByText('Время клиента:')).not.toBeInTheDocument();
  });
});
