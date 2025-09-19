const logger = require('../config/logger');
const { Queue, Worker } = require('bullmq');
const { notifyNewShortNoticeBooking, notifyPractitionerNewBooking, notifyClientReminder, sendBookingConfirmationRequest } = require('./telegramBot');
const { Booking, Client } = require('../models');

let queue = null;
let worker = null;

function getRedisConnection() {
  const url = process.env.REDIS_URL || '';
  if (!url) return null;
  try {
    const u = new URL(url);
    return { connection: { host: u.hostname, port: parseInt(u.port || '6379', 10), password: u.password || undefined } };
  } catch (_) {
    return { connection: { url } };
  }
}

function isQueueEnabled() {
  // Allow disabling queue in tests or when no Redis
  if (process.env.NODE_ENV === 'test') return false;
  const conn = getRedisConnection();
  return !!conn;
}

function areWorkersEnabled() {
  // По умолчанию — true (синхронизировано с server.js)
  return String(process.env.ENABLE_JOB_WORKERS || 'true').toLowerCase() === 'true';
}

function ensureQueue() {
  if (!isQueueEnabled()) return null;
  if (!queue) {
    const opts = getRedisConnection();
    queue = new Queue('telegram', opts);
  }
  return queue;
}

function ensureWorker() {
  if (!isQueueEnabled()) return null;
  if (!areWorkersEnabled()) return null;
  if (!worker) {
    const concurrency = parseInt(process.env.QUEUE_CONCURRENCY || '5', 10) || 5;
    worker = new Worker('telegram', async (job) => {
      const { name, payload } = job.data || {};
      if (name === 'notifyNewShortNoticeBooking') {
        const bookingId = payload && payload.bookingId;
        if (!bookingId) return;
        const booking = await Booking.findByPk(bookingId);
        if (!booking) return;
        try { await notifyNewShortNoticeBooking(booking); } catch (e) { logger.error(`[QUEUE] notify client error: ${e.message}`); }
      } else if (name === 'notifyPractitionerNewBooking') {
        const bookingId = payload && payload.bookingId;
        if (!bookingId) return;
        const booking = await Booking.findByPk(bookingId);
        if (!booking) return;
        try { await notifyPractitionerNewBooking(booking); } catch (e) { logger.error(`[QUEUE] notify practitioner error: ${e.message}`); }
      } else if (name === 'sendBookingConfirmationRequest') {
        const bookingId = payload && payload.bookingId;
        if (!bookingId) return;
        const booking = await Booking.findByPk(bookingId, { include: [{ model: Client, as: 'client' }] });
        if (!booking) return;
        try { await sendBookingConfirmationRequest(booking); } catch (e) { logger.error(`[QUEUE] confirm request error: ${e.message}`); }
      } else if (name === 'notifyClientReminder') {
        const bookingId = payload && payload.bookingId;
        const when = payload && payload.when;
        if (!bookingId || !when) return;
        const booking = await Booking.findByPk(bookingId);
        if (!booking) return;
        try {
          const success = await notifyClientReminder(booking, when);
          if (success) {
            if (when === '24h') {
              await booking.update({ reminder24hSentAt: new Date() });
            } else if (when === '1h') {
              await booking.update({ reminder1hSentAt: new Date() });
            }
          }
        } catch (e) {
          logger.error(`[QUEUE] notify client reminder error: ${e.message}`);
        }
      }
    }, { ...getRedisConnection(), concurrency });
    worker.on('error', (err) => logger.error(`[QUEUE] Worker error: ${err.message}`));
  }
  return worker;
}

async function enqueueTelegramNotification(name, payload = {}, opts = {}) {
  try {
    const queueEnabled = isQueueEnabled();
    const workersOn = areWorkersEnabled();

    // Если Redis недоступен ИЛИ воркеры выключены — выполнить задачу инлайном,
    // чтобы не было ложного "отправлено", когда фактически никто не обработает задачу
    if (!queueEnabled || !workersOn) {
      try { logger.info(`[QUEUE] inline execution: name=${name} workersOn=${workersOn} queueEnabled=${queueEnabled}`); } catch (_) {}
      // Fallback: call inline to avoid losing notifications in dev/test
      if (name === 'notifyNewShortNoticeBooking') {
        const booking = await Booking.findByPk(payload.bookingId);
        if (booking) try { await notifyNewShortNoticeBooking(booking); } catch (_) {}
      } else if (name === 'notifyPractitionerNewBooking') {
        const booking = await Booking.findByPk(payload.bookingId);
        if (booking) try { await notifyPractitionerNewBooking(booking); } catch (_) {}
      } else if (name === 'sendBookingConfirmationRequest') {
        const booking = await Booking.findByPk(payload.bookingId, { include: [{ model: Client, as: 'client' }] });
        if (booking) try { await sendBookingConfirmationRequest(booking); } catch (_) {}
      } else if (name === 'notifyClientReminder') {
        const booking = await Booking.findByPk(payload.bookingId);
        const when = payload && payload.when;
        if (booking && when) {
          try {
            const success = await notifyClientReminder(booking, when);
            if (success) {
              if (when === '24h') {
                await booking.update({ reminder24hSentAt: new Date() });
              } else if (when === '1h') {
                await booking.update({ reminder1hSentAt: new Date() });
              }
            }
          } catch (_) {}
        }
      }
      return null;
    }
    // Иначе — обычный путь через очередь и воркеры
    const q = ensureQueue();
    const attempts = parseInt(process.env.QUEUE_ATTEMPTS || '5', 10) || 5;
    const backoff = parseInt(process.env.QUEUE_BACKOFF_MS || '3000', 10) || 3000;
    return await q.add('telegram', { name, payload }, { attempts, backoff, removeOnComplete: true, removeOnFail: 50, ...opts });
  } catch (e) {
    logger.error(`[QUEUE] enqueue error: ${e.message}`);
    return null;
  }
}

function startJobWorkers() {
  ensureQueue();
  const w = ensureWorker();
  if (w) logger.info('[QUEUE] Telegram worker initialized');
  else logger.info('[QUEUE] Worker not started (ENABLE_JOB_WORKERS is false); inline fallback will be used');
  return { queue, worker };
}

module.exports = { enqueueTelegramNotification, startJobWorkers };
