const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const authMiddleware = require('../middleware/authMiddleware');
const adminOnly = require('../middleware/adminOnly');
const { ScheduleSetting, Booking, AvailableSlot } = require('../models');
const sequelize = require('../config/database');
const logger = require('../config/logger');

// @route   GET api/admin/schedule-settings
// @desc    Get the current schedule settings
// @access  Private
router.get('/schedule-settings', authMiddleware, adminOnly, async (req, res) => {
  logger.info('GET /api/admin/schedule-settings request received');
  try {
    const practitionerId = req.practitionerId;
    if (!practitionerId) {
      logger.warn('Missing practitionerId in request scope.');
      return res.status(400).json({ msg: 'Не указан арендатор (practitionerId). Передайте x-practitioner-id или x-practitioner-slug' });
    }

    let settings = await ScheduleSetting.findOne({ where: { practitionerId } });
    if (!settings) {
      logger.warn('Schedule settings not found for practitioner, creating defaults.');
      settings = await ScheduleSetting.create({ practitionerId });
    }
    logger.info('Successfully fetched schedule settings.');
    res.json(settings);
  } catch (err) {
    logger.error(`Error fetching schedule settings: ${err.message}`);
    res.status(500).send('Ошибка сервера');
  }
});

// @route   PUT api/admin/schedule-settings
// @desc    Update schedule settings
// @access  Private
router.put(
  '/schedule-settings',
  [
    authMiddleware,
    adminOnly,
    [
        body('workingDays').isArray().withMessage('Рабочие дни должны быть массивом'),
        body('workingHours.start').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Неверный формат времени начала работы'),
        body('workingHours.end').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Неверный формат времени окончания работы'),
        body('sessionDuration').isInt({ min: 15, max: 180 }).withMessage('Длительность сессии должна быть от 15 до 180 минут'),
        body('breakBetweenSessions').isInt({ min: 0, max: 60 }).withMessage('Перерыв должен быть от 0 до 60 минут'),
        body('lunchBreak.enabled').optional().isBoolean(),
        body('generationPeriodDays').optional().isInt({ min: 1, max: 90 }).withMessage('Период генерации должен быть от 1 до 90 дней'),
    ]
  ],
  async (req, res) => {
    logger.info('PUT /api/admin/schedule-settings request received');
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Validation errors for schedule settings update:', { errors: errors.array() });
      return res.status(400).json({ errors: errors.array() });
    }

    try {
        const practitionerId = req.practitionerId;
        if (!practitionerId) {
            logger.warn('Missing practitionerId in request scope.');
            return res.status(400).json({ msg: 'Не указан арендатор (practitionerId). Передайте x-practitioner-id или x-practitioner-slug' });
        }

        let settings = await ScheduleSetting.findOne({ where: { practitionerId } });
        if (!settings) {
            logger.warn('No schedule settings found for practitioner, creating new ones.');
            settings = new ScheduleSetting({ practitionerId });
        }

        const {
          workingDays,
          workingHours,
          sessionDuration,
          breakBetweenSessions,
          lunchBreak,
          generationPeriodDays,
          // legacy fields support (if any clients still send them)
          slotTime,
          endTime,
          slotDuration,
          breakDuration,
        } = req.body || {};

        if (typeof workingDays !== 'undefined') settings.workingDays = workingDays;
        if (typeof workingHours !== 'undefined') settings.workingHours = workingHours;
        if (typeof sessionDuration !== 'undefined') settings.sessionDuration = sessionDuration;
        if (typeof breakBetweenSessions !== 'undefined') settings.breakBetweenSessions = breakBetweenSessions;
        if (typeof lunchBreak !== 'undefined') settings.lunchBreak = lunchBreak;
        if (typeof generationPeriodDays !== 'undefined') settings.generationPeriodDays = generationPeriodDays;

        // legacy assignments
        if (typeof slotTime !== 'undefined') settings.slotTime = slotTime;
        if (typeof endTime !== 'undefined') settings.endTime = endTime;
        if (typeof slotDuration !== 'undefined') settings.slotDuration = slotDuration;
        if (typeof breakDuration !== 'undefined') settings.breakDuration = breakDuration;

        await settings.save();
        logger.info('Schedule settings updated successfully.');

        res.json({
            message: 'Настройки расписания успешно обновлены',
            settings
        });

    } catch (err) {
        logger.error(`Error updating schedule settings: ${err.message}`);
        res.status(500).send('Ошибка сервера');
    }
  }
);

// @route   POST api/admin/reset-schedule
// @desc    Delete ALL bookings and available slots for the current practitioner
// @access  Private (admin)
router.post('/reset-schedule', authMiddleware, adminOnly, async (req, res) => {
  logger.warn('POST /api/admin/reset-schedule requested');
  const practitionerId = req.practitionerId;
  if (!practitionerId) {
    logger.warn('Missing practitionerId in request scope.');
    return res.status(400).json({ msg: 'Не указан арендатор (practitionerId). Передайте x-practitioner-id или x-practitioner-slug' });
  }

  // Require explicit confirmation in body to avoid accidental wipes
  if (!req.body || req.body.confirm !== true) {
    return res.status(400).json({ msg: 'Требуется подтверждение: { "confirm": true }' });
  }

  const t = await sequelize.transaction();
  try {
    // Delete dependent rows first (Bookings reference AvailableSlots)
    const deletedBookings = await Booking.destroy({ where: { practitionerId }, transaction: t });
    const deletedSlots = await AvailableSlot.destroy({ where: { practitionerId }, transaction: t });

    await t.commit();
    logger.info(`Reset complete. Deleted bookings=${deletedBookings}, slots=${deletedSlots} for practitionerId=${practitionerId}`);
    return res.json({
      message: 'Все записи и свободные слоты удалены для текущего аккаунта',
      deletedBookings,
      deletedSlots,
    });
  } catch (err) {
    await t.rollback();
    logger.error(`Error during reset-schedule: ${err.message}`);
    return res.status(500).json({ msg: 'Ошибка сервера при очистке расписания' });
  }
});

// @route   GET api/admin/practitioner/profile
// @desc    Get current practitioner profile
// @access  Private (Admin only)
router.get('/practitioner/profile', authMiddleware, adminOnly, async (req, res) => {
  try {
    const practitionerId = req.practitionerId;
    const { Practitioner } = require('../models');
    
    const practitioner = await Practitioner.findByPk(practitionerId);
    if (!practitioner) {
      return res.status(404).json({ msg: 'Профиль психолога не найден' });
    }

    res.json({
      id: practitioner.id,
      slug: practitioner.slug,
      displayName: practitioner.displayName,
      timezone: practitioner.timezone,
      specialization: practitioner.specialization,
      about: practitioner.about
    });
  } catch (e) {
    logger.error('Error fetching practitioner profile:', e);
    res.status(500).json({ msg: 'Ошибка сервера' });
  }
});

// @route   PUT api/admin/practitioner/profile
// @desc    Update current practitioner profile
// @access  Private (Admin only)
router.put('/practitioner/profile', authMiddleware, adminOnly, async (req, res) => {
  try {
    const practitionerId = req.practitionerId;
    const { timezone, displayName, specialization, about } = req.body;
    const { Practitioner } = require('../models');
    
    const practitioner = await Practitioner.findByPk(practitionerId);
    if (!practitioner) {
      return res.status(404).json({ msg: 'Профиль психолога не найден' });
    }

    const updates = {};
    if (timezone) updates.timezone = timezone;
    if (displayName) updates.displayName = displayName;
    if (specialization !== undefined) updates.specialization = specialization;
    if (about !== undefined) updates.about = about;

    await practitioner.update(updates);
    
    logger.info(`Updated practitioner ${practitionerId} profile:`, updates);

    res.json({
      ok: true,
      msg: 'Профиль обновлён',
      practitioner: {
        id: practitioner.id,
        slug: practitioner.slug,
        displayName: practitioner.displayName,
        timezone: practitioner.timezone,
        specialization: practitioner.specialization,
        about: practitioner.about
      }
    });
  } catch (e) {
    logger.error('Error updating practitioner profile:', e);
    res.status(500).json({ msg: 'Ошибка сервера' });
  }
});

module.exports = router;
