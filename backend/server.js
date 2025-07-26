require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const logger = require('./config/logger');

const sequelize = require('./config/database');
const User = require('./models/User');
const Booking = require('./models/Booking');
const ScheduleSetting = require('./models/ScheduleSetting');
const AvailableSlot = require('./models/AvailableSlot');

// --- Model Associations ---
AvailableSlot.hasOne(Booking);
Booking.belongsTo(AvailableSlot);

const authRoutes = require('./routes/auth');
const bookingRoutes = require('./routes/bookings');
const adminRoutes = require('./routes/admin');
const scheduleRoutes = require('./routes/schedule');
const slotsRoutes = require('./routes/slots');

const app = express();

// --- Middleware ---
app.use(helmet());
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
}));
app.use(express.json());

app.use(express.urlencoded({ extended: true }));

// --- Logging Middleware ---
// Morgan setup to stream http logs to winston
const stream = {
  write: (message) => logger.http(message.trim()),
};
app.use(morgan('dev', { stream }));

// --- Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/slots', slotsRoutes);
app.use('/api/schedule', scheduleRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'PsyBooking API is running' });
});

const connectWithRetry = async () => {
  let retries = 5;
  while (retries) {
    try {
      await sequelize.authenticate();
      logger.info('Database connection has been established successfully.');

      const PORT = process.env.PORT || 5000;
      app.listen(PORT, () => {
        logger.info(`Server is running on port ${PORT}`);
      });
      return; // Success, exit loop
    } catch (err) {
      logger.error(`Unable to connect to the database: ${err.name}`);
      retries -= 1;
      logger.info(`Retrying in 5 seconds... (${retries} retries left)`);
      if (retries === 0) {
        logger.error('Could not connect to the database after multiple retries. Exiting.');
        process.exit(1);
      }
      await new Promise(res => setTimeout(res, 5000));
    }
  }
};

// --- Server Start ---
connectWithRetry();
