'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

function buildUrl() {
  const { DATABASE_URL, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME } = process.env;
  if (DATABASE_URL && DATABASE_URL.trim()) return DATABASE_URL;
  if (DB_USER && DB_PASSWORD && DB_HOST && DB_NAME) {
    const port = DB_PORT || '5432';
    return `postgres://${encodeURIComponent(DB_USER)}:${encodeURIComponent(DB_PASSWORD)}@${DB_HOST}:${port}/${DB_NAME}`;
  }
  // Fallback to sensible defaults matching docker-compose (db maps 5433:5432, creds user/password)
  return `postgres://${encodeURIComponent('user')}:${encodeURIComponent('password')}@localhost:5433/psybooking`;
}

// Ensure DATABASE_URL is set for sequelize-cli when using use_env_variable
process.env.DATABASE_URL = buildUrl();

const basePg = {
  dialect: 'postgres',
  logging: false,
};

module.exports = {
  development: {
    ...basePg,
    use_env_variable: 'DATABASE_URL',
    // For local dev, usually no SSL
    dialectOptions: process.env.NODE_ENV === 'production' ? { ssl: { require: true, rejectUnauthorized: false } } : {},
  },
  test: (() => {
    // Default for local Jest: SQLite in-memory
    const wantsPg = !!(process.env.DATABASE_URL || process.env.DB_HOST || process.env.USE_PG_IN_TEST === 'true');
    if (!wantsPg) {
      return {
        dialect: 'sqlite',
        storage: ':memory:',
        logging: false,
      };
    }
    // In Docker or when explicitly requested, use Postgres for test env
    return {
      dialect: 'postgres',
      logging: false,
      use_env_variable: 'DATABASE_URL',
    };
  })(),
  production: {
    ...basePg,
    use_env_variable: 'DATABASE_URL',
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
  },
};
