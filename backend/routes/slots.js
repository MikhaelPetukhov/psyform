const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { addDays, addMinutes, isAfter, isBefore, isEqual, parse, startOfDay, format } = require('date-fns');
const logger = require('../config/logger');
const authMiddleware = require('../middleware/authMiddleware');
const adminOnly = require('../middleware/adminOnly');
const { ScheduleSetting, AvailableSlot, Booking } = require('../models');
const sequelize = require('../config/database');
const { parseTimeInput, formatSlotTime, createTimeRange, isValidTimezone } = require('../utils/timezone');
const idempotency = require('../middleware/idempotency');
const { slotsLimiter } = require('../middleware/rateLimiters');
const { DateTime } = require('luxon');

// @route   POST api/slots/generate
// @desc    Generate available time slots based on schedule settings
// @access  Private
router.post('/generate', authMiddleware, adminOnly, slotsLimiter, async (req, res) => {
  logger.info('POST /api/slots/generate request received');
  try {
    const practitionerId = req.practitionerId;
    if (!practitionerId) {
      return res.status(400).json({ msg: 'Не указан арендатор (practitionerId). Передайте x-practitioner-id или x-practitioner-slug' });
    }

    // Get practitioner to use their timezone
    const { Practitioner } = require('../models');
    const practitioner = await Practitioner.findByPk(practitionerId);
    if (!practitioner) {
      return res.status(404).json({ msg: 'Психолог не найден' });
    }

    let settings = await ScheduleSetting.findOne({ where: { practitionerId } });
    if (!settings) {
      // Create default settings for this practitioner if missing
      settings = await ScheduleSetting.create({ practitionerId });
    }

    const {
      workingDays = [1, 2, 3, 4, 5],
      workingHours = { start: '09:00', end: '18:00' },
      sessionDuration = 60,
      breakBetweenSessions = 15,
      lunchBreak = { enabled: false },
      generationPeriodDays = 30, // Default to 30 days
    } = settings.toJSON();

    const { start: startTime, end: endTime } = workingHours;
    // Use practitioner's timezone instead of global env
    const tz = practitioner.timezone || 'Europe/Moscow';
    const { enabled: lunchEnabled, start: lunchStart, end: lunchEnd } = lunchBreak;

    logger.info('Using settings for generation:', { workingDays, workingHours, sessionDuration, breakBetweenSessions, lunchBreak, generationPeriodDays });

    // Начальная точка генерации — полночь СЕГОДНЯ в таймзоне психолога
    const today = DateTime.now().setZone(tz).startOf('day').toJSDate();

    // 1. Clear future, unbooked slots to prevent duplicates
    const destroyedCount = await AvailableSlot.destroy({
      where: {
        slotTime: { [Op.gte]: today },
        isBooked: false,
        practitionerId,
      },
    });
    logger.info(`Cleared ${destroyedCount} old unbooked slots.`);

    // 2. Fetch all future bookings to check for conflicts
    const futureBookings = await Booking.findAll({
      where: {
        slotTime: { [Op.gte]: today },
        practitionerId,
      },
    });
    logger.info(`Found ${futureBookings.length} future bookings to check for conflicts.`);

    const newSlots = [];
    const generationEndDate = addDays(today, generationPeriodDays);

    // 3. Loop through each day in the generation period
    for (let currentDate = today; isBefore(currentDate, generationEndDate); currentDate = addDays(currentDate, 1)) {
      // ВАЖНО: день недели считаем в таймзоне психолога, иначе для зон c большим смещением возможен сдвиг «через день»
      const dayOfWeek = DateTime.fromJSDate(currentDate, { zone: tz }).weekday % 7; // Mon..Sun => 1..7, приводим к 0..6 (Вс=0)

      if (workingDays.includes(dayOfWeek)) {
        let currentTime = parse(startTime, 'HH:mm', currentDate);
        const endOfDay = parse(endTime, 'HH:mm', currentDate);
        const lunchStartTime = lunchEnabled ? parse(lunchStart, 'HH:mm', currentDate) : null;
        const lunchEndTime = lunchEnabled ? parse(lunchEnd, 'HH:mm', currentDate) : null;

        while (isBefore(currentTime, endOfDay)) {
          const slotEndTime = addMinutes(currentTime, sessionDuration);

          if (isAfter(slotEndTime, endOfDay)) {
            break;
          }

          // Обед — полуоткрытый интервал [start, end):
          // слот, заканчивающийся ровно в lunchStart, разрешён.
          const isDuringLunch = lunchEnabled && (
            currentTime < lunchEndTime && slotEndTime > lunchStartTime
          );

          // Convert to UTC for storage/compare using configured timezone
          // Ключ даты считаем в таймзоне психолога, иначе возможен сдвиг даты
          const dateKey = DateTime.fromJSDate(currentDate, { zone: tz }).toFormat('yyyy-MM-dd');
          const startStr = format(currentTime, 'HH:mm');
          const endStr = format(slotEndTime, 'HH:mm');
          const slotStartUTC = parseTimeInput(startStr, dateKey, tz);
          const slotEndUTC = parseTimeInput(endStr, dateKey, tz);

          // Conflict: equality on start is sufficient for generated grid
          const isConflict = futureBookings.some(booking => isEqual(booking.slotTime, slotStartUTC));

          if (!isDuringLunch && !isConflict) {
            newSlots.push({
              slotTime: slotStartUTC,
              endTime: slotEndUTC,
              sourceTimezone: tz,
              isBooked: false,
              practitionerId,
            });
          }

          currentTime = addMinutes(slotEndTime, breakBetweenSessions);
        }
      }
    }

    // 4. Bulk insert all new slots
    if (newSlots.length > 0) {
      await AvailableSlot.bulkCreate(newSlots);
      logger.info(`Successfully created ${newSlots.length} new available slots.`);
    } else {
      logger.info('No new slots were generated based on the current settings and conflicts.');
    }

    res.json({ msg: `Successfully generated ${newSlots.length} new slots.`, generated: newSlots.length });
  } catch (err) {
    logger.error(`Error during slot generation: ${err.message}`, { stack: err.stack });
    res.status(500).send('Server Error');
  }
});

// @route   GET api/slots
// @desc    Get all available (future, not booked) slots
// @access  Public
router.get('/', async (req, res) => {
  logger.info('GET /api/slots request received');
  try {
    const hasPagingParams =
      typeof req.query.limit !== 'undefined' ||
      typeof req.query.offset !== 'undefined' ||
      typeof req.query.day !== 'undefined' ||
      typeof req.query.dateFrom !== 'undefined' ||
      typeof req.query.dateTo !== 'undefined' ||
      String(req.query.short || '').toLowerCase() === 'true';

    const practitionerId = req.practitionerId;
    if (!practitionerId) {
      const message = req.__adminMissingTenant
        ? 'Администратор должен указать психолога через заголовок x-practitioner-id или x-practitioner-slug'
        : 'Не указан арендатор (practitionerId). Передайте x-practitioner-id или x-practitioner-slug';
      logger.warn(`GET /api/slots without practitionerId; returning 400`);
      return res.status(400).json({ msg: message });
    }

    const baseWhere = { isBooked: false, practitionerId };

    // Date filters
    const now = new Date();
    baseWhere.slotTime = baseWhere.slotTime || {};
    baseWhere.slotTime[Op.gte] = now;

    const { day, dateFrom, dateTo } = req.query;
    if (day) {
      const start = new Date(`${String(day)}T00:00:00.000Z`);
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      baseWhere.slotTime = { [Op.gte]: start, [Op.lt]: end };
    } else {
      if (dateFrom) baseWhere.slotTime[Op.gte] = new Date(dateFrom);
      if (dateTo) baseWhere.slotTime[Op.lt] = new Date(dateTo);
    }

    if (hasPagingParams) {
      let limit = parseInt(req.query.limit, 10);
      let offset = parseInt(req.query.offset, 10);
      if (!Number.isFinite(limit) || limit <= 0) limit = 100;
      if (!Number.isFinite(offset) || offset < 0) offset = 0;
      if (limit > 500) limit = 500;

      const result = await AvailableSlot.findAndCountAll({
        where: baseWhere,
        order: [['slotTime', 'ASC']],
        limit,
        offset,
      });

      const rows = result.rows || [];
      const short = String(req.query.short || '').toLowerCase() === 'true';
      const data = rows.map((slot) => {
        const common = {
          id: slot.id,
          slotTime: slot.slotTime,
          endTime: slot.endTime,
          practitionerId: slot.practitionerId,
        };
        if (short) {
          return {
            ...common,
            timeFormatted: formatSlotTime(slot.slotTime, slot.sourceTimezone || 'Europe/Moscow'),
            endTimeFormatted: formatSlotTime(slot.endTime, slot.sourceTimezone || 'Europe/Moscow'),
          };
        }
        return {
          ...slot.toJSON(),
          timeFormatted: formatSlotTime(slot.slotTime, slot.sourceTimezone || 'Europe/Moscow'),
          endTimeFormatted: formatSlotTime(slot.endTime, slot.sourceTimezone || 'Europe/Moscow'),
          timeRange: createTimeRange(slot.slotTime, slot.endTime, slot.sourceTimezone || 'Europe/Moscow'),
        };
      });

      // no-store headers
      try {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        res.set('Surrogate-Control', 'no-store');
      } catch (_) {}

      return res.json({
        data,
        meta: {
          total: result.count || 0,
          limit,
          offset,
          day: day || null,
          dateFrom: dateFrom || null,
          dateTo: dateTo || null,
          short: short || false,
        },
      });
    }

    // Legacy grouped response (no pagination params provided)
    const availableSlots = await AvailableSlot.findAll({ where: baseWhere, order: [['slotTime', 'ASC']] });
    const groupedSlots = availableSlots.reduce((acc, slot) => {
      const dateKey = format(startOfDay(slot.slotTime), 'yyyy-MM-dd');
      if (!acc[dateKey]) acc[dateKey] = [];
      const item = {
        ...slot.toJSON(),
        timeFormatted: formatSlotTime(slot.slotTime, slot.sourceTimezone || 'Europe/Moscow'),
        endTimeFormatted: formatSlotTime(slot.endTime, slot.sourceTimezone || 'Europe/Moscow'),
        timeRange: createTimeRange(slot.slotTime, slot.endTime, slot.sourceTimezone || 'Europe/Moscow'),
      };
      acc[dateKey].push(item);
      return acc;
    }, {});

    try {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      res.set('Surrogate-Control', 'no-store');
    } catch (_) {}

    res.json(groupedSlots);
  } catch (err) {
    logger.error(`Error fetching available slots: ${err.message}`);
    res.status(500).send('Server Error');
  }
});

// POST /api/slots/create - создание одиночного слота
router.post('/create', authMiddleware, adminOnly, idempotency('slots'), slotsLimiter, async (req, res) => {
  logger.info('POST /api/slots/create request received');
  try {
    const practitionerId = req.practitionerId;
    if (!practitionerId) {
      return res.status(400).json({ msg: 'Не указан арендатор (practitionerId). Передайте x-practitioner-id или x-practitioner-slug' });
    }

    const { startTime, endTime, date, timezone = 'Europe/Moscow' } = req.body;
    if (!isValidTimezone(timezone)) {
      return res.status(400).json({ msg: 'Некорректная временная зона' });
    }

    if (!startTime || !endTime || !date) {
      return res.status(400).json({ msg: 'Обязательные поля: startTime, endTime, date' });
    }

    // Парсим времена и конвертируем в UTC
    const slotTimeUTC = parseTimeInput(startTime, date, timezone);
    const endTimeUTC = parseTimeInput(endTime, date, timezone);
    try { logger.info('parsed UTC times (create)', { start: slotTimeUTC?.toISOString?.(), end: endTimeUTC?.toISOString?.(), timezone }); } catch (_) {}

    // Проверяем что время корректное
    if (slotTimeUTC >= endTimeUTC) {
      return res.status(400).json({ msg: 'Время начала должно быть раньше времени окончания' });
    }

    // Idempotency: если ключ передан, попробуем найти существующий созданный слот за TTL (до проверки конфликтов)
    if (req.idempotencyKey) {
      const ttlSec = req.idempotencyTtl || 300;
      const since = new Date(Date.now() - ttlSec * 1000);
      const same = await AvailableSlot.findOne({ where: { practitionerId, slotTime: slotTimeUTC, endTime: endTimeUTC, createdAt: { [Op.gte]: since } } });
      if (same) {
        const timeFormatted = formatSlotTime(same.slotTime, same.sourceTimezone);
        const endTimeFormatted = formatSlotTime(same.endTime, same.sourceTimezone);
        const payload = {
          id: same.id,
          startTime: timeFormatted,
          endTime: endTimeFormatted,
          sourceTimezone: same.sourceTimezone,
          isBooked: same.isBooked,
          slotTime: same.slotTime.toISOString(),
          endTime: same.endTime.toISOString(),
        };
        return res.json({ msg: 'Слот уже создан (идемпотентность)', ...payload, slot: { ...payload } });
      }
    }

    // Проверяем пересечения с существующими слотами (полуоткрытые интервалы [start, end))
    const conflictingSlot = await AvailableSlot.findOne({
      where: {
        practitionerId,
        [Op.and]: [
          { slotTime: { [Op.lt]: endTimeUTC } },
          { endTime:  { [Op.gt]: slotTimeUTC } },
        ]
      }
    });

    if (conflictingSlot) {
      return res.status(400).json({ msg: 'Время пересекается с существующим слотом' });
    }

    // Создаём слот
    const slot = await AvailableSlot.create({
      slotTime: slotTimeUTC,
      endTime: endTimeUTC,
      sourceTimezone: timezone,
      practitionerId,
      isBooked: false
    });

    // Возвращаем с форматированием времени
    const timeFormatted = formatSlotTime(slot.slotTime, slot.sourceTimezone);
    const endTimeFormatted = formatSlotTime(slot.endTime, slot.sourceTimezone);

    const payload = {
      id: slot.id,
      startTime: timeFormatted,
      endTime: endTimeFormatted,
      sourceTimezone: slot.sourceTimezone,
      isBooked: slot.isBooked,
      slotTime: slot.slotTime.toISOString(),
      endTime: slot.endTime.toISOString()
    };
    res.json({ msg: 'Слот успешно создан', ...payload, slot: { ...payload } });

  } catch (error) {
    logger.error('Error creating slot:', error.message);
    res.status(500).json({ msg: 'Ошибка сервера при создании слота' });
  }
});

// Alias: POST /api/slots
router.post('/', authMiddleware, adminOnly, idempotency('slots'), slotsLimiter, async (req, res) => {
  logger.info('POST /api/slots request received');
  try {
    const practitionerId = req.practitionerId;
    if (!practitionerId) {
      return res.status(400).json({ msg: 'Не указан арендатор (practitionerId). Передайте x-practitioner-id или x-practitioner-slug' });
    }

    const { startTime, endTime, date, timezone = 'Europe/Moscow' } = req.body;
    if (!isValidTimezone(timezone)) {
      return res.status(400).json({ msg: 'Некорректная временная зона' });
    }

    if (!startTime || !endTime || !date) {
      return res.status(400).json({ msg: 'Обязательные поля: startTime, endTime, date' });
    }

    // Парсим времена и конвертируем в UTC
    const slotTimeUTC = parseTimeInput(startTime, date, timezone);
    const endTimeUTC = parseTimeInput(endTime, date, timezone);
    try { logger.info('parsed UTC times (alias)', { start: slotTimeUTC?.toISOString?.(), end: endTimeUTC?.toISOString?.(), timezone }); } catch (_) {}

    // Проверяем что время корректное
    if (slotTimeUTC >= endTimeUTC) {
      return res.status(400).json({ msg: 'Время начала должно быть раньше времени окончания' });
    }

    // Проверяем пересечения с существующими слотами (полуоткрытые интервалы [start, end))
    const conflictingSlot = await AvailableSlot.findOne({
      where: {
        practitionerId,
        [Op.and]: [
          { slotTime: { [Op.lt]: endTimeUTC } },
          { endTime:  { [Op.gt]: slotTimeUTC } },
        ]
      }
    });

    if (conflictingSlot) {
      return res.status(400).json({ msg: 'Время пересекается с существующим слотом' });
    }

    // Создаём слот
    const slot = await AvailableSlot.create({
      slotTime: slotTimeUTC,
      endTime: endTimeUTC,
      sourceTimezone: timezone,
      practitionerId,
      isBooked: false
    });

    // Возвращаем с форматированием времени
    const timeFormatted = formatSlotTime(slot.slotTime, slot.sourceTimezone);
    const endTimeFormatted = formatSlotTime(slot.endTime, slot.sourceTimezone);

    {
      const payload = {
        id: slot.id,
        startTime: timeFormatted,
        endTime: endTimeFormatted,
        sourceTimezone: slot.sourceTimezone,
        isBooked: slot.isBooked,
        slotTime: slot.slotTime.toISOString(),
        endTime: slot.endTime.toISOString()
      };
      res.json({ msg: 'Слот успешно создан', ...payload, slot: { ...payload } });
    }

  } catch (error) {
    logger.error('Error creating slot:', error.message);
    res.status(500).json({ msg: 'Ошибка сервера при создании слота' });
  }
});

// @route   DELETE api/slots/:id
// @desc    Delete a specific slot (admin-only, scoped by practitioner)
// @access  Private
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  const id = req.params.id;
  if (!id) return res.status(400).json({ msg: 'Не передан идентификатор слота' });
  
  const t = await sequelize.transaction();
  try {
    const where = { id };
    if (req.practitionerId) where.practitionerId = req.practitionerId;
    
    const slot = await AvailableSlot.findOne({ where, transaction: t });
    if (!slot) {
      await t.rollback();
      return res.status(404).json({ msg: 'Слот не найден' });
    }
    
    // Check if slot is booked - if so, also delete the booking
    if (slot.isBooked) {
      const booking = await Booking.findOne({ 
        where: { AvailableSlotId: slot.id }, 
        transaction: t 
      });
      if (booking) {
        await booking.destroy({ transaction: t });
        logger.info(`Deleted booking ${booking.id} when deleting slot ${slot.id}`);
      }
    }
    
    await slot.destroy({ transaction: t });
    await t.commit();
    
    logger.info(`Deleted slot ${slot.id} at ${slot.slotTime}`);
    return res.json({ ok: true });
  } catch (e) {
    try { await t.rollback(); } catch (_) {}
    logger.error(`Error deleting slot: ${e.message}`);
    return res.status(500).send('Server Error');
  }
});

module.exports = router;
