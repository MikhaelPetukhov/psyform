'use strict';

const rateLimit = require('express-rate-limit');

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10) || 60000; // 1 minute

const bookingLimiter = rateLimit({
  windowMs,
  max: parseInt(process.env.RATE_LIMIT_BOOKINGS_MAX || '30', 10) || 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { msg: 'Слишком много запросов. Попробуйте позже.' }
});

const slotsLimiter = rateLimit({
  windowMs,
  max: parseInt(process.env.RATE_LIMIT_SLOTS_MAX || '60', 10) || 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { msg: 'Слишком много запросов. Попробуйте позже.' }
});

module.exports = { bookingLimiter, slotsLimiter };
