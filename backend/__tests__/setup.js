// Global test setup
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing';
process.env.DATABASE_URL = 'sqlite::memory:';
process.env.TIMEZONE = 'Europe/Moscow';
process.env.REQUIRE_CLIENT_AUTH = 'false';

// Disable external services in tests
process.env.TELEGRAM_DISABLED = 'true';
process.env.WHATSAPP_DISABLED = 'true';

// Set test timeouts
jest.setTimeout(30000);

// Suppress console output during tests unless debugging
if (!process.env.DEBUG_TESTS) {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}
