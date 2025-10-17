process.env.REQUIRE_CLIENT_AUTH = 'false';
process.env.COOKIE_SECURE = 'true';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const request = require('supertest');
const app = require('../app');
const sequelize = require('../config/database');
const { Practitioner, Client, TgAuthCode } = require('../models');
const crypto = require('crypto');

function hashCode(code) {
  const pepper = process.env.AUTH_CODE_SECRET || (process.env.JWT_SECRET || 'secret');
  return crypto.createHash('sha256').update(`${code}:${pepper}`).digest('hex');
}

describe('Telegram /tg/verify flow', () => {
  let p1, p2;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    p1 = await Practitioner.create({ slug: 'p1', publicSlug: 'form-p1', displayName: 'P1' });
    p2 = await Practitioner.create({ slug: 'p2', publicSlug: 'form-p2', displayName: 'P2' });
  });

  test('returns 400 when code scope is admin (wrong scope)', async () => {
    const token = 'ADMINONLY1';
    await TgAuthCode.create({
      codeHash: hashCode(token), tgUserId: 'u7', tgChatId: 'u7', scope: 'admin', tgPhone: '+79995550077',
      practitionerId: p1.id, expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    const res = await request(app)
      .post('/api/auth/tg/verify')
      .set('x-practitioner-id', p1.id)
      .send({ code: token });
    expect(res.status).toBe(400);
  });

  test('binds record to practitioner when record.practitionerId is null and persists clientTimezone', async () => {
    const agent = request.agent(app);
    const tgUserId = 'u8';
    // seed code with null practitionerId and no phone but create Client with phone for fallback
    await Client.create({ tgUserId, tgChatId: tgUserId, tgPhone: '+79995550088', practitionerId: p1.id });

    const token = 'BINDP1';
    await TgAuthCode.create({
      codeHash: hashCode(token), tgUserId, tgChatId: tgUserId, scope: 'client', tgPhone: null,
      practitionerId: null, expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    const res = await agent
      .post('/api/auth/tg/verify')
      .set('x-practitioner-id', p1.id)
      .set('x-client-timezone', 'Asia/Bangkok')
      .send({ code: token });
    expect(res.status).toBe(200);

    // Verify record binding and client timezone persisted
    const rec = await TgAuthCode.findOne({ where: { codeHash: hashCode(token) } });
    expect(String(rec.practitionerId)).toBe(String(p1.id));
    const client = await Client.findOne({ where: { tgUserId, practitionerId: p1.id } });
    expect(client.clientTimezone).toBe('Asia/Bangkok');
  });

  afterAll(async () => {
    await sequelize.close();
  });

  test('verifies code, sets cookie, updates clientTimezone from header', async () => {
    const agent = request.agent(app);

    // Prepare client with phone to allow verify even if TgAuthCode has no phone
    const tgUserId = 'u1';
    await Client.create({ tgUserId, tgChatId: tgUserId, tgPhone: '+79995550000', practitionerId: p1.id });

    // Generate a code via helper endpoint (scope=client)
    const gen = await agent
      .post('/api/auth/telegram/generate-code')
      .set('x-practitioner-id', p1.id)
      .send({ tgUserId });
    expect(gen.status).toBe(200);
    const code = gen.body.code;

    const res = await agent
    .post('/api/auth/tg/verify')
    .set('x-practitioner-id', p1.id)
    .set('x-client-timezone', 'Asia/Bangkok')
    .send({ code });

    expect(res.status).toBe(200);
    expect(res.body && res.body.success).toBe(true);

    const setCookies = res.headers['set-cookie'] || [];
    const hasClientSid = setCookies.some((c) => /client_sid=/.test(c));
    expect(hasClientSid).toBe(true);
    expect(setCookies.every((c) => c.includes('Secure'))).toBe(true);
    expect(setCookies.every((c) => /SameSite=None/i.test(c))).toBe(true);

    // me under correct scope
  const cookies = res.headers['set-cookie'] || [];
  const cookieHeader = cookies.map((c) => String(c).split(';')[0]).join('; ');
  const me = await agent.get('/api/auth/tg/me').set('x-practitioner-id', p1.id).set('Cookie', cookieHeader);
    expect(me.status).toBe(200);
    expect(me.body && me.body.client).toBeTruthy();
  });

  test('returns 403 when token bound to another practitioner', async () => {
    const token = 'BOUND1';
    await TgAuthCode.create({
      codeHash: hashCode(token), tgUserId: 'u2', tgChatId: 'u2', scope: 'client', tgPhone: '+79990000000',
      practitionerId: p1.id, expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    const res = await request(app)
      .post('/api/auth/tg/verify')
      .set('x-practitioner-id', p2.id)
      .send({ code: token });
    expect(res.status).toBe(403);
  });

  test('used code returns 400, expired code returns 400', async () => {
    // Used
    const used = 'USED1';
    await TgAuthCode.create({
      codeHash: hashCode(used), tgUserId: 'u3', tgChatId: 'u3', scope: 'client', tgPhone: '+79990000001',
      practitionerId: p1.id, usedAt: new Date(), expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
    const r1 = await request(app)
      .post('/api/auth/tg/verify')
      .set('x-practitioner-id', p1.id)
      .send({ code: used });
    expect(r1.status).toBe(400);

    // Expired
    const exp = 'EXP1';
    await TgAuthCode.create({
      codeHash: hashCode(exp), tgUserId: 'u4', tgChatId: 'u4', scope: 'client', tgPhone: '+79990000002',
      practitionerId: p1.id, expiresAt: new Date(Date.now() - 60 * 1000),
    });
    const r2 = await request(app)
      .post('/api/auth/tg/verify')
      .set('x-practitioner-id', p1.id)
      .send({ code: exp });
    expect(r2.status).toBe(400);
  });

  test('requires phone when no existing phone is known', async () => {
    const agent = request.agent(app);
    const tgUserId = 'u5';
    const gen = await agent
      .post('/api/auth/telegram/generate-code')
      .set('x-practitioner-id', p1.id)
      .send({ tgUserId });
    const code = gen.body.code;

    const res = await agent
      .post('/api/auth/tg/verify')
      .set('x-practitioner-id', p1.id)
      .send({ code });

    expect(res.status).toBe(400);
    expect((res.body && res.body.message) || '').toMatch(/номер телефона/i);
  });

  test('me forbidden (403) when practitioner header mismatches', async () => {
    const agent = request.agent(app);
    const tgUserId = 'u6';
    await Client.create({ tgUserId, tgChatId: tgUserId, tgPhone: '+79995550123', practitionerId: p1.id });
    const gen = await agent
      .post('/api/auth/telegram/generate-code')
      .set('x-practitioner-id', p1.id)
      .send({ tgUserId });
    const code = gen.body.code;
    const verify = await agent
      .post('/api/auth/tg/verify')
      .set('x-practitioner-id', p1.id)
      .send({ code })
      .expect(200);
    const cookies2Raw = verify.headers['set-cookie'] || [];
    const cookies2 = cookies2Raw.map((c) => String(c).split(';')[0]).join('; ');

    const meWrong = await agent.get('/api/auth/tg/me').set('x-practitioner-id', p2.id).set('Cookie', cookies2);
    expect(meWrong.status).toBe(403);
  });
});
