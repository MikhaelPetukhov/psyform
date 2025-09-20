const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const { Booking, AvailableSlot, Practitioner, Client } = require('../models');
const sequelize = require('../config/database');

// Mock external services to avoid network/env dependencies
jest.mock('../services/telegramLookup', () => ({
  lookupByPhone: jest.fn().mockResolvedValue(null),
  lookupByUsername: jest.fn().mockResolvedValue(null),
}));

jest.mock('../services/whatsappCheck', () => ({
  checkWhatsApp: jest.fn().mockResolvedValue({ configured: false }),
}));

jest.mock('../services/telegramBot', () => ({
  notifyNewShortNoticeBooking: jest.fn().mockResolvedValue(true),
  notifyPractitionerNewBooking: jest.fn().mockResolvedValue(true),
  notifyBookingCreated: jest.fn().mockResolvedValue(true),
  sendRescheduleNotification: jest.fn().mockResolvedValue(true),
}));

const { sendRescheduleNotification } = require('../services/telegramBot');

beforeAll(async () => {

  await sequelize.sync({ force: true });
});

beforeEach(async () => {
  jest.clearAllMocks();
  await Booking.destroy({ where: {} });
  await AvailableSlot.destroy({ where: {} });
  await Client.destroy({ where: {} });
  await Practitioner.destroy({ where: {} });
  practitioner = await Practitioner.create({
    slug: 'test-psychologist',
    displayName: 'Test Psychologist',
  });
});

afterAll(async () => {
  await sequelize.close();
});

const isoAt = (date, time) => new Date(`${date}T${time}:00`).toISOString();
let practitioner;
const createAdminToken = (practitionerId) => jwt.sign({
  user: {
    id: 'admin-test',
    role: 'admin',
    practitionerId,
  },
}, process.env.JWT_SECRET || 'test-secret-key-for-testing', { expiresIn: '1h' });

describe('POST /api/bookings (manual by time)', () => {
  test('creates booking with slotTime/endTime and auto-creates slot', async () => {
    const date = new Date();
    date.setDate(date.getDate() + 1); // tomorrow
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');

    const now = new Date();
    const slotStart = new Date(now.getTime() + 2 * 24 * 3600 * 1000); // +2 days
    const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);

    const res = await request(app)
      .post('/api/bookings')
      .send({
        name: 'John Doe',
        phone: '+79991234567',
        preferredContact: 'telegram',
        slotTime: slotStart.toISOString(),
        endTime: slotEnd.toISOString()
      })
      .set('x-practitioner-id', practitioner.id)
      .set('Accept', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('AvailableSlotId');
  });

  test('returns 400 when endTime <= slotTime', async () => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const day = `${yyyy}-${mm}-${dd}`;

    const res = await request(app)
      .post('/api/bookings')
      .send({
        name: 'Иван',
        preferredContact: 'phone',
        slotTime: isoAt(day, '10:00'),
        endTime: isoAt(day, '09:30'),
      })
      .set('Accept', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('msg');
  });

  test('returns 400 when missing both slotId and manual times', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .send({
        name: 'Иван',
        preferredContact: 'phone',
      })
      .set('Accept', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('errors');
  });

  test('returns 400 when another booking already exists at the same time', async () => {

    const now = new Date();
    const slotStart = new Date(now.getTime() + 3 * 24 * 3600 * 1000); // +3 days
    const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);

    // First booking succeeds
    const res1 = await request(app)
      .post('/api/bookings')
      .send({
        name: 'Test1',
        preferredContact: 'phone',
        slotTime: slotStart.toISOString(),
        endTime: slotEnd.toISOString()
      })
      .set('x-practitioner-id', practitioner.id)
      .set('Accept', 'application/json');
    expect(res1.status).toBe(200);

    // Second booking with same start time should fail
    const res2 = await request(app)
      .post('/api/bookings')
      .send({
        name: 'Test2',
        preferredContact: 'phone',
        slotTime: slotStart.toISOString(),
        endTime: slotEnd.toISOString()
      })
      .set('x-practitioner-id', practitioner.id)
      .set('Accept', 'application/json');
    expect(res2.status).toBe(400);
    expect(res2.body).toHaveProperty('msg');
  });
});

describe('POST /api/bookings (by existing slotId)', () => {
  test('creates booking with slotTime/endTime and auto-creates slot', async () => {

    const now = new Date();
    const slotStart = new Date(now.getTime() + 3 * 24 * 3600 * 1000); // +3 days
    const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);
    const slot = await AvailableSlot.create({ 
      practitionerId: practitioner.id, 
      slotTime: slotStart, 
      endTime: slotEnd, 
      isBooked: false 
    });

    const res = await request(app)
      .post('/api/bookings')
      .send({
        name: 'Jane Smith',
        phone: '+79991234567',
        preferredContact: 'phone',
        slotId: slot.id
      })
      .set('x-practitioner-id', practitioner.id)
      .set('Accept', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.AvailableSlotId).toBe(slot.id);

    const refreshed = await AvailableSlot.findByPk(slot.id);
    expect(refreshed.isBooked).toBe(true);
  });
});

describe('PATCH /api/bookings/:id/reschedule', () => {
  test('updates booking, frees previous slot and notifies client', async () => {
    const now = Date.now();
    const oldStart = new Date(now + 24 * 3600 * 1000);
    const oldEnd = new Date(oldStart.getTime() + 60 * 60 * 1000);
    const newStart = new Date(now + 48 * 3600 * 1000);
    const newEnd = new Date(newStart.getTime() + 60 * 60 * 1000);

    const oldSlot = await AvailableSlot.create({
      practitionerId: practitioner.id,
      slotTime: oldStart,
      endTime: oldEnd,
      isBooked: true,
    });

    const newSlot = await AvailableSlot.create({
      practitionerId: practitioner.id,
      slotTime: newStart,
      endTime: newEnd,
      isBooked: false,
    });

    const client = await Client.create({
      tgUserId: '12345',
      tgChatId: '67890',
      tgUsername: 'reschedule_client',
      practitionerId: practitioner.id,
    });

    const booking = await Booking.create({
      clientName: 'Reschedule Test',
      slotTime: oldStart,
      endTime: oldEnd,
      practitionerId: practitioner.id,
      AvailableSlotId: oldSlot.id,
      clientId: client.id,
      clientConfirmation: 'confirmed',
      reminderSentAt: new Date(),
      reminder24hSentAt: new Date(),
      reminder1hSentAt: new Date(),
    });

    const token = createAdminToken(practitioner.id);
    const res = await request(app)
      .patch(`/api/bookings/${booking.id}/reschedule`)
      .set('x-auth-token', token)
      .set('x-practitioner-id', practitioner.id)
      .send({ slotId: newSlot.id })
      .expect(200);

    expect(res.body.id).toBe(booking.id);
    expect(new Date(res.body.slotTime).toISOString()).toBe(newSlot.slotTime.toISOString());

    const updated = await Booking.findByPk(booking.id);
    expect(String(updated.AvailableSlotId)).toBe(String(newSlot.id));
    expect(updated.clientConfirmation).toBe('pending');
    expect(updated.reminderSentAt).toBeNull();
    expect(updated.reminder24hSentAt).toBeNull();
    expect(updated.reminder1hSentAt).toBeNull();

    const freedOldSlot = await AvailableSlot.findByPk(oldSlot.id);
    expect(freedOldSlot.isBooked).toBe(false);

    const bookedNewSlot = await AvailableSlot.findByPk(newSlot.id);
    expect(bookedNewSlot.isBooked).toBe(true);

    expect(sendRescheduleNotification).toHaveBeenCalledTimes(1);
    const [notifiedBooking, notifiedOldStart, notifiedOldEnd] = sendRescheduleNotification.mock.calls[0];
    expect(String(notifiedBooking.id)).toBe(String(booking.id));
    expect(new Date(notifiedOldStart).toISOString()).toBe(oldStart.toISOString());
    expect(new Date(notifiedOldEnd).toISOString()).toBe(oldEnd.toISOString());
  });
});
