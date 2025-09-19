const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const sequelize = require('../config/database');
const { Practitioner } = require('../models');

let practitioner;

function signAdminCookie(practitionerId) {
  const payload = { user: { id: 'u1', username: 'admin-test', role: 'admin', practitionerId } };
  const token = jwt.sign(payload, process.env.JWT_SECRET || 'test-secret-key-for-testing', { expiresIn: '1h' });
  return [`admin_sid=${token}`];
}

beforeAll(async () => {
  await sequelize.sync({ force: true });
  practitioner = await Practitioner.create({ slug: 'idem-slots', displayName: 'Idem Slots' });
});

afterAll(async () => {
  await sequelize.close();
});

test('POST /api/slots/create idempotent by Idempotency-Key returns same slot', async () => {
  const day = new Date(Date.now() + 48 * 3600 * 1000);
  const yyyy = day.getFullYear();
  const mm = String(day.getMonth() + 1).padStart(2, '0');
  const dd = String(day.getDate()).padStart(2, '0');
  const date = `${yyyy}-${mm}-${dd}`;
  const startTime = '10:00';
  const endTime = '11:00';
  const idem = 'slot-idem-123';
  const cookies = signAdminCookie(practitioner.id);

  const first = await request(app)
    .post('/api/slots/create')
    .set('Cookie', cookies)
    .set('x-practitioner-id', practitioner.id)
    .set('Idempotency-Key', idem)
    .send({ startTime, endTime, date, timezone: 'Europe/Moscow' })
    .expect(200);

  const second = await request(app)
    .post('/api/slots/create')
    .set('Cookie', cookies)
    .set('x-practitioner-id', practitioner.id)
    .set('Idempotency-Key', idem)
    .send({ startTime, endTime, date, timezone: 'Europe/Moscow' })
    .expect(200);

  expect(second.body.slot.id).toBe(first.body.slot.id);
});
