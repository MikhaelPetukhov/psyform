const request = require('supertest');
const app = require('../app');
const { Booking, AvailableSlot, Practitioner } = require('../models');
const sequelize = require('../config/database');

// Mock external services to avoid network/env dependencies
jest.mock('../services/telegramLookup', () => ({
  lookupByPhone: jest.fn().mockResolvedValue(null),
  lookupByUsername: jest.fn().mockResolvedValue(null),
}));

jest.mock('../services/whatsappCheck', () => ({
  checkWhatsApp: jest.fn().mockResolvedValue({ configured: false }),
}));

beforeAll(async () => {

  await sequelize.sync({ force: true });
});

beforeEach(async () => {
  await Booking.destroy({ where: {} });
  await AvailableSlot.destroy({ where: {} });
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
