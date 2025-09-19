const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const sequelize = require('../config/database');
const { Practitioner } = require('../models');

// Mock external services
jest.mock('../services/telegramLookup', () => ({
  lookupByPhone: jest.fn().mockResolvedValue(null),
  lookupByUsername: jest.fn().mockResolvedValue(null),
}));

jest.mock('../services/whatsappCheck', () => ({
  checkWhatsApp: jest.fn().mockResolvedValue({ configured: false }),
}));

jest.mock('../services/telegramBot', () => ({
  notifyBookingCreated: jest.fn().mockResolvedValue(true),
  notifyPractitionerNewBooking: jest.fn().mockResolvedValue(true),
}));

function signAdminCookie(practitionerId) {
  const payload = {
    user: {
      id: 'u1',
      username: 'admin-test',
      role: 'admin',
      practitionerId,
    },
  };
  const token = jwt.sign(payload, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
  return [`admin_sid=${token}`];
}

describe('Admin auth: /admin/me and /admin/logout', () => {
  let p;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret';
    await sequelize.sync({ force: true });
    p = await Practitioner.create({ slug: 'p-admin', displayName: 'Admin P' });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  test('GET /api/auth/admin/me with admin cookie returns ok and practitioner context', async () => {
    const cookies = signAdminCookie(p.id);
    const res = await request(app)
      .get('/api/auth/admin/me')
      .set('Cookie', cookies)
      .expect(200);
    expect(res.body.ok).toBe(true);
    expect(String(res.body.practitionerId)).toBe(String(p.id));
  });

  test('POST /api/auth/admin/logout clears cookie and subsequent /admin/me is unauthorized', async () => {
    const cookies = signAdminCookie(p.id);
    const out = await request(app)
      .post('/api/auth/admin/logout')
      .set('Cookie', cookies)
      .expect(200);

    // cookie should be cleared in Set-Cookie header
    const setCookie = out.headers['set-cookie'];
    expect(Array.isArray(setCookie)).toBe(true);
    expect(setCookie.join(';')).toMatch(/admin_sid=/);

    // No cookie now – should be 401
    await request(app)
      .get('/api/auth/admin/me')
      .expect(401);
  });
});
