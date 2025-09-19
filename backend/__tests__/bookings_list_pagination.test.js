const request = require('supertest');
const app = require('../app');
const sequelize = require('../config/database');
const { Booking, Practitioner } = require('../models');
const jwt = require('jsonwebtoken');

// Silence external services
jest.mock('../services/jobQueue', () => ({
  enqueueTelegramNotification: jest.fn().mockResolvedValue(null),
}));
jest.mock('../services/telegramBot', () => ({
  notifyNewShortNoticeBooking: jest.fn().mockResolvedValue(true),
  notifyPractitionerNewBooking: jest.fn().mockResolvedValue(true),
}));

let practitioner;
function signAdminCookie(practitionerId) {
  const payload = { user: { id: 'u1', username: 'admin-test', role: 'admin', practitionerId } };
  const token = jwt.sign(payload, process.env.JWT_SECRET || 'test-secret-key-for-testing', { expiresIn: '1h' });
  return [`admin_sid=${token}`];
}

beforeAll(async () => {
  await sequelize.sync({ force: true });
  practitioner = await Practitioner.create({ slug: 'list-p', displayName: 'List P' });
});

afterAll(async () => {
  await sequelize.close();
});

beforeEach(async () => {
  await Booking.destroy({ where: {} });
});

test('GET /api/bookings without params returns array (backward compatible)', async () => {
  const now = Date.now();
  for (let i = 0; i < 3; i++) {
    await Booking.create({
      practitionerId: practitioner.id,
      clientName: `C${i}`,
      clientPhone: '+700000000' + i,
      preferredContact: 'phone',
      slotTime: new Date(now + i * 60 * 60 * 1000),
      endTime: new Date(now + (i + 1) * 60 * 60 * 1000),
      status: 'confirmed'
    });
  }

  const cookies = signAdminCookie(practitioner.id);
  const res = await request(app)
    .get('/api/bookings')
    .set('x-practitioner-id', practitioner.id)
    .set('Cookie', cookies)
    .expect(200);

  expect(Array.isArray(res.body)).toBe(true);
  expect(res.body.length).toBe(3);
});

test('GET /api/bookings with pagination returns {data, meta}', async () => {
  const now = Date.now();
  for (let i = 0; i < 10; i++) {
    await Booking.create({
      practitionerId: practitioner.id,
      clientName: `P${i}`,
      clientPhone: '+700000001' + i,
      preferredContact: 'phone',
      slotTime: new Date(now + i * 60 * 60 * 1000),
      endTime: new Date(now + (i + 1) * 60 * 60 * 1000),
      status: 'confirmed'
    });
  }

  const cookies = signAdminCookie(practitioner.id);
  const res = await request(app)
    .get('/api/bookings?limit=4&offset=2&status=confirmed&sortBy=createdAt&sortDir=DESC')
    .set('x-practitioner-id', practitioner.id)
    .set('Cookie', cookies)
    .expect(200);

  expect(res.body).toHaveProperty('data');
  expect(res.body).toHaveProperty('meta');
  expect(res.body.meta.limit).toBe(4);
  expect(res.body.meta.offset).toBe(2);
  expect(res.body.meta.total).toBe(10);
});
