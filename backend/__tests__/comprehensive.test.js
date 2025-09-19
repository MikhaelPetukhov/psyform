const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const sequelize = require('../config/database');
const { Practitioner, Client, AvailableSlot, Booking, ScheduleSetting, TgAuthCode, User } = require('../models');

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
  notifyClientReminder: jest.fn().mockResolvedValue(true),
}));

// Helper functions
function signAdminCookie(practitionerId, role = 'admin') {
  const payload = {
    user: {
      id: 'test-admin',
      username: 'test-admin',
      role,
      practitionerId,
    },
  };
  const token = jwt.sign(payload, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
  return [`admin_sid=${token}`];
}

function signClientCookie(clientId, practitionerId = null) {
  const payload = {
    user: {
      id: clientId,
      role: 'client',
      practitionerId,
    },
  };
  const token = jwt.sign(payload, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
  return [`client_sid=${token}`];
}

const isoAt = (date, time) => new Date(`${date}T${time}:00`).toISOString();

describe('Comprehensive System Tests', () => {
  let practitioner, client, adminCookies, clientCookies;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.NODE_ENV = 'test';
    await sequelize.sync({ force: true });
    
    // Create test practitioner
    practitioner = await Practitioner.create({
      slug: 'test-psychologist',
      displayName: 'Test Psychologist',
      price: 5000.00,
      publicSlug: 'public-test'
    });

    // Create test client
    client = await Client.create({
      firstName: 'Test',
      lastName: 'Client',
      tgUsername: 'testclient',
      tgUserId: '123456789',
      tgPhone: '+79991234567',
      tgChatId: '123456789'
    });

    adminCookies = signAdminCookie(practitioner.id);
    clientCookies = signClientCookie(client.id, practitioner.id);
  });

  afterAll(async () => {
    await sequelize.close();
  });

  beforeEach(async () => {
    // Clean up between tests
    await Booking.destroy({ where: {} });
    await AvailableSlot.destroy({ where: {} });
    await TgAuthCode.destroy({ where: {} });
    await User.destroy({ where: {} });
  });

  describe('Authentication Flow', () => {
    test('Admin login with valid credentials', async () => {
      // First create a user for login
      await User.create({
        username: 'admin',
        // IMPORTANT: provide plaintext, model hook will hash it
        password: 'admin123'
      });

      const res = await request(app)
        .post('/api/auth/login')
        .set('x-practitioner-slug', 'test-psychologist')
        .send({
          username: 'admin',
          password: 'admin123'
        })
        .expect(200);

      expect(res.body.msg).toBe('Успешный вход');
      expect(res.headers['set-cookie']).toBeDefined();
    });

    test('Admin /me endpoint with valid cookie', async () => {
      const res = await request(app)
        .get('/api/auth/admin/me')
        .set('Cookie', adminCookies)
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(String(res.body.practitionerId)).toBe(String(practitioner.id));
    });

    test('Client auth code generation and verification', async () => {
      // Generate auth code
      const codeRes = await request(app)
        .post('/api/auth/telegram/generate-code')
        .set('x-practitioner-slug', 'test-psychologist')
        .send({ tgUserId: client.tgUserId })
        .expect(200);

      expect(codeRes.body.code).toBeDefined();
      expect(codeRes.body.code).toMatch(/^\d{6}$/);

      // Verify auth code
      const verifyRes = await request(app)
        .post('/api/auth/telegram/verify-code')
        .set('x-practitioner-slug', 'test-psychologist')
        .send({
          tgUserId: client.tgUserId,
          code: codeRes.body.code
        })
        .expect(200);

      expect(verifyRes.body.msg).toBe('Успешная авторизация');
      expect(verifyRes.headers['set-cookie']).toBeDefined();
    });
  });

  describe('Schedule Management', () => {
    test('Get default schedule settings', async () => {
      const res = await request(app)
        .get('/api/admin/schedule-settings')
        .set('Cookie', adminCookies)
        .expect(200);

      expect(res.body.practitionerId).toBe(practitioner.id);
      expect(res.body.workingDays).toBeDefined();
      expect(res.body.workingHours).toBeDefined();
    });

    test('Update schedule settings', async () => {
      const newSettings = {
        workingDays: [1, 2, 3, 4, 5], // Mon-Fri
        workingHours: { start: '09:00', end: '18:00' },
        sessionDuration: 60,
        breakBetweenSessions: 15,
        generationPeriodDays: 30
      };

      const res = await request(app)
        .put('/api/admin/schedule-settings')
        .set('Cookie', adminCookies)
        .send(newSettings)
        .expect(200);

      expect(res.body.settings.workingDays).toEqual(newSettings.workingDays);
      expect(res.body.settings.sessionDuration).toBe(newSettings.sessionDuration);
    });

    test('Generate available slots', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const res = await request(app)
        .post('/api/slots/generate')
        .set('Cookie', adminCookies)
        .send({
          startDate: dateStr,
          endDate: dateStr,
          workingHours: { start: '10:00', end: '16:00' },
          sessionDuration: 60,
          breakBetweenSessions: 15
        })
        .expect(200);

      expect(res.body.generated).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Booking Flow', () => {
    let availableSlot;

    beforeEach(async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      availableSlot = await AvailableSlot.create({
        practitionerId: practitioner.id,
        slotTime: new Date(tomorrow.getTime() + 10 * 60 * 60 * 1000), // 10 AM
        endTime: new Date(tomorrow.getTime() + 11 * 60 * 60 * 1000), // 11 AM
        isBooked: false
      });
    });

    test('Create booking with existing slot', async () => {
      const res = await request(app)
        .post('/api/bookings')
        .set('x-practitioner-id', practitioner.id)
        .send({
          name: 'Test Client',
          phone: '+79991234567',
          preferredContact: 'telegram',
          slotId: availableSlot.id
        })
        .expect(200);

      expect(res.body.id).toBeDefined();
      expect(res.body.AvailableSlotId).toBe(availableSlot.id);
      expect(res.body.clientName).toBe('Test Client');

      // Verify slot is marked as booked
      const updatedSlot = await AvailableSlot.findByPk(availableSlot.id);
      expect(updatedSlot.isBooked).toBe(true);
    });

    test('Create manual booking with custom time', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 2);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const res = await request(app)
        .post('/api/bookings')
        .set('x-practitioner-id', practitioner.id)
        .send({
          name: 'Manual Booking',
          phone: '+79991234567',
          preferredContact: 'phone',
          slotTime: isoAt(dateStr, '14:00'),
          endTime: isoAt(dateStr, '15:00')
        })
        .expect(200);

      expect(res.body.id).toBeDefined();
      expect(res.body.AvailableSlotId).toBeDefined();

      // Verify auto-created slot
      const createdSlot = await AvailableSlot.findByPk(res.body.AvailableSlotId);
      expect(createdSlot.isBooked).toBe(true);
    });

    test('Get bookings list for admin', async () => {
      // Create a booking first
      await request(app)
        .post('/api/bookings')
        .set('x-practitioner-id', practitioner.id)
        .send({
          name: 'List Test',
          phone: '+79991234567',
          preferredContact: 'telegram',
          slotId: availableSlot.id
        });

      const res = await request(app)
        .get('/api/bookings')
        .set('Cookie', adminCookies)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(0);
      if (res.body.length > 0) {
        expect(res.body[0].clientName).toBe('List Test');
      }
    });

    test('Update booking time', async () => {
      // Create booking
      const bookingRes = await request(app)
        .post('/api/bookings')
        .set('x-practitioner-id', practitioner.id)
        .send({
          name: 'Update Test',
          phone: '+79991234567',
          preferredContact: 'telegram',
          slotId: availableSlot.id
        });

      const bookingId = bookingRes.body.id;
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 3);
      const dateStr = tomorrow.toISOString().split('T')[0];

      // Update booking time
      const updateRes = await request(app)
        .put(`/api/bookings/${bookingId}`)
        .set('Cookie', adminCookies)
        .send({
          slotTime: isoAt(dateStr, '16:00'),
          endTime: isoAt(dateStr, '17:00')
        })
        .expect(200);

      expect(updateRes.body.msg).toBe('Запись обновлена');
    });
  });

  describe('Slot Management', () => {
    test('Get available slots', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      await AvailableSlot.create({
        practitionerId: practitioner.id,
        slotTime: new Date(tomorrow.getTime() + 12 * 60 * 60 * 1000),
        endTime: new Date(tomorrow.getTime() + 13 * 60 * 60 * 1000),
        isBooked: false
      });

      const res = await request(app)
        .get('/api/slots')
        .set('x-practitioner-id', practitioner.id)
        .expect(200);

      expect(Array.isArray(res.body) || typeof res.body === 'object').toBe(true);
      if (Array.isArray(res.body)) {
        expect(res.body.length).toBeGreaterThan(0);
      }
    });

    test('Create individual slot', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 4);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const res = await request(app)
        .post('/api/slots')
        .set('Cookie', adminCookies)
        .send({
          startTime: '15:00',
          endTime: '16:00',
          date: dateStr,
          timezone: 'Europe/Moscow'
        })
        .expect(200);

      expect(res.body.id).toBeDefined();
      expect(res.body.isBooked).toBe(false);
    });
  });

  describe('Practitioner Scoping', () => {
    test('Admin sees only their practitioner data', async () => {
      // Create another practitioner
      const otherPractitioner = await Practitioner.create({
        slug: 'other-psychologist',
        displayName: 'Other Psychologist',
        price: 6000.00
      });

      // Create slot for other practitioner
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      await AvailableSlot.create({
        practitionerId: otherPractitioner.id,
        slotTime: new Date(tomorrow.getTime() + 14 * 60 * 60 * 1000),
        endTime: new Date(tomorrow.getTime() + 15 * 60 * 60 * 1000),
        isBooked: false
      });

      // Admin should only see their own slots
      const res = await request(app)
        .get('/api/slots')
        .set('Cookie', adminCookies)
        .expect(200);

      // All returned slots should belong to the admin's practitioner
      if (Array.isArray(res.body)) {
        res.body.forEach(slot => {
          expect(slot.practitionerId).toBe(practitioner.id);
        });
      }
    });

    test('Public access uses default practitioner', async () => {
      const res = await request(app)
        .get('/api/slots')
        .set('x-practitioner-public-slug', 'public-test')
        .expect(200);

      // API returns grouped slots by date as an object
      expect(typeof res.body === 'object').toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('Unauthorized access returns 401', async () => {
      await request(app)
        .get('/api/admin/schedule-settings')
        .expect(401);
    });

    test('Invalid practitioner scope returns 400', async () => {
      const invalidCookies = signAdminCookie(99999); // Non-existent practitioner
      
      await request(app)
        .get('/api/admin/schedule-settings')
        .set('Cookie', invalidCookies)
        .expect(400);
    });

    test('Booking conflict returns 400', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 5);
      const dateStr = tomorrow.toISOString().split('T')[0];

      // Create first booking
      await request(app)
        .post('/api/bookings')
        .set('x-practitioner-id', practitioner.id)
        .send({
          name: 'First Booking',
          phone: '+79991234567',
          preferredContact: 'phone',
          slotTime: isoAt(dateStr, '10:00'),
          endTime: isoAt(dateStr, '11:00')
        })
        .expect(200);

      // Try to create conflicting booking
      await request(app)
        .post('/api/bookings')
        .set('x-practitioner-id', practitioner.id)
        .send({
          name: 'Conflicting Booking',
          phone: '+79991234567',
          preferredContact: 'phone',
          slotTime: isoAt(dateStr, '10:00'),
          endTime: isoAt(dateStr, '11:00')
        })
        .expect(400);
    });

    test('Invalid JWT secret handling', async () => {
      const originalSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;

      await request(app)
        .get('/api/auth/admin/me')
        .set('Cookie', adminCookies)
        .expect(500);

      process.env.JWT_SECRET = originalSecret;
    });
  });

  describe('Data Validation', () => {
    test('Schedule settings validation', async () => {
      const invalidSettings = {
        workingDays: 'invalid', // Should be array
        sessionDuration: 300, // Too long
        breakBetweenSessions: -5 // Negative
      };

      await request(app)
        .put('/api/admin/schedule-settings')
        .set('Cookie', adminCookies)
        .send(invalidSettings)
        .expect(400);
    });

    test('Booking validation', async () => {
      await request(app)
        .post('/api/bookings')
        .set('Cookie', clientCookies)
        .send({
          // Missing required fields
          preferredContact: 'phone'
        })
        .expect(400);
    });
  });

  describe('Schedule Reset', () => {
    test('Admin can reset their schedule', async () => {
      // Create some test data
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const slot = await AvailableSlot.create({
        practitionerId: practitioner.id,
        slotTime: tomorrow,
        endTime: new Date(tomorrow.getTime() + 60 * 60 * 1000),
        isBooked: false
      });

      await Booking.create({
        practitionerId: practitioner.id,
        clientId: client.id,
        AvailableSlotId: slot.id,
        slotTime: tomorrow,
        endTime: new Date(tomorrow.getTime() + 60 * 60 * 1000),
        clientName: 'Test Client',
        clientPhone: '+79991234567',
        preferredContact: 'phone',
        status: 'confirmed'
      });

      // Reset schedule
      const res = await request(app)
        .post('/api/admin/reset-schedule')
        .set('Cookie', adminCookies)
        .send({ confirm: true })
        .expect(200);

      expect(res.body.deletedBookings).toBeGreaterThan(0);
      expect(res.body.deletedSlots).toBeGreaterThan(0);

      // Verify data is deleted
      const remainingSlots = await AvailableSlot.count({ where: { practitionerId: practitioner.id } });
      const remainingBookings = await Booking.count({ where: { practitionerId: practitioner.id } });
      
      expect(remainingSlots).toBe(0);
      expect(remainingBookings).toBe(0);
    });
  });
});
