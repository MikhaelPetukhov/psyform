jest.mock('../../api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  },
}));

const { buildGoogleCalendarUrl } = require('../CalendarTab');

describe('buildGoogleCalendarUrl', () => {
  const booking = {
    start: '2024-05-10T10:00:00Z',
    end: '2024-05-10T11:00:00Z',
    clientName: 'Иван Иванов',
    clientPhone: '+79995552211',
  };

  it('включает таймзону психолога в ссылку Google Calendar', () => {
    const url = buildGoogleCalendarUrl(booking, 'Asia/Almaty');
    expect(url).toContain('ctz=Asia%2FAlmaty');
    expect(url).toContain('dates=20240510T100000Z/20240510T110000Z');
  });

  it('использует Europe/Moscow по умолчанию при отсутствии таймзоны', () => {
    const url = buildGoogleCalendarUrl(booking);
    expect(url).toContain('ctz=Europe%2FMoscow');
  });
});
