import '../api'; // ensure module initializes interceptors

jest.mock('axios', () => {
  const handlers = { req: [] };
  const instance = {
    interceptors: {
      request: {
        use: (fn) => { handlers.req.push(fn); },
      },
      response: { use: () => {} },
    },
    get: (url, cfg = {}) => {
      let config = { url, method: 'get', headers: {}, ...(cfg || {}) };
      for (const h of handlers.req) {
        config = h(config) || config;
      }
      return Promise.resolve({ status: 200, data: {}, config });
    },
  };
  return {
    create: () => instance,
    __instance: instance,
    __handlers: handlers,
  };
});

// re-import after axios mock
const axios = require('axios');
const api = require('../api').default;

describe('api.js interceptors: practitioner and timezone headers', () => {
  beforeEach(() => {
    // reset localStorage
    try { localStorage.clear(); } catch (_) {}
    // window globals
    global.window = global.window || {};
    window.__PRACTITIONER_ID__ = undefined;
    window.__PRACTITIONER_SLUG__ = undefined;
    window.__PRACTITIONER_PUBLIC_SLUG__ = undefined;
  });

  test('sets x-practitioner-id when practitionerId present', async () => {
    try { localStorage.setItem('practitionerId', '123'); } catch (_) {}
    const res = await api.get('/slots');
    expect(res.config.headers['x-practitioner-id']).toBe('123');
  });

  test('sets x-practitioner-slug when practitionerSlug present', async () => {
    try { localStorage.setItem('practitionerSlug', 'sluggy'); } catch (_) {}
    const res = await api.get('/slots');
    expect(res.config.headers['x-practitioner-slug']).toBe('sluggy');
  });

  test('falls back to x-practitioner-public-slug when id/slug absent', async () => {
    try { localStorage.setItem('practitionerPublicSlug', 'form-public'); } catch (_) {}
    const res = await api.get('/slots');
    expect(res.config.headers['x-practitioner-public-slug']).toBe('form-public');
  });

  test('sets x-client-timezone from localStorage', async () => {
    try { localStorage.setItem('clientTimezone', 'Asia/Bangkok'); } catch (_) {}
    const res = await api.get('/anything');
    expect(res.config.headers['x-client-timezone']).toBe('Asia/Bangkok');
  });
});
