require('dotenv').config();
const logger = require('./config/logger');
const sequelize = require('./config/database');
const { startTelegramBot } = require('./services/telegramBot');
const { startReminderScheduler } = require('./services/reminderScheduler');
const { startCleanupScheduler } = require('./services/cleanupScheduler');
const { startJobWorkers } = require('./services/jobQueue');
const { scheduleExpirySweep } = require('./services/callSessionService');

(async () => {
  try {
    logger.info('[WORKER] Starting worker process...');
    try {
      await sequelize.authenticate();
      logger.info('[WORKER] Database connection established');
    } catch (e) {
      logger.warn(`[WORKER] DB connection failed: ${e.message}. Continuing if tasks do not need DB...`);
    }

    const webhookOn = String(process.env.TELEGRAM_WEBHOOK_ENABLED || 'false').toLowerCase() === 'true';
    const tgEnabled = String(process.env.TELEGRAM_ENABLED || 'false').toLowerCase() === 'true';
    if (tgEnabled && !webhookOn) {
      startTelegramBot();
      logger.info('[WORKER] Telegram bot started');
    } else if (tgEnabled && webhookOn) {
      logger.info('[WORKER] Telegram bot not started because TELEGRAM_WEBHOOK_ENABLED=true (webhook handled by backend)');
    } else {
      logger.info('[WORKER] Telegram bot disabled by TELEGRAM_ENABLED=false');
    }

    if (String(process.env.ENABLE_REMINDER_SCHEDULER || 'true').toLowerCase() === 'true') {
      startReminderScheduler();
      logger.info('[WORKER] Reminder scheduler started');
    } else {
      logger.info('[WORKER] Reminder scheduler disabled');
    }

    if (String(process.env.ENABLE_CLEANUP_SCHEDULER || 'true').toLowerCase() === 'true') {
      startCleanupScheduler();
      logger.info('[WORKER] Cleanup scheduler started');
    } else {
      logger.info('[WORKER] Cleanup scheduler disabled');
    }

    if (String(process.env.ENABLE_JOB_WORKERS || 'true').toLowerCase() === 'true') {
      startJobWorkers();
      logger.info('[WORKER] Job workers started');
    } else {
      logger.info('[WORKER] Job workers disabled');
    }

    // Periodic sweep for expired call sessions (L3)
    try {
      scheduleExpirySweep();
      logger.info('[WORKER] Calls expiry sweep scheduled');
    } catch (e) {
      logger.warn(`[WORKER] Calls expiry sweep failed to start: ${e.message}`);
    }

    // Keep process alive
    process.once('SIGINT', () => { logger.info('[WORKER] SIGINT'); process.exit(0); });
    process.once('SIGTERM', () => { logger.info('[WORKER] SIGTERM'); process.exit(0); });
  } catch (e) {
    logger.error(`[WORKER] Fatal start error: ${e.message}`);
    process.exit(1);
  }
})();
