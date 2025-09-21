const sequelize = require('../config/database');
const { TgAuthCode } = require('../models');
const { ensureUniqueAuthCodeForClient, hashCode } = require('../services/telegramBot');

describe('ensureUniqueAuthCodeForClient()', () => {
  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.AUTH_CODE_TTL_MIN = '10';
    await sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    await TgAuthCode.destroy({ where: {} });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  const makeClient = (over = {}) => ({
    tgUserId: String(over.tgUserId || 'u1'),
    tgChatId: String(over.tgChatId || 'c1'),
    tgUsername: over.tgUsername || 'user',
    firstName: over.firstName || 'Ivan',
    lastName: over.lastName || 'P',
    tgPhone: over.tgPhone || '+79990000000',
  });

  test('reuses active code for the same user', async () => {
    const client = makeClient({ tgUserId: '100' });
    const first = await ensureUniqueAuthCodeForClient(client, '111111');
    expect(first.code).toBe('111111');
    expect(first.reused).toBe(false);
    const id1 = first.record.id;

    const second = await ensureUniqueAuthCodeForClient(client, '111111');
    expect(second.code).toBe('111111');
    expect(second.reused).toBe(true);
    expect(second.record.id).toBe(id1);
  });

  test('collision with another user -> new code returned', async () => {
    const clientA = makeClient({ tgUserId: 'A' });
    const clientB = makeClient({ tgUserId: 'B' });

    const first = await ensureUniqueAuthCodeForClient(clientA, 'abc123');
    expect(first.code).toBe('abc123');

    const second = await ensureUniqueAuthCodeForClient(clientB, 'abc123');
    expect(second.code).not.toBe('abc123');
    expect(second.reused).toBe(false);
  });

  test('exhausted 6-digit attempts -> fallback to hex token', async () => {
    const originalRandom = Math.random;
    try {
      // Force genCode to always produce 100000
      Math.random = () => 0;
      // Pre-create a record with code 100000 to cause collision each attempt
      const h = hashCode('100000');
      await TgAuthCode.create({
        codeHash: h,
        tgUserId: 'X',
        tgChatId: 'Y',
        tgUsername: 'x',
        firstName: 'x',
        lastName: 'y',
        tgPhone: '+70000000000',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      const client = makeClient({ tgUserId: 'C' });
      const res = await ensureUniqueAuthCodeForClient(client);
      // Should be a hex string of length 32 (16 bytes)
      expect(/^[0-9a-f]{32}$/i.test(res.code)).toBe(true);
    } finally {
      Math.random = originalRandom;
    }
  });

  test('stores practitionerId and avoids reuse across different tenants', async () => {
    const client = makeClient({ tgUserId: 'tenant-user', tgChatId: 'tenant-chat' });
    const practitionerA = '11111111-1111-1111-1111-111111111111';
    const practitionerB = '22222222-2222-2222-2222-222222222222';

    const first = await ensureUniqueAuthCodeForClient(client, '222222', 'client', practitionerA);
    expect(first.reused).toBe(false);
    expect(first.record.practitionerId).toBe(practitionerA);

    const second = await ensureUniqueAuthCodeForClient(client, '222222', 'client', practitionerA);
    expect(second.reused).toBe(true);
    expect(second.record.practitionerId).toBe(practitionerA);

    const third = await ensureUniqueAuthCodeForClient(client, '222222', 'client', practitionerB);
    expect(third.reused).toBe(false);
    expect(third.code).not.toBe('222222');
    expect(third.record.practitionerId).toBe(practitionerB);
  });
});
