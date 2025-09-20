jest.mock('../config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  http: jest.fn(),
}));

const logger = require('../config/logger');

describe('telegramLookup service exports', () => {
  let lookupByPhone;
  let lookupByUsername;

  beforeAll(() => {
    ({ lookupByPhone, lookupByUsername } = require('../services/telegramLookup'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('exports lookupByPhone and lookupByUsername functions', () => {
    expect(typeof lookupByPhone).toBe('function');
    expect(typeof lookupByUsername).toBe('function');
  });

  test('lookupByPhone returns null when service is disabled', async () => {
    const result = await lookupByPhone('+1234567890');
    expect(result).toBeNull();
    expect(logger.info).toHaveBeenCalled();
  });

  test('lookupByUsername returns null when service is disabled', async () => {
    const result = await lookupByUsername('@someone');
    expect(result).toBeNull();
    expect(logger.info).toHaveBeenCalled();
  });
});
