const express = require('express');
const { body, validationResult } = require('express-validator');
const authMiddleware = require('../middleware/authMiddleware');
const adminOnly = require('../middleware/adminOnly');
const { CallSession, Booking, Client } = require('../models');
const { Op } = require('sequelize');
const { createSession, closeSession, logEvent, resolveBookingContext, ensureGuestTokenLink } = require('../services/callSessionService');
const { getBot } = require('../services/telegramBot');

const router = express.Router();

// POST /api/calls - create a session for a booking (admin only)
router.post(
  '/',
  authMiddleware,
  adminOnly,
  [ body('bookingId').notEmpty().withMessage('bookingId обязателен'), body('ttlMinutes').optional().isInt({ min: 1, max: 90 }) ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const practitionerId = req.practitionerId || (req.user && req.user.practitionerId) || null;
    if (!practitionerId) return res.status(400).json({ msg: 'Не указан арендатор (practitionerId)' });

    const { bookingId, ttlMinutes } = req.body || {};
    try {
      // Resolve client from booking for guest token linking (optional)
      const ctx = await resolveBookingContext(bookingId, practitionerId);
      const result = await createSession({
        bookingId,
        hostId: req.user && req.user.id ? req.user.id : null,
        clientId: ctx.clientId || null,
        practitionerId,
        ttlMinutes: Number.isFinite(ttlMinutes) ? Number(ttlMinutes) : 90,
      });

      try { await logEvent(result.session.id, 'session_created', req.user && req.user.id, { bookingId }); } catch (_) {}

      return res.json({
        id: result.session.id,
        roomId: result.session.roomId,
        expiresAt: result.session.expiresAt,
        status: result.session.status,
        hostUrl: result.host.url,
        guestUrl: result.guest.url,
        ttlMinutes: Math.round((new Date(result.session.expiresAt) - new Date(result.session.startAt)) / 60000)
      });
    } catch (e) {
      return res.status(500).json({ msg: 'Не удалось создать комнату', error: e.message });
    }
  }
);

// GET /api/calls/:id/invite/candidates - list upcoming bookings (admin only)
router.get('/:id/invite/candidates', authMiddleware, adminOnly, async (req, res) => {
  const id = req.params.id;
  try {
    const session = await CallSession.findByPk(id);
    if (!session) return res.status(404).json({ msg: 'Сессия не найдена' });
    const practitionerId = session.practitionerId;
    const now = new Date();
    const from = new Date(now.getTime() - 24 * 3600 * 1000);
    const to = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
    const rows = await Booking.findAll({
      where: {
        practitionerId,
        slotTime: { [Op.gte]: from, [Op.lte]: to },
        status: { [Op.ne]: 'cancelled' },
      },
      include: [{ model: Client, as: 'client' }],
      order: [['slotTime', 'ASC']],
      limit: 100,
    });
    const data = rows.map((b) => ({
      id: b.id,
      clientName: b.clientName,
      slotTime: b.slotTime,
      sourceTimezone: b.sourceTimezone,
      clientId: b.clientId || null,
      telegramUsername: b.telegramUsername || null,
      telegramUserId: b.telegramUserId || (b.client && b.client.tgUserId) || null,
      tgChatId: b.client && b.client.tgChatId || null,
    }));
    return res.json({ rows: data });
  } catch (e) {
    return res.status(500).json({ msg: 'Ошибка получения списка клиентов', error: e.message });
  }
});

// POST /api/calls/:id/invite - send invite to client via Telegram (admin only)
router.post('/:id/invite', authMiddleware, adminOnly, async (req, res) => {
  const id = req.params.id;
  const { bookingId = null, clientId = null } = req.body || {};
  try {
    const session = await CallSession.findByPk(id);
    if (!session) return res.status(404).json({ msg: 'Сессия не найдена' });

    let targetClient = null;
    let targetBooking = null;
    if (bookingId) {
      targetBooking = await Booking.findOne({ where: { id: bookingId, practitionerId: session.practitionerId }, include: [{ model: Client, as: 'client' }] });
      if (!targetBooking) return res.status(404).json({ msg: 'Запись не найдена' });
      if (targetBooking.client) targetClient = targetBooking.client;
    }
    if (!targetClient && clientId) {
      targetClient = await Client.findByPk(clientId);
      if (!targetClient) return res.status(404).json({ msg: 'Клиент не найден' });
    }
    if (!targetClient) return res.status(400).json({ msg: 'Не указан получатель (bookingId или clientId)' });

    // Build guest join link
    const link = await ensureGuestTokenLink(session.id, targetClient.id || null);

    // Update booking.meetLink for convenience
    if (targetBooking) {
      try { await targetBooking.update({ meetLink: link.url }); } catch (_) {}
    }

    // Send via Telegram
    const bot = getBot();
    if (!bot) return res.status(503).json({ msg: 'Telegram бот не запущен' });
    const chatId = targetClient.tgChatId || targetClient.tgUserId;
    if (!chatId) return res.status(400).json({ msg: 'У клиента нет Telegram ID' });

    const dt = targetBooking ? new Date(targetBooking.slotTime) : null;
    let dtStr = '';
    try {
      if (dt) {
        const tz = targetClient.clientTimezone || targetBooking.sourceTimezone || 'Europe/Moscow';
        const dateStr = dt.toLocaleDateString('ru-RU', { timeZone: tz, day: '2-digit', month: '2-digit', year: 'numeric' });
        const timeStr = dt.toLocaleTimeString('ru-RU', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
        dtStr = `${dateStr} ${timeStr}`;
      }
    } catch (_) {}

    const text = dtStr
      ? `🔗 Ваша ссылка на видеосессию (${dtStr}):\n${link.url}`
      : `🔗 Ваша ссылка на видеосессию:\n${link.url}`;
    await bot.telegram.sendMessage(chatId, text, { disable_web_page_preview: true });

    try { await logEvent(id, 'invite_sent', req.user && req.user.id, { bookingId: targetBooking ? targetBooking.id : null, clientId: targetClient.id }); } catch (_) {}
    return res.json({ ok: true, link: link.url });
  } catch (e) {
    return res.status(500).json({ msg: 'Ошибка отправки приглашения', error: e.message });
  }
});

// POST /api/calls/:id/close - close session (admin only)
router.post('/:id/close', authMiddleware, adminOnly, async (req, res) => {
  const id = req.params.id;
  try {
    const s = await closeSession(id);
    if (!s) return res.status(404).json({ msg: 'Сессия не найдена' });
    try { await logEvent(id, 'session_closed', req.user && req.user.id, null); } catch (_) {}
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ msg: 'Ошибка закрытия сессии', error: e.message });
  }
});

// GET /api/calls/:id/status - session status (admin only for now)
router.get('/:id/status', authMiddleware, adminOnly, async (req, res) => {
  const id = req.params.id;
  try {
    const s = await CallSession.findByPk(id);
    if (!s) return res.status(404).json({ msg: 'Сессия не найдена' });
    return res.json({ id: s.id, roomId: s.roomId, status: s.status, startAt: s.startAt, expiresAt: s.expiresAt });
  } catch (e) {
    return res.status(500).json({ msg: 'Ошибка получения статуса', error: e.message });
  }
});

// POST /api/calls/:id/log - stub for participant events (admin only for MVP)
router.post('/:id/log', authMiddleware, adminOnly, [ body('event').notEmpty() ], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const id = req.params.id;
  const { event, metadata = null } = req.body || {};
  try {
    const actorId = req.user && req.user.id ? req.user.id : null;
    await logEvent(id, event, actorId, metadata || null);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ msg: 'Ошибка записи события', error: e.message });
  }
});

module.exports = router;
