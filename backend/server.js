const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100
});
app.use('/api/', limiter);

// Email configuration - ИСПРАВЛЕНО!
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// In-memory storage
let bookings = [];
let nextId = 1;

// Validation
const validateBooking = [
  body('clientName').trim().isLength({ min: 2, max: 100 }),
  body('clientEmail').isEmail().normalizeEmail(),
  body('clientPhone').matches(/^[\+]?[1-9][\d]{10,14}$/),
  body('appointmentDate').isISO8601().toDate(),
  body('description').optional().trim().isLength({ max: 500 })
];

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'PsyBooking API is running' });
});

app.get('/api/bookings', (req, res) => {
  res.json({ success: true, data: bookings });
});

app.post('/api/bookings', validateBooking, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Ошибка валидации данных',
        errors: errors.array()
      });
    }

    const { clientName, clientEmail, clientPhone, appointmentDate, appointmentTime, description } = req.body;
    
    const newBooking = {
      id: nextId++,
      clientName,
      clientEmail,
      clientPhone,
      appointmentDate,
      appointmentTime,
      description: description || '',
      status: 'confirmed',
      createdAt: new Date().toISOString()
    };

    bookings.push(newBooking);

    // Send email notification
    await sendEmailNotification(newBooking);

    res.status(201).json({
      success: true,
      message: 'Запись успешно создана',
      data: {
        id: newBooking.id,
        appointmentDate: newBooking.appointmentDate,
        appointmentTime: newBooking.appointmentTime,
        status: newBooking.status
      }
    });

  } catch (error) {
    console.error('Booking creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера'
    });
  }
});

async function sendEmailNotification(booking) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.PSYCHOLOGIST_EMAIL || 'psychologist@example.com',
    subject: ' Новая запись на консультацию',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Новая запись на консультацию</h2>
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Детали записи:</h3>
          <p><strong>Клиент:</strong> ${booking.clientName}</p>
          <p><strong>Email:</strong> ${booking.clientEmail}</p>
          <p><strong>Телефон:</strong> ${booking.clientPhone}</p>
          <p><strong>Дата:</strong> ${new Date(booking.appointmentDate).toLocaleDateString('ru-RU')}</p>
          <p><strong>Время:</strong> ${booking.appointmentTime}</p>
          ${booking.description ? `<p><strong>Описание:</strong> ${booking.description}</p>` : ''}
        </div>
        <p style="color: #64748b; font-size: 14px;">
          Запись создана: ${new Date(booking.createdAt).toLocaleString('ru-RU')}
        </p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(' Email notification sent successfully');
  } catch (error) {
    console.error(' Email sending error:', error);
  }
}

app.listen(PORT, () => {
  console.log(` PsyBooking API server running on port ${PORT}`);
  console.log(` Email notifications: ${process.env.EMAIL_USER ? 'Enabled' : 'Disabled'}`);
});
