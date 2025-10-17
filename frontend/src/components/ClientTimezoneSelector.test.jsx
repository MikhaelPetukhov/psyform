import React, { useCallback, useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ClientTimezoneSelector from './ClientTimezoneSelector';
import { getTimezoneOffsetInfo } from '../utils/russianCities';

jest.mock('../utils/russianCities', () => {
  const actual = jest.requireActual('../utils/russianCities');
  return {
    ...actual,
    detectClosestRussianCity: jest.fn(() => actual.TOP_CITIES[0])
  };
});

const getUtcLabel = (timezone) => {
  const { formattedOffset } = getTimezoneOffsetInfo(timezone);
  if (formattedOffset) {
    return formattedOffset;
  }

  const parts = new Intl.DateTimeFormat('ru-RU', { timeZone: timezone, timeZoneName: 'short' }).formatToParts(new Date());
  const name = parts.find(part => part.type === 'timeZoneName')?.value || '';
  return name.replace('GMT', 'UTC');
};

const getTimeString = (timezone) => new Date().toLocaleTimeString('ru-RU', { timeZone: timezone, hour12: false });

describe('ClientTimezoneSelector', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const renderWithState = () => {
    const changeLog = [];

    const Wrapper = () => {
      const [timezone, setTimezone] = useState('America/New_York');

      const handleTimezoneChange = useCallback((newTimezone) => {
        changeLog.push(newTimezone);
        setTimezone(newTimezone);
      }, []);

      return (
        <ClientTimezoneSelector
          selectedTimezone={timezone}
          onTimezoneChange={handleTimezoneChange}
        />
      );
    };

    render(<Wrapper />);
    return { changeLog };
  };

  test('displays non-catalog timezone and restores it after toggling Moscow time', async () => {
    const { changeLog } = renderWithState();

    const baseLabel = await screen.findByText('New York (UTC−05:00)');
    const timezoneButton = baseLabel.closest('button');
    expect(timezoneButton).toBeTruthy();

    const baseOffset = getUtcLabel('America/New_York');
    const baseTime = getTimeString('America/New_York');

    expect(within(timezoneButton).getByText((content) => content.startsWith(baseOffset))).toBeInTheDocument();
    expect(within(timezoneButton).getByText((content) => content.includes(baseTime))).toBeInTheDocument();
    expect(changeLog).toEqual([]);

    const toggle = screen.getByLabelText('Показать время по Москве');
    await userEvent.click(toggle);

    expect(changeLog).toEqual(['Europe/Moscow']);

    const moscowOffset = getUtcLabel('Europe/Moscow');
    const moscowTime = getTimeString('Europe/Moscow');

    expect(within(timezoneButton).getByText((content) => content.startsWith(moscowOffset))).toBeInTheDocument();
    expect(within(timezoneButton).getByText((content) => content.includes(moscowTime))).toBeInTheDocument();

    await userEvent.click(toggle);

    expect(changeLog).toEqual(['Europe/Moscow', 'America/New_York']);
    expect(within(timezoneButton).getByText('New York (UTC−05:00)')).toBeInTheDocument();
    expect(within(timezoneButton).getByText((content) => content.startsWith(baseOffset))).toBeInTheDocument();
    expect(within(timezoneButton).getByText((content) => content.includes(baseTime))).toBeInTheDocument();
  });
});
