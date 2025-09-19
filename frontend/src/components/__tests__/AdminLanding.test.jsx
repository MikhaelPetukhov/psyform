import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminLanding from '../../components/AdminLanding';

jest.mock('../../api', () => ({
  get: jest.fn((url) => {
    if (url === '/auth/admin/me') {
      // Not authorized – show landing
      return Promise.reject({ response: { status: 401 } });
    }
    if (url === '/telegram/bot') {
      return Promise.resolve({ data: { username: 'test_bot', link: 'https://t.me/test_bot' } });
    }
    return Promise.resolve({ data: {} });
  }),
  post: jest.fn(() => Promise.resolve({ data: {} })),
}));

describe('AdminLanding UI', () => {
  test('shows only Telegram login button and no manual code input', async () => {
    render(
      <MemoryRouter>
        <AdminLanding />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Кабинет специалиста/i)).toBeInTheDocument();
    });

    // Telegram button exists
    expect(screen.getByText(/Войти как администратор через Telegram/i)).toBeInTheDocument();

    // Ensure manual code entry is removed
    expect(screen.queryByPlaceholderText(/Код из Telegram/i)).toBeNull();

    // Ensure fallback link to /psychologist/login is absent
    expect(screen.queryByText(/psychologist\/login/i)).toBeNull();
  });
});
