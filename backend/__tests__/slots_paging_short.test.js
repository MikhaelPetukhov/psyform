const request = require('supertest');
const sequelize = require('../config/database');
const { Practitioner, AvailableSlot } = require('../models');
const app = require('../app');

jest.mock('../services/telegramBot', () => ({
  notifyNewShortNoticeBooking: jest.fn().mockResolvedValue(true),
  notifyPractitionerNewBooking: jest.fn().mockResolvedValue(true),
}));

let practitioner;

beforeAll(async () => {
  await sequelize.sync({ force: true });
  practitioner = await Practitioner.create({ slug: 'slots-short', displayName: 'Slots Short' });
});

afterAll(async () => {
  await sequelize.close();
});

beforeEach(async () => {
  await AvailableSlot.destroy({ where: {} });
});

function iso(d) { return new Date(d).toISOString(); }

function ymd(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

test('GET /api/slots?day=...&short=true&limit/offset returns {data, meta}', async () => {
  const base = new Date(Date.now() + 5 * 24 * 3600 * 1000); // +5 days
  const day = ymd(base);
  // create 3 slots on that day
  const slots = [];
  for (let i = 0; i < 3; i++) {
    const start = new Date(Date.parse(`${day}T09:${String(i)}0:00Z`));
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    slots.push(await AvailableSlot.create({
      practitionerId: practitioner.id,
      slotTime: start,
      endTime: end,
      isBooked: false,
    }));
  }

  const res = await request(app)
    .get(`/api/slots?day=${day}&short=true&limit=2&offset=0`)
    .set('x-practitioner-id', practitioner.id)
    .expect(200);

  expect(res.body).toHaveProperty('data');
  expect(res.body).toHaveProperty('meta');
  expect(res.body.meta.limit).toBe(2);
  expect(res.body.meta.total).toBe(3);
  expect(Array.isArray(res.body.data)).toBe(true);
  expect(res.body.data.length).toBe(2);
  // short payload should include formatted fields
  expect(res.body.data[0]).toHaveProperty('timeFormatted');
  expect(res.body.data[0]).toHaveProperty('endTimeFormatted');
});

test('GET /api/slots without params returns grouped object (legacy)', async () => {
  const base = new Date(Date.now() + 6 * 24 * 3600 * 1000); // +6 days
  const day = ymd(base);
  const start = new Date(Date.parse(`${day}T11:00:00Z`));
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  await AvailableSlot.create({ practitionerId: practitioner.id, slotTime: start, endTime: end, isBooked: false });

  const res = await request(app)
    .get(`/api/slots`)
    .set('x-practitioner-id', practitioner.id)
    .expect(200);

  expect(typeof res.body).toBe('object');
  // find key yyyy-MM-dd exists
  const key = ymd(start);
  expect(Object.keys(res.body)).toContain(key);
  expect(Array.isArray(res.body[key])).toBe(true);
  expect(res.body[key].length).toBeGreaterThanOrEqual(1);
});
