process.env.REQUIRE_CLIENT_AUTH = 'false';
process.env.COOKIE_SECURE = 'true';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const request = require('supertest');
const app = require('../app');
const sequelize = require('../config/database');
const { Practitioner, TgAuthCode, Client } = require('../models');
const crypto = require('crypto');

function hashCode(code) {
  const pepper = process.env.AUTH_CODE_SECRET || (process.env.JWT_SECRET || 'secret');
  return crypto.createHash('sha256').update(`${code}:${pepper}`).digest('hex');
}

describe('Magic-link auth: redirects, cookies and idempotency', () => {
  let practitioner;
  const publicSlug = 'form-virtualsect';
  const privateSlug = 'virtualsect';
  const magicToken = 'MAGIC1';

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    practitioner = await Practitioner.create({ slug: privateSlug, publicSlug, displayName: 'Dr. Test' });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  test('GET /api/auth/magic sets cookies and redirects to /p/<slug> without r', async () => {
    const agent = request.agent(app);
    const token = 'MAGIC_SET_COOKIE';
    await TgAuthCode.create({
      codeHash: hashCode(token), tgUserId: 'tg_u_1', tgChatId: 'tg_c_1', tgUsername: 'tuser', firstName: 'Ivan', lastName: 'Petrov',
      tgPhone: '+79995550000', scope: 'client', practitionerId: practitioner.id, expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
    const res = await agent
      .get(`/api/auth/magic?t=${encodeURIComponent(token)}&p=${encodeURIComponent(publicSlug)}`)
      .set('x-client-timezone', 'Asia/Bangkok');

    expect([302, 303]).toContain(res.status);
    expect(res.headers.location).toBe(`/p/${publicSlug}`);

    // Cookies present and have security attributes
    const setCookies = res.headers['set-cookie'] || [];
    const hasClientSid = setCookies.some((c) => /client_sid=/.test(c));
    const hasSid = setCookies.some((c) => /sid=/.test(c));
    expect(hasClientSid).toBe(true);
    expect(hasSid).toBe(true);
    // Attributes
    const secureOk = setCookies.every((c) => c.includes('Secure'));
    const sameSiteOk = setCookies.every((c) => /SameSite=None/i.test(c));
    expect(secureOk).toBe(true);
    expect(sameSiteOk).toBe(true);
  });

  test('GET /api/auth/magic ignores invalid r and falls back to /p/<slug>', async () => {
    const agent = request.agent(app);
    // Seed another token
    const token2 = 'MAGIC2';
    await TgAuthCode.create({
      codeHash: hashCode(token2), tgUserId: 'tg_u_2', tgChatId: 'tg_c_2', scope: 'client', tgPhone: '+70000000000',
      practitionerId: practitioner.id, expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    // r = base64url('https://google.com') -> should be ignored
    const badR = 'aHR0cHM6Ly9nb29nbGUuY29t';
    const res = await agent
      .get(`/api/auth/magic?t=${encodeURIComponent(token2)}&p=${encodeURIComponent(publicSlug)}&r=${badR}`)
      .set('x-client-timezone', 'Europe/Moscow');

    expect([302, 303]).toContain(res.status);
    expect(res.headers.location).toBe(`/p/${publicSlug}`);
  });

  test('GET /api/auth/magic respects valid r (base64url path)', async () => {
    const agent = request.agent(app);
    const desired = `/p/${publicSlug}?tab=calendar`;
    const r = Buffer.from(desired, 'utf8').toString('base64url');
    const token3 = 'MAGIC3';
    await TgAuthCode.create({
      codeHash: hashCode(token3), tgUserId: 'tg_u_3', tgChatId: 'tg_c_3', scope: 'client', tgPhone: '+70000000001',
      practitionerId: practitioner.id, expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    const res = await agent
      .get(`/api/auth/magic?t=${encodeURIComponent(token3)}&p=${encodeURIComponent(publicSlug)}&r=${encodeURIComponent(r)}`)
      .set('x-client-timezone', 'Europe/Moscow');

    expect([302, 303]).toContain(res.status);
    expect(res.headers.location).toBe(desired);
  });

  test('GET /api/auth/magic with private slug p uses publicSlug in fallback', async () => {
    const agent = request.agent(app);
    const token4 = 'MAGIC4';
    await TgAuthCode.create({
      codeHash: hashCode(token4), tgUserId: 'tg_u_4', tgChatId: 'tg_c_4', scope: 'client', tgPhone: '+70000000002',
      practitionerId: practitioner.id, expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    const res = await agent
      .get(`/api/auth/magic?t=${encodeURIComponent(token4)}&p=${encodeURIComponent(privateSlug)}`)
      .set('x-client-timezone', 'Europe/Moscow');

    expect([302, 303]).toContain(res.status);
    expect(res.headers.location).toBe(`/p/${publicSlug}`);
  });

  test('GET /api/auth/magic with invalid token but valid cookie performs safe redirect (idempotent)', async () => {
    const agent = request.agent(app);

    // First: login with a fresh valid token to set cookies
    const token = 'MAGIC_LOGIN_ONCE';
    await TgAuthCode.create({
      codeHash: hashCode(token), tgUserId: 'tg_u_login', tgChatId: 'tg_c_login', scope: 'client', tgPhone: '+70000000009',
      practitionerId: practitioner.id, expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
    const first = await agent
      .get(`/api/auth/magic?t=${encodeURIComponent(token)}&p=${encodeURIComponent(publicSlug)}`)
      .set('x-client-timezone', 'Asia/Bangkok');
    expect([302, 303]).toContain(first.status);
    const firstCookies = first.headers['set-cookie'] || [];
    const firstCookieHeader = firstCookies.map((c) => String(c).split(';')[0]).join('; ');

    // Then: request with invalid t but with cookie present
    const res2 = await agent
      .get(`/api/auth/magic?t=${encodeURIComponent('INVALID')}&p=${encodeURIComponent(publicSlug)}`)
      .set('Cookie', firstCookieHeader);

    expect([302, 303]).toContain(res2.status);
    expect(res2.headers.location).toBe(`/p/${publicSlug}`);
  });

  test('GET /api/auth/tg/me returns 200 after magic and 401 after logout', async () => {
    const agent = request.agent(app);

    // Login via magic with a fresh token
    const token = 'MAGIC_FOR_ME';
    await TgAuthCode.create({
      codeHash: hashCode(token), tgUserId: 'tg_u_me', tgChatId: 'tg_c_me', scope: 'client', tgPhone: '+70000000033',
      practitionerId: practitioner.id, expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
    const login = await agent
      .get(`/api/auth/magic?t=${encodeURIComponent(token)}&p=${encodeURIComponent(publicSlug)}`)
      .set('x-client-timezone', 'Asia/Bangkok');
    expect([302, 303]).toContain(login.status);
    const cookies = login.headers['set-cookie'] || [];
    const cookieHeader = cookies.map((c) => String(c).split(';')[0]).join('; ');

    // me should be ok under practitioner scope
    const me = await agent
      .get('/api/auth/tg/me')
      .set('x-practitioner-id', practitioner.id)
      .set('Cookie', cookieHeader);
    expect(me.status).toBe(200);
    expect(me.body && me.body.client).toBeTruthy();

    // logout
    const out = await agent.post('/api/auth/tg/logout');
    expect(out.status).toBe(200);
    const cleared = out.headers['set-cookie'] || [];
    // Ensure cookies are cleared (Max-Age=0)
    expect(cleared.some((c) => /client_sid=/.test(c) && /Max-Age=0/i.test(c))).toBe(true);
    expect(cleared.some((c) => /sid=/.test(c) && /Max-Age=0/i.test(c))).toBe(true);

    const me2 = await agent
      .get('/api/auth/tg/me')
      .set('x-practitioner-id', practitioner.id);
    expect(me2.status).toBe(401);
  });

  test('GET /api/auth/magic with unknown p returns 404', async () => {
    const agent = request.agent(app);
    const res = await agent
      .get(`/api/auth/magic?t=${encodeURIComponent('UNKNOWN_TOKEN')}&p=${encodeURIComponent('unknown-form')}`);
    expect(res.status).toBe(404);
  });

  test('GET /api/auth/magic2 proxies to /api/auth/magic', async () => {
    const agent = request.agent(app);
    const res = await agent
      .get(`/api/auth/magic2?t=${encodeURIComponent('T2')}&p=${encodeURIComponent(publicSlug)}`);
    expect([302, 303]).toContain(res.status);
    expect(res.headers.location).toMatch(/^\/api\/auth\/magic\?/);
  });

  test('GET /api/auth/magic returns 403 when token bound to another practitioner', async () => {
    const agent = request.agent(app);
    // Create another practitioner
    const other = await Practitioner.create({ slug: 'other', publicSlug: 'form-other', displayName: 'Other' });
    const token = 'TENANT403';
    await TgAuthCode.create({
      codeHash: hashCode(token), tgUserId: 'tg_u_x', tgChatId: 'tg_c_x', scope: 'client', tgPhone: '+79991112233',
      practitionerId: other.id, expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    const res = await agent
      .get(`/api/auth/magic?t=${encodeURIComponent(token)}&p=${encodeURIComponent(publicSlug)}`);
    expect(res.status).toBe(403);
  });

  test('GET /api/auth/magic requires phone when no phone known', async () => {
    const agent = request.agent(app);
    const token = 'NOPHONE1';
    await TgAuthCode.create({
      codeHash: hashCode(token), tgUserId: 'tg_no_phone', tgChatId: 'tg_no_phone', scope: 'client', tgPhone: null,
      practitionerId: practitioner.id, expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    const res = await agent
      .get(`/api/auth/magic?t=${encodeURIComponent(token)}&p=${encodeURIComponent(publicSlug)}`);
    expect(res.status).toBe(400);
    expect((res.text || '').toLowerCase()).toContain('phone');
  });
});
