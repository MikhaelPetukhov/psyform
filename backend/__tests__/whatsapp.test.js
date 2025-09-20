const request = require('supertest');

jest.mock('../middleware/practitionerScope', () => jest.fn((req, res, next) => next()));
jest.mock('../services/whatsappCheck', () => ({
  checkWhatsApp: jest.fn(),
}));

const { checkWhatsApp } = require('../services/whatsappCheck');
const app = require('../app');

describe('GET /api/whatsapp/check', () => {
  it('returns fallback JSON when whatsapp check fails', async () => {
    checkWhatsApp.mockRejectedValueOnce(new Error('service error'));

    const response = await request(app)
      .get('/api/whatsapp/check')
      .query({ phone: '+1234567890' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ configured: true, valid: false });
    expect(checkWhatsApp).toHaveBeenCalledWith('+1234567890');
  });
});
