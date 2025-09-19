require('dotenv').config();
const logger = require('./config/logger');
const sequelize = require('./config/database');
// Use the pre-configured Express app with middleware, routes and associations
const app = require('./app');

// Start listening immediately (liveness endpoint will work even if DB is not yet ready)
const PORT = process.env.PORT || 5000;
// readiness flag
app.locals = app.locals || {};
app.locals.ready = false;
app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});

// Connect to DB and start optional services with infinite retries (non-fatal)
const connectWithRetry = async () => {
  // Keep trying indefinitely, with a delay between attempts
  // so that the app becomes available ASAP and catches up when DB is ready
  // This prevents long cold starts perceived by users.
  for (;;) {
    try {
      await sequelize.authenticate();
      logger.info('Database connection has been established successfully.');

      // Mark API as ready right after DB connection — остальное (боты/шедулеры) не блокируют ответы API
      try { app.locals.ready = true; } catch (_) {}

      // Запуск необязательных сервисов по флагам окружения (ускоряет локальный старт)
      try {
        if (String(process.env.TELEGRAM_ENABLED).toLowerCase() === 'true') {
          const { startTelegramBot } = require('./services/telegramBot');
          startTelegramBot();
        }
        if (String(process.env.ENABLE_REMINDER_SCHEDULER || 'true').toLowerCase() === 'true') {
          const { startReminderScheduler } = require('./services/reminderScheduler');
          startReminderScheduler();
        }
        if (String(process.env.ENABLE_CLEANUP_SCHEDULER || 'true').toLowerCase() === 'true') {
          const { startCleanupScheduler } = require('./services/cleanupScheduler');
          startCleanupScheduler();
        }
        if (String(process.env.ENABLE_JOB_WORKERS || 'true').toLowerCase() === 'true') {
          const { startJobWorkers } = require('./services/jobQueue');
          startJobWorkers();
        }
      } catch (e) {
        logger.warn(`[Startup] Optional services error: ${e.message}`);
      }
      break; // Connected, leave retry loop
    } catch (err) {
      logger.error(`Unable to connect to the database: ${err.name}`);
      logger.info('Retrying DB connection in 5 seconds...');
      await new Promise(res => setTimeout(res, 5000));
    }
  }
};

// --- Async startup ---
connectWithRetry();

// Graceful shutdown handling: mark as not ready
process.once('SIGTERM', () => { try { app.locals.ready = false; } catch (_) {} });
process.once('SIGINT', () => { try { app.locals.ready = false; } catch (_) {} });
