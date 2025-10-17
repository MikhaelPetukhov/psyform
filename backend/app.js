require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const client = require('prom-client');

const sequelize = require('./config/database');
const practitionerScope = require('./middleware/practitionerScope');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const logger = require('./config/logger');
const { getBot } = require('./services/telegramBot');

const authRoutes = require('./routes/auth');
const bookingRoutes = require('./routes/bookings');
const adminRoutes = require('./routes/admin');
const practitionerRoutes = require('./routes/practitioners');
const slotsRoutes = require('./routes/slots');
const telegramRoutes = require('./routes/telegram');
const whatsappRoutes = require('./routes/whatsapp');
const callsRoutes = require('./routes/calls');

const app = express();

// --- Middleware ---
// Работая за nginx/ngrok, включаем trust proxy, чтобы корректно обрабатывался X-Forwarded-For
app.set('trust proxy', 1);
app.use(helmet());
// Explicitly enforce no-referrer to avoid leaking JWT in query via Referer
try { app.use(helmet.referrerPolicy({ policy: 'no-referrer' })); } catch (_) {}
// Optionally set Permissions-Policy via env (do not lock down camera/mic by default)
if (process.env.PERMISSIONS_POLICY && String(process.env.PERMISSIONS_POLICY).trim()) {
  app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', String(process.env.PERMISSIONS_POLICY).trim());
    next();
  });
}
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// --- Prometheus metrics ---
try {
  client.collectDefaultMetrics();
  app.get('/metrics', async (req, res) => {
    try {
      res.set('Content-Type', client.register.contentType);
      res.end(await client.register.metrics());
    } catch (e) {
      res.status(500).send('metrics error');
    }
  });
} catch (_) { /* metrics optional */ }

// Lightweight liveness probe that does not touch DB and always answers fast
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'PsyBooking API is running' });
});

// Readiness probe: returns ready only when DB is reachable and startup finished
app.get('/api/readiness', async (req, res) => {
  try {
    if (!app.locals || !app.locals.ready) {
      return res.status(503).json({ status: 'NOT_READY', reason: 'Startup not completed' });
    }
    // Extra safety: ping DB
    await sequelize.authenticate();
    return res.json({ status: 'READY' });
  } catch (e) {
    return res.status(503).json({ status: 'NOT_READY', reason: 'DB not reachable' });
  }
});

// --- Telegram webhook endpoint (works when TELEGRAM_WEBHOOK_ENABLED=true) ---
app.post('/api/telegram/webhook/:secret', async (req, res, next) => {
  try {
    const expected = (process.env.TELEGRAM_WEBHOOK_SECRET || 'dev-secret').trim();
    const provided = (req.params.secret || '').trim();
    if (!expected || provided !== expected) {
      return res.status(403).send('Forbidden');
    }
    const bot = getBot && getBot();
    if (!bot) return res.status(503).send('Bot not started');
    // Path must match the one used in setWebhook
    const path = `/api/telegram/webhook/${expected}`;
    return bot.webhookCallback(path)(req, res, next);
  } catch (e) {
    logger.error(`[TELEGRAM WEBHOOK] error: ${e.message}`);
    return res.status(500).send('Webhook error');
  }
});

// Attach practitioner scope for all other routes (may use DB)
app.use(practitionerScope);

// --- Logging Middleware ---
const stream = {
  write: (message) => logger.http(message.trim()),
};
app.use(morgan('dev', { stream }));

// --- Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/practitioners', practitionerRoutes);
app.use('/api/slots', slotsRoutes);
app.use('/api/telegram', telegramRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/calls', callsRoutes);


module.exports = app;
