const express = require('express');
const router = express.Router();
const ScheduleSettings = require('../models/ScheduleSettings');
const authMiddleware = require('../middleware/authMiddleware');

// @route   GET api/schedule/settings
// @desc    Get current schedule settings
// @access  Private (for psychologist)
router.get('/settings', authMiddleware, async (req, res) => {
  try {
    let settings = await ScheduleSettings.findOne();
    if (!settings) {
      // If no settings exist, create default ones
      settings = await ScheduleSettings.create({});
    }
    res.json(settings);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/schedule/settings
// @desc    Update schedule settings
// @access  Private (for psychologist)
router.post('/settings', authMiddleware, async (req, res) => {
  const {
    workingDays,
    slotTime,
    endTime,
    slotDuration,
    breakDuration
  } = req.body;

  try {
    let settings = await ScheduleSettings.findOne();
    if (!settings) {
      settings = new ScheduleSettings();
    }

    settings.workingDays = workingDays || settings.workingDays;
    settings.slotTime = slotTime || settings.slotTime;
    settings.endTime = endTime || settings.endTime;
    settings.slotDuration = slotDuration || settings.slotDuration;
    settings.breakDuration = breakDuration || settings.breakDuration;

    await settings.save();
    res.json(settings);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
