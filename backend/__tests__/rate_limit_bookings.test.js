process.env.RATE_LIMIT_BOOKINGS_MAX = '5';
process.env.RATE_LIMIT_WINDOW_MS = '60000';
process.env.REQUIRE_CLIENT_AUTH = 'false';

const request = require('supertest');
const app = require('../app');
const sequelize = require('../config/database');
const { Practitioner } = require('../models');

let practitioner;

beforeAll(async () => {
  await sequelize.sync({ force: true });
  practitioner = await Practitioner.create({ slug: 'rl-bookings', displayName: 'RL Bookings' });
});

afterAll(async () => {
  await sequelize.close();
});

test('rate limit on POST /api/bookings returns 429 after threshold', async () => {
  const base = Date.now() + 24 * 3600 * 1000; // +1 day
  const results = [];
  for (let i = 0; i < 8; i++) {
    const start = new Date(base + i * 45 * 60 * 1000);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    const res = await request(app)
      .post('/api/bookings')
      .set('x-practitioner-id', practitioner.id)
      .send({
        name: 'RL User',
        phone: '+79995550000',
        preferredContact: 'phone',
        slotTime: start.toISOString(),
        endTime: end.toISOString(),
      });
    results.push(res.status);
  }
  const count429 = results.filter((s) => s === 429).length;
  expect(count429).toBeGreaterThan(0);
});
