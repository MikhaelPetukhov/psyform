const request = require('supertest');
const { AvailableSlot, Practitioner, Booking } = require('../models');
const sequelize = require('../config/database');
const app = require('../app');

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

beforeEach(async () => {
  await Booking.destroy({ where: {} });
  await AvailableSlot.destroy({ where: {} });
  await Practitioner.destroy({ where: {} });
});

afterAll(async () => {
  await sequelize.close();
});

describe('GET /api/slots', () => {
  test('returns only future unbooked slots grouped by date', async () => {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    // Create practitioner first
    const practitioner = await Practitioner.create({
      id: '1',
      slug: 'test-psychologist',
      displayName: 'Test Psychologist',
    });

    // Past slot (should be excluded)
    await AvailableSlot.create({
      practitionerId: practitioner.id,
      slotTime: new Date(now - oneHour * 24),
      endTime: new Date(now - oneHour * 23),
      isBooked: false
    });

    // Future booked slot (should be excluded)
    await AvailableSlot.create({
      practitionerId: practitioner.id,
      slotTime: new Date(now + oneHour * 24),
      endTime: new Date(now + oneHour * 25),
      isBooked: true,
    });

    // Future unbooked slot (should be included)
    const futureFree = await AvailableSlot.create({ // Added this line
      practitionerId: practitioner.id,
      slotTime: new Date(now + oneHour * 48),
      endTime: new Date(now + oneHour * 49),
      isBooked: false
    });

    const res = await request(app)
      .get('/api/slots')
      .set('x-practitioner-id', practitioner.id);
    expect(res.status).toBe(200);
    const data = res.body;

    // Find the date key that corresponds to the futureFree's day (yyyy-MM-dd)
    const yyyy = futureFree.slotTime.getFullYear();
    const mm = String(futureFree.slotTime.getMonth() + 1).padStart(2, '0');
    const dd = String(futureFree.slotTime.getDate()).padStart(2, '0');
    const key = `${yyyy}-${mm}-${dd}`;

    expect(Object.keys(data)).toContain(key);
    expect(Array.isArray(data[key])).toBe(true);
    // Only one slot should be listed for that date in this test
    const slots = data[key];
    expect(slots.length).toBe(1);
    expect(new Date(slots[0].slotTime).toISOString()).toBe(futureFree.slotTime.toISOString());
    expect(slots[0].isBooked).toBe(false);
  });
});
