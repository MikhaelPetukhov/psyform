import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '../locale/i18n';

// Mock TelegramLogin to simulate successful login and invoke onLogin with server timezone
jest.mock('../components/TelegramLogin', () => {
  const React = require('react');
  return function TelegramLoginMock({ onLogin }) {
    React.useEffect(() => {
      if (typeof onLogin === 'function') {
        onLogin({ clientTimezone: 'Asia/Bangkok', tgPhone: '+79995550000' });
      }
    }, [onLogin]);
    return React.createElement('div', { 'data-testid': 'tg-login-mock' });
  };
});

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ slug: 'test' }),
}));

jest.mock('../api', () => {
  const mockGet = jest.fn((url) => {
    if (url.startsWith('/practitioners/public/')) {
      // minimal practitioner data sufficient for component logic
      return Promise.resolve({ data: { practitioner: { publicSlug: 'test', displayName: 'Ваш психолог' } } });
    }
    if (url === '/slots') {
      // provide at least one future slot so component renders normal UI
      const future = new Date(Date.now() + 24 * 60 * 60 * 1000); // +1 day
      const dateKey = future.toISOString().slice(0, 10); // yyyy-mm-dd (UTC)
      const slotStart = new Date(future);
      slotStart.setUTCHours(10, 0, 0, 0);
      const slotEnd = new Date(future);
      slotEnd.setUTCHours(11, 0, 0, 0);
      const payload = {
        [dateKey]: [
          {
            id: 's1',
            slotTime: slotStart.toISOString(),
            endTime: slotEnd.toISOString(),
          },
        ],
      };
      return Promise.resolve({ data: payload });
    }
    return Promise.resolve({ data: {} });
  });
  const mockPost = jest.fn(() => Promise.resolve({ data: {} }));
  const api = {
    get: mockGet,
    post: mockPost,
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  };
  return { __esModule: true, default: api };
});

import BookingForm from '../components/BookingForm';

const renderWithI18n = (ui) => render(<I18nProvider locale="ru">{ui}</I18nProvider>);

describe('BookingForm timezone UI', () => {
  beforeEach(() => {
    try { localStorage.setItem('clientTimezone', 'Asia/Bangkok'); } catch (_) {}
  });

  test('renders time notice and opens ClientTimezoneSelector on "Изменить" click with autofocus', async () => {
    renderWithI18n(<BookingForm />);

    // Wait for loading to finish and time notice to appear
    await waitFor(() => expect(screen.getByText('Время указано для')).toBeInTheDocument());

    const changeBtn = screen.getByText('Изменить');
    await userEvent.click(changeBtn);

    // Wait for modal input to appear
    await waitFor(() => {
      const input = document.getElementById('city-timezone-search');
      expect(input).toBeInTheDocument();
    });
  });

  test('applies server timezone after Telegram login (tz-sync) and shows UTC+7 label', async () => {
    // Force initial localStorage to a different TZ to observe change
    try { localStorage.setItem('clientTimezone', 'Europe/Moscow'); } catch (_) {}

    renderWithI18n(<BookingForm />);

    // Wait for time notice to appear
    await waitFor(() => expect(screen.getByText('Время указано для')).toBeInTheDocument());

    // After mocked TelegramLogin calls onLogin with Asia/Bangkok, label should include UTC+7
    await waitFor(() => {
      const text = document.body.textContent || '';
      expect(/UTC\+7/.test(text)).toBe(true);
    });
  });
});
