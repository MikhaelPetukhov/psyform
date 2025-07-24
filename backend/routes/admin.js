const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const authMiddleware = require('../middleware/authMiddleware');
const ScheduleSetting = require('../models/ScheduleSetting');
const logger = require('../config/logger');

// @route   GET api/admin/schedule-settings
// @desc    Get the current schedule settings
// @access  Private
router.get('/schedule-settings', authMiddleware, async (req, res) => {
  logger.info('GET /api/admin/schedule-settings request received');
  try {
    const settings = await ScheduleSetting.findOne();
    if (!settings) {
      logger.warn('Schedule settings not found in database.');
      return res.status(404).json({ msg: 'Настройки не найдены. Создайте их сначала.' });
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
    [
        body('workingDays').isArray().withMessage('Рабочие дни должны быть массивом'),
        body('workingHours.start').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Неверный формат времени начала работы'),
        body('workingHours.end').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Неверный формат времени окончания работы'),
        body('sessionDuration').isInt({ min: 15, max: 180 }).withMessage('Длительность сессии должна быть от 15 до 180 минут'),
        body('breakBetweenSessions').isInt({ min: 0, max: 60 }).withMessage('Перерыв должен быть от 0 до 60 минут'),
        body('lunchBreak.enabled').isBoolean(),
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
        let settings = await ScheduleSetting.findOne();
        if (!settings) {
            logger.warn('No schedule settings found to update, creating new ones.');
            // If for some reason settings don't exist, create them.
            settings = await ScheduleSetting.create(req.body);
        } else {
            // Update the settings
            await settings.update(req.body);
            logger.info('Schedule settings updated successfully.');
        }

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

module.exports = router;
