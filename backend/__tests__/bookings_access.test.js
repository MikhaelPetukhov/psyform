const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const sequelize = require('../config/database');
const { Practitioner, Booking } = require('../models');

function signAdminCookie(practitionerId) {
  const payload = {
    user: {
      id: 'adm1',
      username: 'admin1',
      role: 'admin',
      practitionerId,
    },
  };
  const token = jwt.sign(payload, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
  return [`admin_sid=${token}`];
}

describe('Bookings access protection and tenant scoping', () => {
  let p1, p2;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret';
    await sequelize.sync({ force: true });
    p1 = await Practitioner.create({ slug: 'p1', displayName: 'P1' });
    p2 = await Practitioner.create({ slug: 'p2', displayName: 'P2' });

    // seed a couple of bookings under different tenants
    const now = new Date();
    const later = new Date(now.getTime() + 24 * 3600 * 1000);
    await Booking.create({ clientName: 'A', slotTime: later, endTime: new Date(later.getTime() + 3600000), practitionerId: p1.id });
    await Booking.create({ clientName: 'B', slotTime: later, endTime: new Date(later.getTime() + 3600000), practitionerId: p2.id });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  test('GET /api/bookings requires admin auth', async () => {
    await request(app).get('/api/bookings').expect(401);
  });

  test('GET /api/bookings returns only current tenant records based on admin token', async () => {
    const cookies = signAdminCookie(p1.id);
    const res = await request(app)
      .get('/api/bookings')
      .set('Cookie', cookies)
      // try to spoof another tenant via header – should be ignored by practitionerScope for admin
      .set('x-practitioner-id', String(p2.id))
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    // ensure all returned belong to p1
    for (const b of res.body) {
      expect(String(b.practitionerId)).toBe(String(p1.id));
    }
  });

  test('GET /api/bookings/clients is admin-only', async () => {
    await request(app).get('/api/bookings/clients?q=te').expect(401);
    const cookies = signAdminCookie(p1.id);
    const ok = await request(app).get('/api/bookings/clients?q=te').set('Cookie', cookies).expect(200);
    expect(Array.isArray(ok.body)).toBe(true);
  });
});
