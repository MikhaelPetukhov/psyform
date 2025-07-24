const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { addDays, addMinutes, getDay, isAfter, isBefore, isEqual, isWithinInterval, parse, startOfDay } = require('date-fns');
const logger = require('../config/logger');
const authMiddleware = require('../middleware/authMiddleware');
const ScheduleSettings = require('../models/ScheduleSettings');
const AvailableSlot = require('../models/AvailableSlot');
const Booking = require('../models/Booking');

// @route   POST api/slots/generate
// @desc    Generate available time slots based on schedule settings
// @access  Private
router.post('/generate', authMiddleware, async (req, res) => {
  logger.info('POST /api/slots/generate request received');
  try {
    const settings = await ScheduleSettings.findOne();
    if (!settings) {
      logger.warn('Slot generation failed: Schedule settings not found.');
      return res.status(404).json({ msg: 'Schedule settings not found. Please configure them first.' });
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
    const { enabled: lunchEnabled, start: lunchStart, end: lunchEnd } = lunchBreak;

    logger.info('Using settings for generation:', { workingDays, workingHours, sessionDuration, breakBetweenSessions, lunchBreak, generationPeriodDays });

    const today = startOfDay(new Date());

    // 1. Clear future, unbooked slots to prevent duplicates
    const destroyedCount = await AvailableSlot.destroy({
      where: {
        slotTime: { [Op.gte]: today },
        isBooked: false,
      },
    });
    logger.info(`Cleared ${destroyedCount} old unbooked slots.`);

    // 2. Fetch all future bookings to check for conflicts
    const futureBookings = await Booking.findAll({
      where: {
        slotTime: { [Op.gte]: today },
      },
    });
    logger.info(`Found ${futureBookings.length} future bookings to check for conflicts.`);

    const newSlots = [];
    const generationEndDate = addDays(today, generationPeriodDays);

    // 3. Loop through each day in the generation period
    for (let currentDate = today; isBefore(currentDate, generationEndDate); currentDate = addDays(currentDate, 1)) {
      const dayOfWeek = getDay(currentDate);

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

          const isDuringLunch = lunchEnabled &&
            (isWithinInterval(currentTime, { start: lunchStartTime, end: lunchEndTime }) ||
             isWithinInterval(slotEndTime, { start: lunchStartTime, end: lunchEndTime }) ||
             (isBefore(currentTime, lunchStartTime) && isAfter(slotEndTime, lunchEndTime)));

          const isConflict = futureBookings.some(booking => isEqual(booking.slotTime, currentTime));

          if (!isDuringLunch && !isConflict) {
            newSlots.push({
              slotTime: currentTime,
              endTime: slotEndTime,
              isBooked: false,
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

    res.json({ msg: `Successfully generated ${newSlots.length} new slots.` });
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
    const availableSlots = await AvailableSlot.findAll({
      where: {
        isBooked: false,
        slotTime: {
          [Op.gte]: new Date(),
        },
      },
      order: [['slotTime', 'ASC']],
    });

    logger.info(`Found ${availableSlots.length} available slots.`);

    // Group slots by date for easier frontend consumption
    const groupedSlots = availableSlots.reduce((acc, slot) => {
      const date = startOfDay(slot.slotTime).toISOString();
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(slot);
      return acc;
    }, {});

    res.json(groupedSlots);
  } catch (err) {
    logger.error(`Error fetching available slots: ${err.message}`);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
