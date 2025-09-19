const request = require('supertest');
const jwt = require('jsonwebtoken');
const express = require('express');
const cookieParser = require('cookie-parser');
const authMiddleware = require('../middleware/authMiddleware');
const clientAuthMiddleware = require('../middleware/clientAuthMiddleware');
const practitionerScope = require('../middleware/practitionerScope');
const adminOnly = require('../middleware/adminOnly');
const sequelize = require('../config/database');
const { Practitioner } = require('../models');

// Test app setup
const createTestApp = (middleware) => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(practitionerScope);
  app.use(middleware);
  app.get('/test', (req, res) => {
    res.json({ 
      ok: true, 
      user: req.user,
      practitionerId: req.practitionerId,
      adminMissingTenant: req.__adminMissingTenant
    });
  });
  return app;
};

describe('Middleware Tests', () => {
  let practitioner;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.DEFAULT_PRACTITIONER_ID = null;
    process.env.DEFAULT_PRACTITIONER_SLUG = null;
    await sequelize.sync({ force: true });
    
    practitioner = await Practitioner.create({
      slug: 'middleware-test',
      displayName: 'Middleware Test',
      price: 5000.00,
      publicSlug: 'public-middleware'
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('practitionerScope middleware', () => {
    const app = createTestApp((req, res, next) => next());

    test('resolves practitioner from x-practitioner-id header', async () => {
      const res = await request(app)
        .get('/test')
        .set('x-practitioner-id', practitioner.id)
        .expect(200);

      expect(res.body.practitionerId).toBe(practitioner.id);
    });

    test('resolves practitioner from x-practitioner-slug header', async () => {
      const res = await request(app)
        .get('/test')
        .set('x-practitioner-slug', 'middleware-test')
        .expect(200);

      expect(res.body.practitionerId).toBe(practitioner.id);
    });

    test('resolves practitioner from x-practitioner-public-slug header', async () => {
      const res = await request(app)
        .get('/test')
        .set('x-practitioner-public-slug', 'public-middleware')
        .expect(200);

      expect(res.body.practitionerId).toBe(practitioner.id);
    });

    test('enforces admin JWT practitionerId over headers', async () => {
      const adminToken = jwt.sign({
        user: { id: 'admin', role: 'admin', practitionerId: practitioner.id }
      }, 'test-secret');

      const res = await request(app)
        .get('/test')
        .set('Cookie', [`admin_sid=${adminToken}`])
        .set('x-practitioner-id', '999') // Should be ignored
        .expect(200);

      expect(res.body.practitionerId).toBe(practitioner.id);
    });

    test('handles missing practitioner gracefully', async () => {
      const res = await request(app)
        .get('/test')
        .set('x-practitioner-slug', 'nonexistent')
        .expect(200);

      expect(res.body.practitionerId).toBeNull();
    });
  });

  describe('authMiddleware', () => {
    const app = createTestApp(authMiddleware);

    test('accepts valid admin JWT from cookie', async () => {
      const token = jwt.sign({
        user: { id: 'admin', role: 'admin', practitionerId: practitioner.id }
      }, 'test-secret');

      const res = await request(app)
        .get('/test')
        .set('Cookie', [`admin_sid=${token}`])
        .expect(200);

      expect(res.body.user.role).toBe('admin');
    });

    test('accepts valid admin JWT from header', async () => {
      const token = jwt.sign({
        user: { id: 'admin', role: 'admin', practitionerId: practitioner.id }
      }, 'test-secret');

      const res = await request(app)
        .get('/test')
        .set('x-auth-token', token)
        .expect(200);

      expect(res.body.user.role).toBe('admin');
    });

    test('rejects invalid JWT', async () => {
      await request(app)
        .get('/test')
        .set('x-auth-token', 'invalid-token')
        .expect(401);
    });

    test('rejects missing JWT', async () => {
      await request(app)
        .get('/test')
        .expect(401);
    });

    test('handles missing JWT_SECRET', async () => {
      const originalSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;

      await request(app)
        .get('/test')
        .set('x-auth-token', 'any-token')
        .expect(500);

      process.env.JWT_SECRET = originalSecret;
    });
  });

  describe('clientAuthMiddleware', () => {
    const app = createTestApp(clientAuthMiddleware);

    test('accepts valid client JWT from cookie', async () => {
      const token = jwt.sign({
        user: { id: 'client123', role: 'client' }
      }, 'test-secret');

      const res = await request(app)
        .get('/test')
        .set('Cookie', [`client_sid=${token}`])
        .expect(200);

      expect(res.body.user.role).toBe('client');
    });

    test('rejects admin JWT', async () => {
      const token = jwt.sign({
        user: { id: 'admin', role: 'admin' }
      }, 'test-secret');

      await request(app)
        .get('/test')
        .set('Cookie', [`client_sid=${token}`])
        .expect(401);
    });

    test('handles missing JWT_SECRET', async () => {
      const originalSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;

      await request(app)
        .get('/test')
        .set('Cookie', ['client_sid=any-token'])
        .expect(500);

      process.env.JWT_SECRET = originalSecret;
    });
  });

  describe('adminOnly middleware', () => {
    const app = createTestApp((req, res, next) => {
      // Simulate authMiddleware setting req.user
      const token = req.header('x-auth-token') || 
        (req.cookies && (req.cookies.admin_sid || req.cookies.sid_admin));
      
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          req.user = decoded.user;
        } catch (e) {
          return res.status(401).json({ msg: 'Invalid token' });
        }
      }
      
      adminOnly(req, res, next);
    });

    test('allows admin access', async () => {
      const token = jwt.sign({
        user: { id: 'admin', role: 'admin' }
      }, 'test-secret');

      const res = await request(app)
        .get('/test')
        .set('x-auth-token', token)
        .expect(200);

      expect(res.body.ok).toBe(true);
    });

    test('allows super_admin access', async () => {
      const token = jwt.sign({
        user: { id: 'superadmin', role: 'super_admin' }
      }, 'test-secret');

      const res = await request(app)
        .get('/test')
        .set('x-auth-token', token)
        .expect(200);

      expect(res.body.ok).toBe(true);
    });

    test('rejects client access', async () => {
      const token = jwt.sign({
        user: { id: 'client', role: 'client' }
      }, 'test-secret');

      await request(app)
        .get('/test')
        .set('x-auth-token', token)
        .expect(403);
    });

    test('rejects unauthenticated access', async () => {
      await request(app)
        .get('/test')
        .expect(403);
    });
  });

  describe('Integration: Full middleware chain', () => {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(practitionerScope);
    app.use(authMiddleware);
    app.use(adminOnly);
    app.get('/admin-test', (req, res) => {
      res.json({
        ok: true,
        practitionerId: req.practitionerId,
        userRole: req.user.role,
        adminMissingTenant: req.__adminMissingTenant
      });
    });

    test('full admin flow with practitioner scoping', async () => {
      const token = jwt.sign({
        user: { id: 'admin', role: 'admin', practitionerId: practitioner.id }
      }, 'test-secret');

      const res = await request(app)
        .get('/admin-test')
        .set('Cookie', [`admin_sid=${token}`])
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.practitionerId).toBe(practitioner.id);
      expect(res.body.userRole).toBe('admin');
      expect(res.body.adminMissingTenant).toBeUndefined();
    });

    test('admin without practitioner binding', async () => {
      const token = jwt.sign({
        user: { id: 'admin', role: 'admin' } // No practitionerId
      }, 'test-secret');

      const res = await request(app)
        .get('/admin-test')
        .set('Cookie', [`admin_sid=${token}`])
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.practitionerId).toBeNull();
      expect(res.body.adminMissingTenant).toBe(true);
    });
  });
});
