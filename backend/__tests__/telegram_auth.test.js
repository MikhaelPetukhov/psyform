const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const sequelize = require('../config/database');
const { hashCode } = require('../services/telegramBot');
const { TgAuthCode, Client, Practitioner } = require('../models');

// Helper: base64url for r param
function b64url(str) { return Buffer.from(str, 'utf8').toString('base64url'); }
const formPath = (p) => `/p/${encodeURIComponent(p.publicSlug || p.slug)}`;

describe('Telegram auth flow', () => {
  let p1, p2;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.AUTH_CODE_TTL_MIN = '10';
    await sequelize.sync({ force: true });
    p1 = await Practitioner.create({ slug: 'p1', publicSlug: 'p1-public', displayName: 'P1' });
    p2 = await Practitioner.create({ slug: 'p2', publicSlug: 'p2-public', displayName: 'P2' });
  });

  beforeEach(async () => {
    await TgAuthCode.destroy({ where: {} });
    await Client.destroy({ where: {} });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  async function createCodeRecord({ code, tgUserId = '1001', tgChatId = '2001', tgUsername = 'user1', firstName = 'Ivan', lastName = 'Petrov', tgPhone = '+79990001122', expiresInMin = 10, practitionerId = null, usedAt = null }) {
    const codeHash = hashCode(code);
    const expiresAt = new Date(Date.now() + expiresInMin * 60 * 1000);
    return await TgAuthCode.create({
      codeHash,
      tgUserId,
      tgChatId,
      tgUsername,
      firstName,
      lastName,
      tgPhone,
      expiresAt,
      usedAt,
      practitionerId,
    });
  }

  describe('GET /api/auth/magic', () => {
    test('valid token sets sid cookie, marks used and redirects (302)', async () => {
      const code = 'abc123';
      await createCodeRecord({ code, tgPhone: '+70000000001', practitionerId: p1.id });

      const res = await request(app)
        .get(`/api/auth/magic?t=${encodeURIComponent(code)}&p=${encodeURIComponent(p1.slug)}&r=${encodeURIComponent(b64url('/dashboard'))}`)
        .expect(302);

      const setCookie = res.headers['set-cookie'];
      expect(Array.isArray(setCookie)).toBe(true);
      expect(setCookie.join(';')).toContain('sid=');
      expect(res.headers.location).toBe('/dashboard');

      const found = await TgAuthCode.findOne({ where: { codeHash: hashCode(code) } });
      expect(found).toBeTruthy();
      expect(found.usedAt).not.toBeNull();

      const client = await Client.findOne({ where: { tgUserId: found.tgUserId, practitionerId: p1.id } });
      expect(client).toBeTruthy();
    });

    test('valid token without r redirects to practitioner public form', async () => {
      const code = 'redir-form';
      await createCodeRecord({ code, tgPhone: '+70000009999', practitionerId: p1.id });

      const res = await request(app)
        .get(`/api/auth/magic?t=${encodeURIComponent(code)}&p=${encodeURIComponent(p1.publicSlug)}`)
        .expect(302);
      expect(res.headers.location).toBe(formPath(p1));

      const res2 = await request(app)
        .get(`/api/auth/magic?t=${encodeURIComponent(code)}&p=${encodeURIComponent(p1.slug)}`)
        .expect(401);
      expect(res2.text).toMatch(/Token already used/i);
    });

    test('second click with valid sid cookie redirects (idempotent)', async () => {
      const code = 'second-click';
      await createCodeRecord({ code, tgPhone: '+70000000003', practitionerId: p1.id });

      const first = await request(app)
        .get(`/api/auth/magic?t=${encodeURIComponent(code)}&p=${encodeURIComponent(p1.slug)}`)
        .expect(302);
      const cookies = first.headers['set-cookie'];
      expect(cookies).toBeTruthy();

      const second = await request(app)
        .get(`/api/auth/magic?t=${encodeURIComponent(code)}&p=${encodeURIComponent(p1.slug)}`)
        .set('Cookie', cookies)
        .expect(302);
      expect(second.headers.location).toBe(formPath(p1));
    });

    test('expired token returns 401', async () => {
      const code = 'expired';
      // expiresInMin negative to ensure expiry
      await createCodeRecord({ code, tgPhone: '+70000000004', practitionerId: p1.id, expiresInMin: -1 });
      const res = await request(app)
        .get(`/api/auth/magic?t=${encodeURIComponent(code)}&p=${encodeURIComponent(p1.slug)}`)
        .expect(401);
      expect(res.text).toMatch(/Token expired/i);
    });

    test('invalid token with valid sid cookie redirects (idempotent)', async () => {
      const code = 'valid-first';
      const firstRec = await createCodeRecord({ code, tgPhone: '+70000000005', practitionerId: p1.id });

      const first = await request(app)
        .get(`/api/auth/magic?t=${encodeURIComponent(code)}&p=${encodeURIComponent(p1.slug)}`)
        .expect(302);
      const cookies = first.headers['set-cookie'];

      const invalid = await request(app)
        .get(`/api/auth/magic?t=${encodeURIComponent('totally-wrong')}&p=${encodeURIComponent(p1.slug)}`)
        .set('Cookie', cookies)
        .expect(302);
      expect(invalid.headers.location).toBe(formPath(p1));

      // ensure original record remains used
      const found = await TgAuthCode.findOne({ where: { codeHash: hashCode(code) } });
      expect(found.usedAt).not.toBeNull();
    });

    test('token requires phone confirmation', async () => {
      const code = 'no-phone';
      await createCodeRecord({ code, tgPhone: null, practitionerId: p1.id });
      const res = await request(app)
        .get(`/api/auth/magic?t=${encodeURIComponent(code)}&p=${encodeURIComponent(p1.slug)}`)
        .expect(400);
      expect(res.text).toMatch(/Phone not confirmed via Telegram/i);
    });

    test('wrong tenant returns 403', async () => {
      const code = 'wrong-tenant';
      await createCodeRecord({ code, tgPhone: '+70000000010', practitionerId: p2.id });

      const res = await request(app)
        .get(`/api/auth/magic?t=${encodeURIComponent(code)}&p=${encodeURIComponent(p1.slug)}`)
        .expect(403);
      expect(res.text).toMatch(/Wrong tenant/i);
    });

    test('missing p param returns 400', async () => {
      const code = 'implicit-tenant';
      await createCodeRecord({ code, tgPhone: '+70000000011', practitionerId: p1.id });

      const res = await request(app)
        .get(`/api/auth/magic?t=${encodeURIComponent(code)}`)
        .expect(400);
      expect(res.text).toMatch(/Missing p/i);
    });

    test('slug parameter binds tenant when record is not scoped', async () => {
      const code = 'slug-binds';
      const rec = await createCodeRecord({ code, tgPhone: '+70000000021', practitionerId: null });

      const res = await request(app)
        .get(`/api/auth/magic?t=${encodeURIComponent(code)}&p=${encodeURIComponent(p2.slug)}`)
        .expect(302);
      expect(res.headers.location).toBe(formPath(p2));

      const updated = await TgAuthCode.findOne({ where: { codeHash: hashCode(code) } });
      expect(String(updated.practitionerId)).toBe(String(p2.id));

      const client = await Client.findOne({ where: { tgUserId: rec.tgUserId, practitionerId: p2.id } });
      expect(client).toBeTruthy();
    });

    test('unknown p param returns 404', async () => {
      const code = 'unknown-p';
      await createCodeRecord({ code, tgPhone: '+70000000077', practitionerId: p1.id });
      const res = await request(app)
        .get(`/api/auth/magic?t=${encodeURIComponent(code)}&p=${encodeURIComponent('no-such-practitioner')}`)
        .expect(404);
      expect(res.text).toMatch(/Unknown practitioner/i);
    });
  });

  describe('POST /api/auth/tg/verify', () => {
    test('successfully verifies one-time code and sets cookie + client', async () => {
      const code = 'verify-ok';
      await createCodeRecord({ code, tgPhone: '+70000000006' });

      const res = await request(app)
        .post('/api/auth/tg/verify')
        .set('x-practitioner-id', p1.id)
        .send({ code })
        .expect(200);

      const setCookie = res.headers['set-cookie'];
      expect(Array.isArray(setCookie)).toBe(true);
      expect(setCookie.join(';')).toMatch(/client_sid=/);

      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('client');
      expect(res.body).not.toHaveProperty('token');

      const rec = await TgAuthCode.findOne({ where: { codeHash: hashCode(code) } });
      expect(rec.usedAt).not.toBeNull();

      const client = await Client.findOne({ where: { tgUserId: rec.tgUserId, practitionerId: p1.id } });
      expect(client).toBeTruthy();
    });

    test('second verification fails as already used', async () => {
      const code = 'verify-once';
      await createCodeRecord({ code, tgPhone: '+70000000007' });

      await request(app).post('/api/auth/tg/verify').set('x-practitioner-id', p1.id).send({ code }).expect(200);
      const res2 = await request(app).post('/api/auth/tg/verify').set('x-practitioner-id', p1.id).send({ code }).expect(400);
      expect(res2.body.message).toMatch(/уже использован/i);
    });

    test('expired code fails', async () => {
      const code = 'verify-expired';
      await createCodeRecord({ code, tgPhone: '+70000000008', expiresInMin: -1 });
      const res = await request(app).post('/api/auth/tg/verify').set('x-practitioner-id', p1.id).send({ code }).expect(400);
      expect(res.body.message).toMatch(/истёк/i);
    });

    test('invalid code fails', async () => {
      const res = await request(app).post('/api/auth/tg/verify').set('x-practitioner-id', p1.id).send({ code: 'no-such' }).expect(400);
      expect(res.body.message).toMatch(/Неверный код/i);
    });

    test('wrong tenant is rejected', async () => {
      const code = 'verify-tenant';
      // Code is already bound to p2
      await createCodeRecord({ code, tgPhone: '+70000000009', practitionerId: p2.id });
      const res = await request(app).post('/api/auth/tg/verify').set('x-practitioner-id', p1.id).send({ code }).expect(403);
      expect(res.body.message).toMatch(/другого арендатора/i);
    });

    test('requires phone confirmation', async () => {
      const code = 'verify-no-phone';
      await createCodeRecord({ code, tgPhone: null });
      const res = await request(app).post('/api/auth/tg/verify').set('x-practitioner-id', p1.id).send({ code }).expect(400);
      expect(res.body.message).toMatch(/подтвердить номер телефона/i);
    });

    test('binds record to tenant on first use when record.practitionerId is null', async () => {
      const code = 'bind-tenant';
      const rec = await createCodeRecord({ code, tgPhone: '+70000000012', practitionerId: null });

      const res = await request(app)
        .post('/api/auth/tg/verify')
        .set('x-practitioner-id', p1.id)
        .send({ code })
        .expect(200);

      const updated = await TgAuthCode.findOne({ where: { codeHash: hashCode(code) } });
      expect(String(updated.practitionerId)).toBe(String(p1.id));
    });

    test('orphan client (practitionerId=null) is attached to current tenant on verify', async () => {
      const code = 'orphan-bind';
      const rec = await createCodeRecord({ code, tgPhone: '+70000000013', practitionerId: null });
      // Pre-create orphan client
      await Client.create({ tgUserId: rec.tgUserId, tgChatId: rec.tgChatId, tgUsername: 'orph', firstName: 'O', lastName: 'C', tgPhone: null, practitionerId: null });

      const res = await request(app)
        .post('/api/auth/tg/verify')
        .set('x-practitioner-id', p1.id)
        .send({ code })
        .expect(200);

      const client = await Client.findOne({ where: { tgUserId: rec.tgUserId, practitionerId: p1.id } });
      expect(client).toBeTruthy();
    });
  });

  describe('POST /api/auth/tg/logout', () => {
    test('clears client_sid cookie', async () => {
      const payload = {
        client: {
          id: 'c-logout',
          tgUserId: 'tg-logout',
          practitionerId: p1.id,
        },
      };
      const token = jwt.sign(payload, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
      const res = await request(app)
        .post('/api/auth/tg/logout')
        .set('Cookie', [`client_sid=${token}`])
        .expect(200);

      const setCookie = res.headers['set-cookie'];
      expect(Array.isArray(setCookie)).toBe(true);
      const combined = setCookie.join(';');
      expect(combined).toMatch(/client_sid=/);
      expect(combined).toMatch(/Max-Age=0/i);
      expect(res.body.success).toBe(true);
    });
  });
});
