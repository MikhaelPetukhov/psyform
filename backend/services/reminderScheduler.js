const cron = require('node-cron');
const { Op } = require('sequelize');
const logger = require('../config/logger');
const { Booking } = require('../models');
const { notifyClientReminder } = require('./telegramBot');
const { enqueueTelegramNotification } = require('./jobQueue');

let reminderTask = null;

// Get reminder window settings from environment or use defaults
function getReminderWindows() {
  const window24h = parseInt(process.env.REMINDER_24H_WINDOW_MIN || '15', 10);
  const window1h = parseInt(process.env.REMINDER_1H_WINDOW_MIN || '5', 10);
  return {
    window24h: Number.isFinite(window24h) && window24h > 0 ? window24h : 15,
    window1h: Number.isFinite(window1h) && window1h > 0 ? window1h : 5,
  };
}

async function runReminderSweepOnce() {
  const now = new Date();
  const { window24h, window1h } = getReminderWindows();
  const batchSize = parseInt(process.env.REMINDER_BATCH_SIZE || '500', 10) || 500;

  try {
    // Calculate time windows
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in1h = new Date(now.getTime() + 1 * 60 * 60 * 1000);

    const window24hStart = new Date(in24h.getTime() - window24h * 60 * 1000);
    const window24hEnd = new Date(in24h.getTime() + window24h * 60 * 1000);
    const window1hStart = new Date(in1h.getTime() - window1h * 60 * 1000);
    const window1hEnd = new Date(in1h.getTime() + window1h * 60 * 1000);

    const baseWhere = {
      status: 'confirmed',
      clientConfirmation: { [Op.ne]: 'declined' },
      clientId: { [Op.ne]: null },
    };

    async function processWindow(range, flagField) {
      let offset = 0;
      let processed = 0;
      let total = 0;
      while (true) {
        const rows = await Booking.findAll({
          where: { ...baseWhere, slotTime: range, [flagField]: { [Op.is]: null } },
          order: [['slotTime', 'ASC']],
          limit: batchSize,
          offset,
        });
        if (!rows || rows.length === 0) break;
        total += rows.length;
        for (const booking of rows) {
          try {
            if (!booking || !booking.clientId || booking.status !== 'confirmed') continue;
            const when = flagField === 'reminder1hSentAt' ? '1h' : '24h';
            // Enqueue reminder; worker will set flags upon success
            await enqueueTelegramNotification('notifyClientReminder', { bookingId: booking.id, when });
            processed += 1;
            logger.info(`[REMINDER] ${when} reminder enqueued for booking ${booking.id}`);
          } catch (e) {
            logger.error(`[REMINDER] Failed to send reminder for booking ${booking?.id}: ${e.message}`);
          }
        }
        if (rows.length < batchSize) break;
        offset += batchSize;
      }
      return { processed, total };
    }

    const w24 = await processWindow({ [Op.between]: [window24hStart, window24hEnd] }, 'reminder24hSentAt');
    const w1 = await processWindow({ [Op.between]: [window1hStart, window1hEnd] }, 'reminder1hSentAt');

    if (w24.processed > 0 || w1.processed > 0) {
      logger.info(`[REMINDER] Sweep complete: ${w24.processed}x24h/${w24.total} and ${w1.processed}x1h/${w1.total} processed (batchSize=${batchSize})`);
    }

    return { sent24h: w24.processed, sent1h: w1.processed, total24h: w24.total, total1h: w1.total };
  } catch (e) {
    logger.error(`[REMINDER] Error during reminder sweep: ${e.message}`);
    return { sent24h: 0, sent1h: 0, total24h: 0, total1h: 0 };
  }
}

function startReminderScheduler() {
  if (process.env.NODE_ENV === 'test') {
    logger.info('[REMINDER] Skipping reminder scheduler in test environment');
    return null;
  }
  
  const cronExpr = process.env.REMINDER_CRON || '*/5 * * * *'; // every 5 minutes by default
  const timezone = process.env.TIMEZONE || 'Europe/Moscow';
  
  try {
    reminderTask = cron.schedule(cronExpr, runReminderSweepOnce, {
      timezone,
      scheduled: false, // Don't start immediately
    });
    
    reminderTask.start();
    logger.info(`[REMINDER] Scheduler started (cron=${cronExpr}, timezone=${timezone})`);
    
    // Graceful shutdown
    process.once('SIGINT', () => {
      if (reminderTask) {
        reminderTask.stop();
        logger.info('[REMINDER] Scheduler stopped (SIGINT)');
      }
    });
    
    process.once('SIGTERM', () => {
      if (reminderTask) {
        reminderTask.stop();
        logger.info('[REMINDER] Scheduler stopped (SIGTERM)');
      }
    });
    
    return reminderTask;
  } catch (e) {
    logger.error(`[REMINDER] Failed to start scheduler: ${e.message}`);
    return null;
  }
}

module.exports = { startReminderScheduler, runReminderSweepOnce };