process.env.RATE_LIMIT_SLOTS_MAX = '3';
process.env.RATE_LIMIT_WINDOW_MS = '60000';

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
  practitioner = await Practitioner.create({ slug: 'rl-slots', displayName: 'RL Slots' });
});

afterAll(async () => {
  await sequelize.close();
});

test('rate limit on POST /api/slots/create returns 429 after threshold', async () => {
  const cookies = signAdminCookie(practitioner.id);
  const base = new Date(Date.now() + 72 * 3600 * 1000); // +3 days
  const yyyy = base.getFullYear();
  const mm = String(base.getMonth() + 1).padStart(2, '0');
  const dd = String(base.getDate()).padStart(2, '0');
  const date = `${yyyy}-${mm}-${dd}`;

  const statuses = [];
  for (let i = 0; i < 6; i++) {
    const startMinutes = 9 * 60 + i * 10; // 09:00, 09:10, ...
    const endMinutes = startMinutes + 10;
    const startHH = String(Math.floor(startMinutes / 60)).padStart(2, '0');
    const startMM = String(startMinutes % 60).padStart(2, '0');
    const endHH = String(Math.floor(endMinutes / 60)).padStart(2, '0');
    const endMM = String(endMinutes % 60).padStart(2, '0');

    const res = await request(app)
      .post('/api/slots/create')
      .set('Cookie', cookies)
      .set('x-practitioner-id', practitioner.id)
      .send({ startTime: `${startHH}:${startMM}`, endTime: `${endHH}:${endMM}`, date, timezone: 'Europe/Moscow' });
    statuses.push(res.status);
  }

  const count429 = statuses.filter((s) => s === 429).length;
  expect(count429).toBeGreaterThan(0);
});
