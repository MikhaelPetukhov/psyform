const { runReminderSweepOnce } = require('../services/reminderScheduler');
const { Booking, Client, Practitioner } = require('../models');
const sequelize = require('../config/database');

// Mock telegram bot
jest.mock('../services/telegramBot', () => ({
  notifyClientReminder: jest.fn().mockResolvedValue(true),
}));

const { notifyClientReminder: mockNotifyClientReminder } = require('../services/telegramBot');

describe('Reminder Scheduler', () => {
  let practitioner, client, booking24h, booking1h, bookingPast;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await sequelize.sync({ force: true });
    
    practitioner = await Practitioner.create({
      slug: 'test-reminder',
      displayName: 'Test Reminder Psychologist',
      price: 5000.00
    });

    client = await Client.create({
      firstName: 'Reminder',
      lastName: 'Client',
      tgUserId: '987654321',
      tgChatId: '987654321',
      tgPhone: '+79991234567'
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  beforeEach(async () => {
    await Booking.destroy({ where: {} });
    mockNotifyClientReminder.mockClear();

    const now = new Date();
    
    // Booking in ~24 hours (within reminder window)
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000 + 10 * 60 * 1000); // +10 min
    booking24h = await Booking.create({
      practitionerId: practitioner.id,
      clientId: client.id,
      slotTime: in24h,
      endTime: new Date(in24h.getTime() + 60 * 60 * 1000),
      clientName: 'Test 24h',
      clientPhone: '+79991234567',
      preferredContact: 'telegram',
      status: 'confirmed',
      reminder24hSentAt: null,
      reminder1hSentAt: null
    });

    // Booking in ~1 hour (within reminder window)
    const in1h = new Date(now.getTime() + 60 * 60 * 1000 + 3 * 60 * 1000); // +3 min
    booking1h = await Booking.create({
      practitionerId: practitioner.id,
      clientId: client.id,
      slotTime: in1h,
      endTime: new Date(in1h.getTime() + 60 * 60 * 1000),
      clientName: 'Test 1h',
      clientPhone: '+79991234567',
      preferredContact: 'telegram',
      status: 'confirmed',
      reminder24hSentAt: new Date(), // Already sent 24h reminder
      reminder1hSentAt: null
    });

    // Past booking (should be ignored)
    const past = new Date(now.getTime() - 60 * 60 * 1000);
    bookingPast = await Booking.create({
      practitionerId: practitioner.id,
      clientId: client.id,
      slotTime: past,
      endTime: new Date(past.getTime() + 60 * 60 * 1000),
      clientName: 'Test Past',
      clientPhone: '+79991234567',
      preferredContact: 'telegram',
      status: 'confirmed',
      reminder24hSentAt: null,
      reminder1hSentAt: null
    });
  });

  test('sends 24h reminders for eligible bookings', async () => {
    await runReminderSweepOnce();

    expect(mockNotifyClientReminder).toHaveBeenCalledWith(
      expect.objectContaining({ id: booking24h.id }),
      '24h'
    );

    // Check that reminder flag is updated
    const updated = await Booking.findByPk(booking24h.id);
    expect(updated.reminder24hSentAt).not.toBeNull();
  });

  test('sends 1h reminders for eligible bookings', async () => {
    await runReminderSweepOnce();

    expect(mockNotifyClientReminder).toHaveBeenCalledWith(
      expect.objectContaining({ id: booking1h.id }),
      '1h'
    );

    // Check that reminder flag is updated
    const updated = await Booking.findByPk(booking1h.id);
    expect(updated.reminder1hSentAt).not.toBeNull();
  });

  test('does not send reminders for past bookings', async () => {
    await runReminderSweepOnce();

    expect(mockNotifyClientReminder).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: bookingPast.id }),
      expect.any(String)
    );
  });

  test('does not send duplicate reminders', async () => {
    // Mark 24h reminder as already sent
    await booking24h.update({ reminder24hSentAt: new Date() });
    
    await runReminderSweepOnce();

    expect(mockNotifyClientReminder).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: booking24h.id }),
      '24h'
    );
  });

  test('handles telegram notification failures gracefully', async () => {
    mockNotifyClientReminder.mockResolvedValueOnce(false);
    
    // Should not throw error
    await expect(runReminderSweepOnce()).resolves.not.toThrow();
  });

  test('skips bookings without client or telegram chat', async () => {
    // Create booking without client
    const noClientBooking = await Booking.create({
      practitionerId: practitioner.id,
      clientId: null,
      slotTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 25 * 60 * 60 * 1000),
      clientName: 'No Client',
      clientPhone: '+79991234567',
      preferredContact: 'phone',
      status: 'confirmed'
    });

    await runReminderSweepOnce();

    expect(mockNotifyClientReminder).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: noClientBooking.id }),
      expect.any(String)
    );
  });

  test('processes only confirmed bookings', async () => {
    await booking24h.update({ status: 'pending' });
    
    await runReminderSweepOnce();

    expect(mockNotifyClientReminder).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: booking24h.id }),
      '24h'
    );
  });
});
