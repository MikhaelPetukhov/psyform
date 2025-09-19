const cron = require('node-cron');
const { Op } = require('sequelize');
const logger = require('../config/logger');
const { TgAuthCode, AvailableSlot, Booking } = require('../models');

async function runTgAuthCleanupOnce() {
  const now = new Date();
  try {
    const removed = await TgAuthCode.destroy({
      where: {
        [Op.or]: [
          { usedAt: { [Op.ne]: null } },
          { expiresAt: { [Op.lt]: now } },
        ],
      },
    });
    logger.info(`[CLEANUP] TgAuthCodes removed: ${removed}`);
    return removed;
  } catch (e) {
    logger.error(`[CLEANUP] Error during TgAuthCodes cleanup: ${e.message}`);
    return 0;
  }
}

async function runOldSlotsCleanupOnce() {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  try {
    // Clean up old completed/cancelled bookings first (keep confirmed for history)
    const oldBookings = await Booking.destroy({
      where: {
        slotTime: { [Op.lt]: yesterday },
        status: { [Op.in]: ['completed', 'cancelled'] }
      },
    });
    
    // Clean up ONLY old EMPTY slots (isBooked = false)
    // Keep booked slots for history even if old
    const oldEmptySlots = await AvailableSlot.destroy({
      where: {
        slotTime: { [Op.lt]: yesterday },
        isBooked: false  // Only delete empty slots
      },
    });
    
    logger.info(`[CLEANUP] Old empty slots removed: ${oldEmptySlots}, old completed bookings removed: ${oldBookings}`);
    return { slots: oldEmptySlots, bookings: oldBookings };
  } catch (e) {
    logger.error(`[CLEANUP] Error during old slots cleanup: ${e.message}`);
    return { slots: 0, bookings: 0 };
  }
}

async function runFullCleanup() {
  const tgResults = await runTgAuthCleanupOnce();
  const slotsResults = await runOldSlotsCleanupOnce();
  return { tgCodes: tgResults, ...slotsResults };
}

function startCleanupScheduler() {
  if (process.env.NODE_ENV === 'test') {
    logger.info('[CLEANUP] Skipping cleanup scheduler in test environment');
    return null;
  }
  const cronExpr = process.env.TGCODE_CLEANUP_CRON || '0 * * * *'; // hourly by default
  try {
    const task = cron.schedule(cronExpr, runFullCleanup, {
      timezone: process.env.TIMEZONE || 'Europe/Moscow',
    });
    logger.info(`[CLEANUP] Full cleanup scheduler started (cron=${cronExpr})`);
    return task;
  } catch (e) {
    logger.error(`[CLEANUP] Failed to start scheduler: ${e.message}`);
    return null;
  }
}

module.exports = { 
  startCleanupScheduler, 
  runTgAuthCleanupOnce, 
  runOldSlotsCleanupOnce, 
  runFullCleanup 
};
