require('dotenv').config();
const { Sequelize } = require('sequelize');

let sequelize;

const poolConfig = {
  max: parseInt(process.env.DB_POOL_MAX || '10', 10),
  min: parseInt(process.env.DB_POOL_MIN || '0', 10),
  acquire: parseInt(process.env.DB_POOL_ACQUIRE_MS || '30000', 10),
  idle: parseInt(process.env.DB_POOL_IDLE_MS || '10000', 10),
};

// Use in-memory SQLite for tests
if (process.env.NODE_ENV === 'test') {
  sequelize = new Sequelize('sqlite::memory:', {
    logging: false,
  });
} else if (process.env.DATABASE_URL) {
  // Heroku/Docker-style DATABASE_URL environment variable takes precedence
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    protocol: 'postgres',
    dialectOptions: {
      ssl: process.env.NODE_ENV === 'production' ? { require: true, rejectUnauthorized: false } : false
    },
    logging: false,
    pool: poolConfig,
  });
} else {
  // Fallback for local development using .env file
  sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
    host: process.env.DB_HOST,
    dialect: 'postgres',
    logging: false, // Set to console.log to see SQL queries
    pool: poolConfig,
  });
}

module.exports = sequelize;
