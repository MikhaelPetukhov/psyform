const express = require('express');
const { body, validationResult } = require('express-validator');
const { Op, Sequelize } = require('sequelize');
const jwt = require('jsonwebtoken');
const { AvailableSlot, Booking, Client } = require('../models');
const logger = require('../config/logger');
const authMiddleware = require('../middleware/authMiddleware');
const adminOnly = require('../middleware/adminOnly');
const clientAuthMiddleware = require('../middleware/clientAuthMiddleware');
const { notifyNewShortNoticeBooking, notifyPractitionerNewBooking, notifyBookingCreated, sendRescheduleNotification } = require('../services/telegramBot');
const { enqueueTelegramNotification } = require('../services/jobQueue');
const { parseTimeInput, formatSlotTime } = require('../utils/timezone');
const sequelize = require('../config/database');
const idempotency = require('../middleware/idempotency');
const { bookingLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

// GET /api/bookings — list bookings (admin-only, scoped by practitioner)
router.get('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    // Filters
    const where = {};
    if (req.practitionerId) where.practitionerId = req.practitionerId;

    const { dateFrom, dateTo, status, confirmed, sortBy, sortDir } = req.query;
    const hasPagingParams =
      typeof req.query.limit !== 'undefined' ||
      typeof req.query.offset !== 'undefined' ||
      typeof dateFrom !== 'undefined' ||
      typeof dateTo !== 'undefined' ||
      typeof status !== 'undefined' ||
      typeof confirmed !== 'undefined' ||
      typeof sortBy !== 'undefined' ||
      typeof sortDir !== 'undefined';
    if (dateFrom || dateTo) {
      where.slotTime = where.slotTime || {};
      if (dateFrom) where.slotTime[Op.gte] = new Date(dateFrom);
      if (dateTo) where.slotTime[Op.lte] = new Date(dateTo);
    }
    if (status) {
      const allowed = new Set(['confirmed', 'cancelled', 'completed']);
      if (allowed.has(String(status))) where.status = String(status);
    }
    if (typeof confirmed !== 'undefined') {
      const v = String(confirmed).toLowerCase();
      if (v === 'true' || v === '1') where.clientConfirmation = 'confirmed';
      else if (v === 'false' || v === '0') where.clientConfirmation = { [Op.ne]: 'confirmed' };
    }

    // Pagination and sorting
    let limit = parseInt(req.query.limit, 10);
    let offset = parseInt(req.query.offset, 10);
    if (!Number.isFinite(limit) || limit <= 0) limit = 50;
    if (!Number.isFinite(offset) || offset < 0) offset = 0;
    if (limit > 200) limit = 200;

    const sortField = ['slotTime', 'createdAt', 'updatedAt'].includes(String(sortBy)) ? String(sortBy) : 'slotTime';
    const sortOrder = String(sortDir || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    if (hasPagingParams) {
      const result = await Booking.findAndCountAll({ where, order: [[sortField, sortOrder]], limit, offset });
      const rows = result.rows || [];
      const bookingsWithTimezone = rows.map(booking => ({
        ...booking.toJSON(),
        timeFormatted: formatSlotTime(booking.slotTime, booking.sourceTimezone || 'Europe/Moscow'),
        endTimeFormatted: formatSlotTime(booking.endTime, booking.sourceTimezone || 'Europe/Moscow')
      }));
      return res.json({
        data: bookingsWithTimezone,
        meta: {
          total: result.count || 0,
          limit,
          offset,
          sortBy: sortField,
          sortDir: sortOrder,
          filters: { dateFrom: dateFrom || null, dateTo: dateTo || null, status: status || null, confirmed: typeof confirmed !== 'undefined' ? String(confirmed) : null }
        }
      });
    }

    // Backward-compatible response without pagination: return array only
    const bookings = await Booking.findAll({ where, order: [[sortField, sortOrder]] });
    const bookingsWithTimezone = bookings.map(booking => ({
      ...booking.toJSON(),
      timeFormatted: formatSlotTime(booking.slotTime, booking.sourceTimezone || 'Europe/Moscow'),
      endTimeFormatted: formatSlotTime(booking.endTime, booking.sourceTimezone || 'Europe/Moscow')
    }));
    return res.json(bookingsWithTimezone);
  } catch (err) {
    logger.error('Error fetching bookings:', err.message);
    logger.error('Stack trace:', err.stack);
    return res.status(500).json({ msg: 'Ошибка загрузки записей', error: err.message });
  }
});

// Alias for tests: PUT /api/bookings/:id to update time
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  const id = req.params.id;
  const { slotTime, endTime } = req.body || {};
  if (!id) return res.status(400).json({ msg: 'Не передан идентификатор записи' });
  if (!slotTime || !endTime) return res.status(400).json({ msg: 'slotTime и endTime обязательны' });
  try {
    const patchRes = await (async () => {
      // Reuse logic by making a fake request object is overkill; duplicate minimal logic
      const where = { id };
      if (req.practitionerId) where.practitionerId = req.practitionerId;
      const booking = await Booking.findOne({ where });
      if (!booking) return { status: 404, body: { msg: 'Запись не найдена' } };
      const start = new Date(slotTime);
      const end = new Date(endTime);
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
        return { status: 400, body: { msg: 'Некорректные дата/время' } };
      }
      // Find or create slot
      let newSlot = await AvailableSlot.findOne({ where: { slotTime: start, endTime: end, practitionerId: req.practitionerId || booking.practitionerId || null } });
      if (!newSlot) newSlot = await AvailableSlot.create({ slotTime: start, endTime: end, isBooked: false, practitionerId: req.practitionerId || booking.practitionerId || null });
      if (newSlot.isBooked && String(newSlot.id) !== String(booking.AvailableSlotId)) {
        return { status: 400, body: { msg: 'Слот уже забронирован' } };
      }
      // Free old slot
      if (booking.AvailableSlotId && String(booking.AvailableSlotId) !== String(newSlot.id)) {
        const old = await AvailableSlot.findByPk(booking.AvailableSlotId);
        if (old) { old.isBooked = false; await old.save(); }
      }
      newSlot.isBooked = true; await newSlot.save();
      await booking.update({ slotTime: start, endTime: end, AvailableSlotId: newSlot.id, clientConfirmation: 'pending', reminderSentAt: null, reminder24hSentAt: null, reminder1hSentAt: null });
      return { status: 200, body: { msg: 'Запись обновлена', booking } };
    })();
    return res.status(patchRes.status).json(patchRes.body);
  } catch (e) {
    return res.status(500).send('Server Error');
  }
});

// GET /api/bookings/clients?q= — admin-only client suggestions for manual booking modal
router.get('/clients', authMiddleware, adminOnly, async (req, res) => {
  try {
    const qRaw = (req.query.q || '').trim();
    if (!qRaw || qRaw.length < 2) return res.json([]);
    const q = qRaw.replace(/^@/, '');

    // Build where clauses
    const bookingWhere = {
      [Op.or]: [
        { clientName: { [Op.like]: `%${q}%` } },
        { clientPhone: { [Op.like]: `%${q}%` } },
        { clientTelegram: { [Op.like]: `%${q}%` } },
        { telegramUsername: { [Op.like]: `%${q}%` } },
      ],
    };
    if (req.practitionerId) bookingWhere.practitionerId = req.practitionerId;

    const clientWhere = {
      [Op.or]: [
        { firstName: { [Op.like]: `%${q}%` } },
        { lastName: { [Op.like]: `%${q}%` } },
        { tgUsername: { [Op.like]: `%${q}%` } },
        { tgPhone: { [Op.like]: `%${q}%` } },
      ],
    };
    if (req.practitionerId) clientWhere.practitionerId = req.practitionerId;

    const [bookings, clients] = await Promise.all([
      Booking.findAll({ where: bookingWhere, limit: 10, order: [['updatedAt', 'DESC']] }),
      Client.findAll({ where: clientWhere, limit: 10, order: [['updatedAt', 'DESC']] }),
    ]);

    const suggestions = [];

    // From bookings history
    for (const b of bookings) {
      const tel = (b.telegramUsername || b.clientTelegram || '') || '';
      suggestions.push({
        name: b.clientName || '',
        phone: b.clientPhone || null,
        telegram: tel.replace(/^@/, '') || null,
      });
    }

    // From known clients
    for (const c of clients) {
      const name = `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.tgUsername || 'Клиент';
      suggestions.push({
        name,
        phone: c.tgPhone || null,
        telegram: (c.tgUsername || '').replace(/^@/, '') || null,
      });
    }

    // Deduplicate by name|phone|telegram
    const seen = new Set();
    const uniq = [];
    for (const s of suggestions) {
      const key = `${(s.name || '').toLowerCase()}|${(s.phone || '').replace(/\D/g, '')}|${(s.telegram || '').toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      uniq.push(s);
      if (uniq.length >= 10) break;
    }

    return res.json(uniq);
  } catch (err) {
    return res.status(500).send('Server Error');
  }
});

router.post(
  '/',
  idempotency('bookings'),
  bookingLimiter,
  [
    body('name').notEmpty().withMessage('name обязателен'),
    body('preferredContact')
      .optional()
      .isIn(['whatsapp', 'telegram', 'phone'])
      .withMessage('preferredContact должен быть whatsapp/telegram/phone'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        name,
        phone,
        telegram,
        comment,
        preferredContact = 'phone',
        slotId,
        slotTime,
        endTime,
      } = req.body || {};

      if (!slotId && (!slotTime || !endTime)) {
        return res
          .status(400)
          .json({ errors: [{ msg: 'Нужно передать либо slotId, либо slotTime и endTime' }] });
      }

      let start = null;
      let end = null;
      let slot = null;
      // Determine practitioner scope: start from request, may be overridden by slot owner
      let effectivePractitionerId = req.practitionerId || null;

      if (slotId) {
        slot = await AvailableSlot.findByPk(slotId);
        if (!slot) return res.status(400).json({ msg: 'Слот не найден' });
        if (slot.isBooked) return res.status(400).json({ msg: 'Слот уже забронирован' });
        if (req.practitionerId && String(slot.practitionerId) !== String(req.practitionerId)) {
          return res.status(403).json({ msg: 'Нельзя использовать слот другого психолога' });
        }
        start = new Date(slot.slotTime);
        end = new Date(slot.endTime);
        // Use slot's tenant to ensure booking belongs to the same practitioner
        effectivePractitionerId = slot.practitionerId;
      } else {
        start = new Date(slotTime);
        end = new Date(endTime);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          return res.status(400).json({ msg: 'Некорректные дата/время' });
        }
        if (end <= start) {
          return res.status(400).json({ msg: 'Время окончания должно быть позже начала' });
        }

        // Require explicit tenant when creating by time (no slotId)
        if (!effectivePractitionerId) {
          return res.status(400).json({ msg: 'Не указан арендатор (practitionerId). Передайте x-practitioner-id или x-practitioner-slug' });
        }

        // Idempotency first: if a booking with same (tenant, slotTime, endTime) was created recently, return it
        if (req.idempotencyKey) {
          const ttlSec = req.idempotencyTtl || 300;
          const since = new Date(Date.now() - ttlSec * 1000);
          const same = await Booking.findOne({ where: { practitionerId: effectivePractitionerId, slotTime: start, endTime: end, createdAt: { [Op.gte]: since } } });
          if (same) {
            return res.json(same);
          }
        }

        const conflictWhere = { slotTime: start };
        if (effectivePractitionerId) conflictWhere.practitionerId = effectivePractitionerId;
        const conflictBooking = await Booking.findOne({ where: conflictWhere });
        if (conflictBooking) {
          return res.status(400).json({ msg: 'На это время уже есть запись' });
        }

        const slotWhere = { slotTime: start, endTime: end };
        if (effectivePractitionerId) slotWhere.practitionerId = effectivePractitionerId;
        slot = await AvailableSlot.findOne({ where: slotWhere });

        if (!slot) {
          slot = await AvailableSlot.create({
            slotTime: start,
            endTime: end,
            isBooked: false,
            practitionerId: effectivePractitionerId,
          });
        } else if (slot.isBooked) {
          return res.status(400).json({ msg: 'Слот уже забронирован' });
        }
      }

      // (idempotency for slotId path runs earlier in this function when start/end resolved)

      const existingWhere = { slotTime: start };
      if (effectivePractitionerId) existingWhere.practitionerId = effectivePractitionerId;
      const existingBooking = await Booking.findOne({ where: existingWhere });
      if (existingBooking) {
        return res.status(400).json({ msg: 'На это время уже есть запись' });
      }

      // Extract tokens (HttpOnly cookies preferred)
      let clientId = null;
      let isAdmin = false;
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        return res.status(500).json({ msg: 'Server configuration error' });
      }
      try {
        const hdr = req.header('x-auth-token');
        const clientSid = req.cookies && (req.cookies.client_sid || req.cookies.sid);
        const token = clientSid || hdr || null;
        if (token) {
          const decoded = jwt.verify(token, jwtSecret);
          if (decoded && decoded.client && decoded.client.id) {
            clientId = decoded.client.id;
          }
          if (decoded && decoded.user && ['admin', 'super_admin'].includes(decoded.user.role)) {
            isAdmin = true;
          }
        }
      } catch (_) { /* ignore */ }
      // Detect admin token from cookies explicitly (backward compatibility)
      try {
        const at = (req.cookies && (req.cookies.admin_sid || req.cookies.sid_admin)) || null;
        if (at) {
          const dec = jwt.verify(at, jwtSecret);
          if (dec && dec.user && ['admin', 'super_admin'].includes(dec.user.role)) {
            isAdmin = true;
          }
        }
      } catch (_) { /* ignore */ }

      // Admin-created bookings should never attach foreign clientId (avoid FK violations)
      if (isAdmin) {
        clientId = null;
      }

      // Public auth requirements (relaxed in tests)
      const requireClient = (process.env.REQUIRE_CLIENT_AUTH || '').toLowerCase() === 'true';
      try {
        logger.info(`[bookings] auth check: isAdmin=${isAdmin} clientId=${clientId ? 'yes' : 'no'} requireClient=${requireClient} hdrToken=${req.header('x-auth-token') ? 'yes' : 'no'} cookie.admin_sid=${req.cookies && (req.cookies.admin_sid || req.cookies.sid_admin) ? 'yes' : 'no'} cookie.client_sid=${req.cookies && (req.cookies.client_sid || req.cookies.sid) ? 'yes' : 'no'} scope.practitionerId=${req.practitionerId || 'null'}`);
      } catch (_) { /* ignore logging errors */ }
      if (!isAdmin) {
        if (requireClient) {
          if (!clientId) {
            try { logger.warn('[bookings] 401 require client auth: no clientId and not admin'); } catch (_) {}
            return res.status(401).json({ msg: 'Требуется вход через Telegram. Авторизуйтесь и повторите попытку.' });
          }
          const client = await Client.findByPk(clientId);
          if (!client) return res.status(401).json({ msg: 'Сессия недействительна. Авторизуйтесь повторно.' });
          if (!client.tgPhone) return res.status(403).json({ msg: 'Для бронирования подтвердите номер через Telegram.' });
        } else {
          // If not required, allow anonymous in tests/dev; enforce only in production strictly via env var
          if (!clientId && process.env.NODE_ENV === 'production') {
            return res.status(403).json({ msg: 'Для бронирования подтвердите номер через Telegram (или WhatsApp).' });
          }
        }
      }

      const normalizedPhone = phone ? String(phone).replace(/\D/g, '') : null;
      // Resolve client's display timezone from header (fallback to Europe/Moscow)
      let sourceTimezone = (req.header('x-client-timezone') || '').trim();
      if (!sourceTimezone) sourceTimezone = 'Europe/Moscow';
      try { logger.info(`[bookings] client sourceTimezone=${sourceTimezone}`); } catch (_) {}
      const booking = await Booking.create({
        clientName: name,
        clientPhone: normalizedPhone,
        clientTelegram: telegram || null,
        comment: comment || null,
        preferredContact,
        clientId: isAdmin ? null : (clientId || null),
        slotTime: start,
        endTime: end,
        AvailableSlotId: slot.id,
        sourceTimezone,
        source: isAdmin ? 'manual' : 'online_form',
        practitionerId: effectivePractitionerId,
      });

      slot.isBooked = true;
      await slot.save();

      // Reload booking to get the updated clientId from linking step above
      await booking.reload();

      // Try to resolve and link an existing Telegram client by handle or phone for notifications
      try {
        if (!booking.clientId) {
          let linked = null;
          if (telegram) {
            const handle = String(telegram).trim().replace(/^@/, '').toLowerCase();
            if (handle) {
              linked = await Client.findOne({ where: {
                [Op.and]: [
                  Sequelize.where(Sequelize.fn('lower', Sequelize.col('tgUsername')), handle),
                  { practitionerId: { [Op.in]: [effectivePractitionerId || null, null] } }
                ]
              }});
            }
          }
          if (!linked && phone) {
            const digits = String(phone).replace(/\D/g, '');
            if (digits) {
              linked = await Client.findOne({ where: { tgPhone: digits, practitionerId: { [Op.in]: [effectivePractitionerId || null, null] } } });
            }
          }
          if (linked) {
            await booking.update({ clientId: linked.id });
          }
        }
      } catch (_) { /* ignore linking errors */ }

      // Send client confirmation prompt (always, if we know client's Telegram)
      try {
        if (booking.clientId) {
          // Queue notification to client
          try { await enqueueTelegramNotification('notifyNewShortNoticeBooking', { bookingId: booking.id }); } catch (_) {}
        } else if (isAdmin && (telegram || phone)) {
          // For admin-created bookings, try to find client by telegram/phone and notify
          let targetClient = null;
          if (telegram) {
            const handle = String(telegram).trim().replace(/^@/, '').toLowerCase();
            if (handle) {
              targetClient = await Client.findOne({ where: { tgUsername: handle, practitionerId: effectivePractitionerId || null } });
            }
          }
          if (!targetClient && phone) {
            const digits = String(phone).replace(/\D/g, '');
            if (digits) {
              targetClient = await Client.findOne({ where: { tgPhone: digits, practitionerId: effectivePractitionerId || null } });
            }
          }
          if (targetClient && targetClient.tgChatId) {
            // Create temporary booking object with clientId for notification (direct fallback)
            const tempBooking = { ...booking.toJSON(), clientId: targetClient.id };
            try { await notifyNewShortNoticeBooking(tempBooking); } catch (_) {}
          }
        }
      } catch (_) { /* ignore telegram errors to not break booking creation */ }

      // Notify practitioner about the new booking via queue
      try { await enqueueTelegramNotification('notifyPractitionerNewBooking', { bookingId: booking.id }); } catch (_) { /* ignore */ }

      return res.json(booking);
    } catch (err) {
      try {
        logger.error(`[bookings] create failed: ${err?.name || 'Error'} ${err?.message || ''}`);
      } catch (_) { /* ignore */ }
      // Do not leak internals to public; admin UI will show msg and error
      return res.status(500).json({ msg: 'Ошибка при создании записи', error: err?.message || 'Internal error' });
    }
  }
);

// PATCH /api/bookings/:id/reschedule — move booking to another slot
router.patch('/:id/reschedule', authMiddleware, adminOnly, async (req, res) => {
  const id = req.params.id;
  const { slotId, slotTime, endTime } = req.body || {};
  if (!id) return res.status(400).json({ msg: 'Не передан идентификатор записи' });
  if (!slotId && (!slotTime || !endTime)) {
    return res.status(400).json({ msg: 'Нужно передать либо slotId, либо slotTime и endTime' });
  }

  const t = await sequelize.transaction();
  try {
    const where = { id };
    if (req.practitionerId) where.practitionerId = req.practitionerId;
    const booking = await Booking.findOne({
      where,
      transaction: t,
      include: [{ model: Client, as: 'client' }],
    });
    if (!booking) {
      await t.rollback();
      return res.status(404).json({ msg: 'Запись не найдена' });
    }

    const oldSlotId = booking.AvailableSlotId ? String(booking.AvailableSlotId) : null;
    const oldStart = booking.slotTime ? new Date(booking.slotTime) : null;
    const oldEnd = booking.endTime ? new Date(booking.endTime) : null;
    const effectivePractitionerId = req.practitionerId || booking.practitionerId || null;

    let newSlot = null;
    let start = null;
    let end = null;

    if (slotId) {
      newSlot = await AvailableSlot.findByPk(slotId, { transaction: t });
      if (!newSlot) {
        await t.rollback();
        return res.status(400).json({ msg: 'Слот не найден' });
      }
      if (effectivePractitionerId && String(newSlot.practitionerId) !== String(effectivePractitionerId)) {
        await t.rollback();
        return res.status(403).json({ msg: 'Нельзя использовать слот другого психолога' });
      }
      if (newSlot.isBooked && (!oldSlotId || String(newSlot.id) !== oldSlotId)) {
        await t.rollback();
        return res.status(400).json({ msg: 'Слот уже забронирован' });
      }
      start = new Date(newSlot.slotTime);
      end = new Date(newSlot.endTime);
    } else {
      start = new Date(slotTime);
      end = new Date(endTime);
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
        await t.rollback();
        return res.status(400).json({ msg: 'Некорректные дата/время' });
      }

      const slotWhere = { slotTime: start, endTime: end };
      if (effectivePractitionerId) slotWhere.practitionerId = effectivePractitionerId;
      newSlot = await AvailableSlot.findOne({ where: slotWhere, transaction: t });
      if (!newSlot) {
        newSlot = await AvailableSlot.create(
          { slotTime: start, endTime: end, isBooked: false, practitionerId: effectivePractitionerId },
          { transaction: t }
        );
      }
      if (newSlot.isBooked && (!oldSlotId || String(newSlot.id) !== oldSlotId)) {
        await t.rollback();
        return res.status(400).json({ msg: 'Слот уже забронирован' });
      }
    }

    if (oldSlotId && oldSlotId !== String(newSlot.id)) {
      const oldSlot = await AvailableSlot.findByPk(oldSlotId, { transaction: t });
      if (oldSlot) {
        oldSlot.isBooked = false;
        await oldSlot.save({ transaction: t });
      }
    }

    newSlot.isBooked = true;
    await newSlot.save({ transaction: t });

    await booking.update(
      {
        slotTime: start,
        endTime: end,
        AvailableSlotId: newSlot.id,
        clientConfirmation: 'pending',
        reminderSentAt: null,
        reminder24hSentAt: null,
        reminder1hSentAt: null,
      },
      { transaction: t }
    );

    await t.commit();

    try {
      await booking.reload({ include: [{ model: Client, as: 'client' }] });
    } catch (_) { /* ignore reload errors */ }

    if (oldStart && oldEnd && booking.client && (booking.client.tgUserId || booking.client.tgChatId)) {
      try {
        await sendRescheduleNotification(booking, oldStart, oldEnd);
      } catch (notifyErr) {
        try { logger.warn(`Failed to send reschedule notification for booking ${booking.id}: ${notifyErr.message}`); } catch (_) {}
      }
    }

    try { await notifyNewShortNoticeBooking(booking); } catch (_) {}
    try { await notifyPractitionerNewBooking(booking); } catch (_) {}

    return res.json(booking);
  } catch (e) {
    try { await t.rollback(); } catch (_) {}
    return res.status(500).send('Server Error');
  }
});

// DELETE /api/bookings/:id — delete a booking (admin-only, scoped by practitioner)
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  const id = req.params.id;
  if (!id) return res.status(400).json({ msg: 'Не передан идентификатор записи' });
  const t = await sequelize.transaction();
  try {
    const where = { id };
    if (req.practitionerId) where.practitionerId = req.practitionerId;
    const booking = await Booking.findOne({ where, transaction: t });
    if (!booking) {
      await t.rollback();
      return res.status(404).json({ msg: 'Запись не найдена' });
    }

    if (booking.AvailableSlotId) {
      const slot = await AvailableSlot.findByPk(booking.AvailableSlotId, { transaction: t });
      if (slot) {
        slot.isBooked = false;
        await slot.save({ transaction: t });
      }
    }

    await booking.destroy({ transaction: t });
    await t.commit();
    return res.json({ ok: true });
  } catch (e) {
    try { await t.rollback(); } catch (_) { /* ignore */ }
    return res.status(500).send('Server Error');
  }
});

// POST /api/bookings/:id/send-confirmation — send confirmation request to client
router.post('/:id/send-confirmation', authMiddleware, adminOnly, async (req, res) => {
  try {
    const bookingId = req.params.id;
    const practitionerId = req.practitionerId;

    const booking = await Booking.findOne({
      where: { 
        id: bookingId,
        practitionerId: practitionerId 
      },
      include: [{ model: Client, as: 'client' }]
    });

    if (!booking) {
      logger.warn(`Booking not found: ${bookingId} for practitioner ${practitionerId}`);
      return res.status(404).json({ msg: 'Запись не найдена' });
    }

    // Try to attach a client if missing (admin-created booking fallback)
    if (!booking.client) {
      try {
        const handle = String(booking.telegramUsername || booking.clientTelegram || '')
          .trim()
          .replace(/^@/, '')
          .toLowerCase();
        try { logger.info(`[bookings] send-confirmation attach: booking=${bookingId} handle=${handle || '-'} phoneRaw=${booking.clientPhone || '-'} practitionerId=${practitionerId || '-'}`); } catch (_) {}
        let client = null;
        if (handle) {
          client = await Client.findOne({ where: { tgUsername: handle, practitionerId: { [Op.in]: [practitionerId, null] } } });
        }
        if (!client) {
          const digits = String(booking.clientPhone || '').replace(/\D/g, '');
          if (digits) {
            client = await Client.findOne({ where: { tgPhone: digits, practitionerId: { [Op.in]: [practitionerId, null] } } });
          }
        }
        if (!client && booking.telegramUserId) {
          client = await Client.findOne({ where: { tgUserId: String(booking.telegramUserId), practitionerId: { [Op.in]: [practitionerId, null] } } });
        }
        if (client) {
          // If client was global (practitionerId=null), attach it to current practitioner for future lookups
          if (!client.practitionerId && practitionerId) {
            try {
              await client.update({ practitionerId });
              try { logger.info(`[bookings] send-confirmation attach: set client.practitionerId=${practitionerId} for clientId=${client.id}`); } catch (_) {}
            } catch (e) {
              logger.warn(`[bookings] send-confirmation attach: failed to set practitionerId for clientId=${client.id}: ${e.message}`);
            }
          }
          await booking.update({ clientId: client.id });
          booking.client = client;
          try { logger.info(`[bookings] send-confirmation attach: linked clientId=${client.id} tgUserId=${client.tgUserId || '-'} tgChatId=${client.tgChatId || '-'}`); } catch (_) {}
        }
      } catch (e) {
        logger.warn(`Failed to auto-link client for booking ${bookingId}: ${e.message}`);
      }
    }

    if (!booking.client) {
      // Informative message: user must start bot or login so we have tgChatId
      try { logger.warn(`[bookings] send-confirmation: no client linked for booking=${bookingId}, practitionerId=${practitionerId}`); } catch (_) {}
      return res.status(400).json({ 
        msg: 'Клиент не найден в Telegram. Попросите клиента открыть бота и авторизоваться, затем повторите отправку.' 
      });
    }

    // Log client details for debugging
    logger.info(`Client details for booking ${bookingId}: name=${booking.client.clientName}, tgUserId=${booking.client.tgUserId}, tgChatId=${booking.client.tgChatId}`);

    if (!booking.client.tgUserId && !booking.client.tgChatId) {
      logger.warn(`Client ${booking.client.clientName} (booking ${bookingId}) has no Telegram ID (tgUserId/tgChatId missing)`);
      return res.status(400).json({ 
        msg: 'У клиента нет Telegram ID. Клиент должен начать диалог с ботом и авторизоваться, после чего вы сможете отправить запрос.' 
      });
    }

    // Enqueue confirmation request to be processed by worker (where bot is running)
    try {
      try { logger.info(`[bookings] enqueue sendBookingConfirmationRequest: booking=${bookingId}`); } catch (_) {}
      await enqueueTelegramNotification('sendBookingConfirmationRequest', { bookingId });
    } catch (e) {
      logger.warn(`Failed to enqueue confirmation request for booking ${bookingId}: ${e.message}`);
    }

    // Здесь мы только ставим задачу в очередь (или исполняем инлайном, если воркеры отключены).
    // Поэтому фиксируем формулировку как queued/inline, чтобы не вводить в заблуждение.
    logger.info(`Confirmation request queued/inline for booking ${bookingId} to client ${booking.client.tgUserId}`);
    
    return res.json({ ok: true, msg: 'Запрос на подтверждение поставлен в очередь' });

  } catch (e) {
    logger.error('Error sending confirmation request:', e);
    return res.status(500).json({ msg: 'Ошибка при отправке запроса' });
  }
});

module.exports = router;