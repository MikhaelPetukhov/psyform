const request = require('supertest');
const app = require('../app');
const sequelize = require('../config/database');
const { Practitioner } = require('../models');

let practitioner;

beforeAll(async () => {
  process.env.REQUIRE_CLIENT_AUTH = 'false';
  await sequelize.sync({ force: true });
  practitioner = await Practitioner.create({ slug: 'idem-p', displayName: 'Idem P' });
});

afterAll(async () => {
  await sequelize.close();
});

test('POST /api/bookings idempotent by Idempotency-Key returns same booking', async () => {
  const start = new Date(Date.now() + 24 * 3600 * 1000);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const idem = 'test-idem-key-123';

  const first = await request(app)
    .post('/api/bookings')
    .set('x-practitioner-id', practitioner.id)
    .set('Idempotency-Key', idem)
    .send({
      name: 'Idem User',
      phone: '+79990000000',
      preferredContact: 'phone',
      slotTime: start.toISOString(),
      endTime: end.toISOString(),
    })
    .expect(200);

  const second = await request(app)
    .post('/api/bookings')
    .set('x-practitioner-id', practitioner.id)
    .set('Idempotency-Key', idem)
    .send({
      name: 'Idem User',
      phone: '+79990000000',
      preferredContact: 'phone',
      slotTime: start.toISOString(),
      endTime: end.toISOString(),
    })
    .expect(200);

  expect(second.body.id).toBe(first.body.id);
});
