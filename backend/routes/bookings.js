const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const Booking = require('../models/Booking');

// @route   GET api/bookings
// @desc    Get all bookings for the logged-in psychologist
// @access  Private
router.get('/', authMiddleware, async (req, res) => {
  try {
    // Fetch all bookings, sort by date
    const bookings = await Booking.findAll({
      order: [['slotTime', 'ASC']],
    });
    res.json(bookings);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Ошибка сервера');
  }
});

// More booking-related routes (POST, PUT, DELETE) will be added here later.

module.exports = router;
