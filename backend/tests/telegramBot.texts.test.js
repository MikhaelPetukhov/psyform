jest.mock('../models', () => {
  return {
    Client: { findByPk: jest.fn() },
    Practitioner: { findByPk: jest.fn() },
    TgAuthCode: { findOne: jest.fn(), create: jest.fn() },
    Booking: { findByPk: jest.fn() },
  };
});

const { Client, Practitioner } = require('../models');
const {
  notifyBookingCreated,
  sendRescheduleNotification,
  __setTestBot,
} = require('../services/telegramBot');

function makeFakeBot() {
  return {
    telegram: {
      sendMessage: jest.fn().mockResolvedValue(true),
    },
  };
}

let fakeBot;
beforeEach(() => {
  jest.clearAllMocks();
  fakeBot = makeFakeBot();
  __setTestBot(fakeBot);
});

describe('telegramBot texts with timezones', () => {
  test('notifyBookingCreated includes tz label with IANA and UTC', async () => {
    // Arrange
    const client = { id: 'c1', tgChatId: '123', firstName: 'Иван' };
    Client.findByPk.mockResolvedValue(client);
    Practitioner.findByPk.mockResolvedValue({ id: 'p1', displayName: 'Доктор' });

    const booking = {
      id: 'b1',
      clientId: 'c1',
      practitionerId: 'p1',
      slotTime: '2025-03-05T10:00:00.000Z',
      endTime: '2025-03-05T11:00:00.000Z',
      sourceTimezone: 'Asia/Bangkok',
    };

    // Act
    const ok = await notifyBookingCreated(booking);

    // Assert
    expect(ok).toBe(true);
    const sent = fakeBot.telegram.sendMessage.mock.calls[0][1];
    expect(sent).toMatch(/\(Asia\/Bangkok, UTC\+7\)/);
  });

  test('sendRescheduleNotification formats old/new time with tz label', async () => {
    const booking = {
      id: 'b2',
      clientName: 'Анна',
      client: { tgChatId: '321', clientTimezone: 'Europe/Moscow' },
      slotTime: '2025-03-05T10:00:00.000Z',
      endTime: '2025-03-05T11:00:00.000Z',
    };

    const oldStart = '2025-03-05T08:00:00.000Z';
    const oldEnd = '2025-03-05T09:00:00.000Z';

    await sendRescheduleNotification(booking, oldStart, oldEnd);

    const [chatId, text] = fakeBot.telegram.sendMessage.mock.calls[0];
    expect(chatId).toBe('321');
    expect(text).toMatch(/Старое время:/);
    expect(text).toMatch(/Новое время:/);
    expect(text).toMatch(/\(Europe\/Moscow/);
  });
});
