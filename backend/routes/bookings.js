const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const authMiddleware = require('../middleware/authMiddleware');
const Booking = require('../models/Booking');
const AvailableSlot = require('../models/AvailableSlot');

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

// @route   POST api/bookings
// @desc    Create a new booking based on selected slot
// @access  Public
router.post(
  '/',
  [
    body('name').not().isEmpty().withMessage('Имя обязательно'),
    body('email').isEmail().withMessage('Некорректный email'),
    body('phone').optional().isString(),
    body('slotId').not().isEmpty().withMessage('Не выбран слот'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, phone, slotId } = req.body;

    try {
      const slot = await AvailableSlot.findByPk(slotId);
      if (!slot || slot.isBooked) {
        return res.status(400).json({ msg: 'Выбранный слот недоступен' });
      }

      const booking = await Booking.create({
        clientName: name,
        clientEmail: email,
        clientPhone: phone,
        slotTime: slot.slotTime,
        endTime: slot.endTime,
      });

      await slot.update({ isBooked: true });

      res.json(booking);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Ошибка сервера');
    }
  }
);

// More booking-related routes (PUT, DELETE) will be added here later.

module.exports = router;
