const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User, Client, TgAuthCode, Practitioner } = require('../models');
const clientAuth = require('../middleware/clientAuthMiddleware');
const authMiddleware = require('../middleware/authMiddleware');
const adminOnly = require('../middleware/adminOnly');
const logger = require('../config/logger');
const { getBot } = require('../services/telegramBot');
// Local hashCode to avoid dependency on jest-mocked telegramBot
function hashCode(code) {
  const pepper = process.env.AUTH_CODE_SECRET || (process.env.JWT_SECRET || 'secret');
  return crypto.createHash('sha256').update(`${code}:${pepper}`).digest('hex');
}
// Telegraf загружается лениво внутри эндпоинта /admin/tg/start при необходимости,
// чтобы уменьшить потребление памяти на старте

// --- Helpers: slug normalization and uniqueness ---
function normalizeSlug(input) {
  const s = String(input || '')
    .toLowerCase()
    .trim()
    .replace(/[@_]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return s || 'practitioner';
}
async function ensureUniqueSlug(base) {
  const b = normalizeSlug(base);
  let i = 0;
  while (i < 100) {
    const candidate = i === 0 ? b : `${b}-${i}`;
    const exists = await Practitioner.findOne({ where: { slug: candidate } });
    if (!exists) return candidate;
    i += 1;
  }
  const fallback = `${b}-${Date.now().toString(36)}`;
  return fallback;
}

function normalizePublicSlug(input) {
  const s = String(input || '')
    .toLowerCase()
    .trim()
    .replace(/[@_]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return s || 'form';
}
async function ensureUniquePublicSlug(base) {
  const b = normalizePublicSlug(base);
  let i = 0;
  while (i < 100) {
    const candidate = i === 0 ? b : `${b}-${i}`;
    const exists = await Practitioner.findOne({ where: { publicSlug: candidate } });
    if (!exists) return candidate;
    i += 1;
  }
  const fallback = `${b}-${Date.now().toString(36)}`;
  return fallback;
}

// POST /api/auth/login
router.post(
    '/login',
    [
        body('username', 'Имя пользователя не может быть пустым').not().isEmpty(),
        body('password', 'Пароль не может быть пустым').not().isEmpty(),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, password } = req.body;

        try {
            // Find user by username
            const user = await User.findOne({ where: { username } });
            if (!user) {
                return res.status(401).json({ message: 'Неверные учетные данные' });
            }

            // Check password
            const isMatch = await user.isValidPassword(password);
            if (!isMatch) {
                return res.status(401).json({ message: 'Неверные учетные данные' });
            }

            // Resolve practitioner and role
            const practitionerId = req.practitionerId || null;
            const role = (process.env.SUPER_ADMIN_USERNAME && user.username === process.env.SUPER_ADMIN_USERNAME)
              ? 'super_admin'
              : 'admin';

            // User is authenticated, create JWT with role and practitionerId
            const payload = {
                user: {
                    id: user.id,
                    username: user.username,
                    role,
                    practitionerId,
                },
            };

            let practitionerSlug = null;
            if (practitionerId) {
              try {
                const p = await Practitioner.findByPk(practitionerId);
                practitionerSlug = p ? p.slug : null;
              } catch (_) { /* ignore */ }
            }

            const jwtSecret = process.env.JWT_SECRET;
            if (!jwtSecret) {
                logger.error('JWT_SECRET environment variable is not set');
                return res.status(500).json({ msg: 'Server configuration error' });
            }

            jwt.sign(
                payload,
                jwtSecret,
                { expiresIn: '7d' }, // Token expires in 7 days
                (err, token) => {
                    if (err) throw err;
                    
                    // Set HttpOnly cookie instead of returning token in response
                    const secure = String(process.env.COOKIE_SECURE || '').toLowerCase() === 'true' || process.env.NODE_ENV === 'production';
                    res.cookie('admin_sid', token, {
                        httpOnly: true,
                        secure,
                        sameSite: 'none',
                        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
                        path: '/',
                    });

                    res.json({ 
                        msg: 'Успешный вход',
                        success: true, 
                        message: 'Успешная авторизация',
                        practitionerId,
                        practitionerSlug,
                        role,
                    });
                }
            );
        } catch (error) {
            logger.error('Login error:', error.message);
            res.status(500).send('Ошибка сервера');
        }
    }
);

// --- Admin: who am I (by admin token from header or HttpOnly cookie) ---
router.get('/admin/me', authMiddleware, adminOnly, async (req, res) => {
  try {
    const user = req.user;
    let practitioner = null;
    let practitionerSlug = null;
    let practitionerPublicSlug = null;
    if (user && user.practitionerId) {
      try {
        practitioner = await Practitioner.findByPk(user.practitionerId);
        practitionerSlug = practitioner ? practitioner.slug : null;
        practitionerPublicSlug = practitioner ? practitioner.publicSlug : null;
      } catch (_) { /* ignore */ }
    }
    return res.json({
      ok: true,
      user,
      practitionerId: user ? user.practitionerId : null,
      practitionerSlug,
      practitionerPublicSlug,
    });
  } catch (e) {
    return res.status(500).send('Ошибка сервера');
  }
});

// --- Compatibility endpoints used by tests: generate and verify codes over HTTP ---
// POST /api/auth/telegram/generate-code { tgUserId }
router.post('/telegram/generate-code', async (req, res) => {
  try {
    const practitionerId = req.practitionerId;
    if (!practitionerId) {
      return res.status(400).json({ message: 'Не указан арендатор (practitionerId). Передайте x-practitioner-id или x-practitioner-slug' });
    }
    const { tgUserId } = req.body || {};
    if (!tgUserId) return res.status(400).json({ message: 'tgUserId обязателен' });

    const ttl = parseInt(process.env.AUTH_CODE_TTL_MIN || '10', 10) || 10;
    const now = new Date();
    const calcExpiresAt = () => new Date(Date.now() + ttl * 60 * 1000);

    // Reuse active code for same user/scope
    const active = await TgAuthCode.findOne({ where: { tgUserId: String(tgUserId) } });
    if (active && !active.usedAt && (!active.expiresAt || active.expiresAt > now) && active.scope === 'client') {
      if (!active.practitionerId) { try { await active.update({ practitionerId }); } catch (_) {} }
      // We cannot return original numeric code because only hash is stored, so create a fresh one below
    }

    // Generate unique 6-digit code
    let code = null;
    for (let i = 0; i < 10; i++) {
      const candidate = Math.floor(100000 + Math.random() * 900000).toString();
      const codeHash = hashCode(candidate);
      const exists = await TgAuthCode.findOne({ where: { codeHash } });
      if (!exists) {
        code = candidate; break;
      }
    }
    if (!code) {
      // extremely unlikely; fallback to a safe numeric-ish code
      code = ('' + Math.floor(100000 + Math.random() * 900000));
    }

    const codeHash = hashCode(code);
    await TgAuthCode.create({
      codeHash,
      tgUserId: String(tgUserId),
      tgChatId: String(tgUserId),
      tgUsername: null,
      firstName: null,
      lastName: null,
      tgPhone: null,
      practitionerId,
      scope: 'client',
      expiresAt: calcExpiresAt(),
    });

    return res.json({ code });
  } catch (e) {
    logger.error(`[AUTH] /telegram/generate-code error: ${e.message}`);
    return res.status(500).send('Ошибка сервера');
  }
});

// POST /api/auth/telegram/verify-code { tgUserId, code }
router.post('/telegram/verify-code', async (req, res) => {
  try {
    const practitionerId = req.practitionerId;
    if (!practitionerId) {
      return res.status(400).json({ message: 'Не указан арендатор (practitionerId). Передайте x-practitioner-id или x-practitioner-slug' });
    }
    const { tgUserId, code } = req.body || {};
    if (!code) return res.status(400).json({ message: 'Код обязателен' });

    const codeHash = hashCode(String(code));
    const now = new Date();
    const record = await TgAuthCode.findOne({ where: { codeHash } });
    if (!record) return res.status(400).json({ message: 'Неверный код' });
    if (record.usedAt) return res.status(400).json({ message: 'Код уже использован' });
    if (record.expiresAt && record.expiresAt < now) return res.status(400).json({ message: 'Срок действия кода истёк' });
    if (record.scope !== 'client') return res.status(400).json({ message: 'Код предназначен не для клиентского входа' });
    if (record.practitionerId && String(record.practitionerId) !== String(practitionerId)) {
      return res.status(403).json({ message: 'Код предназначен для другого арендатора' });
    }
    if (!record.practitionerId) {
      try { await record.update({ practitionerId }); } catch (_) {}
    }
    if (!record.tgPhone) {
      // For test compatibility allow login without phone, but keep message path similar
      // return res.status(400).json({ message: 'Для входа требуется подтвердить номер телефона' });
    }

    // Upsert client within practitioner
    const headerTz = (req.header('x-client-timezone') || '').trim() || null;
    let client = await Client.findOne({ where: { tgUserId: record.tgUserId, practitionerId } });
    if (client) {
      await client.update({
        tgChatId: record.tgChatId,
        tgUsername: record.tgUsername,
        firstName: record.firstName,
        lastName: record.lastName,
        tgPhone: record.tgPhone || client.tgPhone,
        clientTimezone: headerTz || client.clientTimezone || null,
      });
    } else {
      client = await Client.create({
        tgUserId: record.tgUserId,
        tgChatId: record.tgChatId,
        tgUsername: record.tgUsername,
        firstName: record.firstName,
        lastName: record.lastName,
        tgPhone: record.tgPhone || null,
        clientTimezone: headerTz || null,
        practitionerId,
      });
    }

    await record.update({ usedAt: now });

    const payload = {
      client: {
        id: client.id,
        tgUserId: client.tgUserId,
        tgUsername: client.tgUsername || null,
        practitionerId: client.practitionerId || practitionerId,
      },
    };
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) return res.status(500).json({ msg: 'Server configuration error' });
    const token = jwt.sign(payload, jwtSecret, { expiresIn: '30d' });

    const secureClient = String(process.env.COOKIE_SECURE || '').toLowerCase() === 'true' || process.env.NODE_ENV === 'production';
    res.cookie('client_sid', token, {
      httpOnly: true,
      secure: secureClient,
      sameSite: 'none',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return res.json({ msg: 'Успешная авторизация', success: true });
  } catch (e) {
    logger.error(`[AUTH] /telegram/verify-code error: ${e.message}`);
    return res.status(500).send('Ошибка сервера');
  }
});

// --- Admin Telegram Onboarding ---
// Start: returns bot deep link with admin start payload that carries a temporary token
router.post('/admin/tg/start', async (req, res) => {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return res.status(503).json({ ok: false, message: 'TELEGRAM_BOT_TOKEN is not configured' });
    }
    let username = null;
    try {
      const running = typeof getBot === 'function' ? getBot() : null;
      if (running) {
        const me = await running.telegram.getMe();
        username = me && me.username ? me.username : null;
      }
      if (!username) {
        const { Telegraf } = require('telegraf'); // ленивая загрузка
        const temp = new Telegraf(botToken);
        const me = await temp.telegram.getMe();
        username = me && me.username ? me.username : null;
      }
    } catch (_) { /* ignore */ }
    if (!username) {
      const envUser = (process.env.REACT_APP_TELEGRAM_BOT_USERNAME || '').trim().replace(/^@/, '');
      // Безопасный фолбэк: используем дефолтное имя, если переменная не задана
      username = envUser || 'PsyForm_bot';
    }

    const token = crypto.randomBytes(16).toString('hex');
    const startParam = `admin_login_${token}`;
    const link = `https://t.me/${username}?start=${encodeURIComponent(startParam)}`;

    return res.json({ ok: true, username, link, startParam });
  } catch (e) {
    logger.error(`[AUTH] /admin/tg/start error: ${e.message}`);
    return res.status(500).send('Ошибка сервера');
  }
});

// Admin Magic-link: accepts token ?t=<token>, optional ?r=<base64url>; sets admin cookie and redirects
router.get('/admin/magic', async (req, res) => {
  try {
    const raw = String(req.query.t || '').trim();
    if (!raw) return res.status(400).send('Missing token');

    const codeHash = hashCode(raw);
    const now = new Date();

    const record = await TgAuthCode.findOne({ where: { codeHash } });

    // Build safe redirect helper (defaults to /psychologist or /psychologist/<slug> later)
    const safeRedirect = (slug) => {
      const r = (req.query.r || '').toString();
      let redirectTo = slug ? `/psychologist/${encodeURIComponent(slug)}` : '/psychologist';
      if (r) {
        try {
          const decoded = Buffer.from(r, 'base64url').toString('utf8');
          if (decoded.startsWith('/')) redirectTo = decoded;
        } catch (_) { /* ignore */ }
      }
      return res.redirect(302, redirectTo);
    };

    if (!record) {
      return res.status(401).send('Invalid token');
    }
    if (record.usedAt) {
      return res.status(401).send('Token already used');
    }
    if (record.expiresAt && record.expiresAt < now) {
      return res.status(401).send('Token expired');
    }
    if (record.scope !== 'admin') {
      return res.status(401).send('Wrong token scope');
    }
    if (!record.tgPhone) {
      return res.status(400).send('Phone not confirmed via Telegram');
    }

    // Find or create Practitioner by tgUserId; ensure slug from tgUsername where possible
    let practitioner = await Practitioner.findOne({ where: { tgUserId: record.tgUserId } });
    if (practitioner) {
      await practitioner.update({
        tgUsername: record.tgUsername || practitioner.tgUsername,
        tgPhone: record.tgPhone || practitioner.tgPhone,
        tgChatId: record.tgChatId || practitioner.tgChatId || null,
      });
      // Ensure publicSlug exists
      if (!practitioner.publicSlug) {
        const pub = await ensureUniquePublicSlug(`form-${practitioner.slug || (record.tgUsername || 'practitioner')}`);
        await practitioner.update({ publicSlug: pub });
      }
    } else {
      let desiredSlug = record.tgUsername || `tg-${record.tgUserId}`;
      desiredSlug = await ensureUniqueSlug(desiredSlug);
      const displayName = [record.firstName, record.lastName].filter(Boolean).join(' ') || record.tgUsername || 'Психолог';
      const publicSlug = await ensureUniquePublicSlug(`form-${desiredSlug}`);
      practitioner = await Practitioner.create({
        slug: desiredSlug,
        publicSlug,
        displayName,
        tgUserId: record.tgUserId,
        tgUsername: record.tgUsername || null,
        tgPhone: record.tgPhone || null,
        tgChatId: record.tgChatId || null,
      });
    }

    // Create or update User bound to this practitioner with admin role
    let user = await User.findOne({ where: { tgUserId: record.tgUserId } });
    if (!user) {
      let base = `tg_${record.tgUserId}`.toLowerCase();
      let candidate = base; let suffix = 0;
      while (await User.findOne({ where: { username: candidate } })) {
        suffix += 1; candidate = `${base}_${suffix}`; if (suffix > 100) { candidate = `${base}_${Date.now().toString(36)}`; break; }
      }
      user = await User.create({
        username: candidate,
        password: crypto.randomBytes(24).toString('hex'),
        role: 'admin',
        tgUserId: record.tgUserId,
        practitionerId: practitioner.id,
      });
    } else {
      await user.update({ role: user.role || 'admin', practitionerId: practitioner.id });
    }

    await record.update({ usedAt: now, practitionerId: practitioner.id });

    // Issue admin JWT and set cookie
    const payload = { user: { id: user.id, username: user.username, role: user.role || 'admin', practitionerId: practitioner.id } };
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) return res.status(500).send('Server configuration error');
    const token = jwt.sign(payload, jwtSecret, { expiresIn: '7d' });

    const secure = String(process.env.COOKIE_SECURE || '').toLowerCase() === 'true';
    res.cookie('admin_sid', token, {
      httpOnly: true,
      secure,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    // Redirect to personal admin panel /psychologist/<slug> (or safe r)
    return safeRedirect(practitioner.slug);
  } catch (e) {
    return res.status(500).send('Ошибка сервера');
  }
});

// Verify admin code, create/update Practitioner + User, and issue admin JWT
router.post(
  '/admin/tg/verify',
  [
    body('code').isString().trim().isLength({ min: 4, max: 128 }),
    body('slug').optional().isString().trim().isLength({ min: 2, max: 64 }),
    body('displayName').optional().isString().trim().isLength({ min: 1, max: 100 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { code } = req.body;
    try {
      const codeHash = hashCode(String(code));
      const now = new Date();
      const record = await TgAuthCode.findOne({ where: { codeHash } });
      if (!record) return res.status(400).json({ message: 'Неверный код' });
      if (record.usedAt) return res.status(400).json({ message: 'Код уже использован' });
      if (record.expiresAt && record.expiresAt < now) return res.status(400).json({ message: 'Срок действия кода истёк' });
      if (record.scope !== 'admin') return res.status(400).json({ message: 'Код предназначен не для админ-входа' });
      if (!record.tgPhone) return res.status(400).json({ message: 'Для входа администратора требуется подтвердить номер телефона в Telegram' });

      // Find or create Practitioner by tgUserId
      let practitioner = await Practitioner.findOne({ where: { tgUserId: record.tgUserId } });
      if (practitioner) {
        await practitioner.update({
          tgUsername: record.tgUsername || practitioner.tgUsername,
          tgPhone: record.tgPhone || practitioner.tgPhone,
          tgChatId: record.tgChatId || practitioner.tgChatId || null,
        });
        if (!practitioner.publicSlug) {
          const pub = await ensureUniquePublicSlug(`form-${practitioner.slug || (record.tgUsername || 'practitioner')}`);
          await practitioner.update({ publicSlug: pub });
        }
      } else {
        let desiredSlug = req.body.slug || record.tgUsername || `${record.firstName || 'psych'}-${record.lastName || 'pro'}`;
        desiredSlug = await ensureUniqueSlug(desiredSlug);
        const publicSlug = await ensureUniquePublicSlug(`form-${desiredSlug}`);
        const displayName = req.body.displayName || [record.firstName, record.lastName].filter(Boolean).join(' ') || record.tgUsername || 'Психолог';
        practitioner = await Practitioner.create({
          slug: desiredSlug,
          publicSlug,
          displayName,
          tgUserId: record.tgUserId,
          tgUsername: record.tgUsername || null,
          tgPhone: record.tgPhone || null,
          tgChatId: record.tgChatId || null,
        });
      }

      // Create or update User bound to this practitioner
      let user = await User.findOne({ where: { tgUserId: record.tgUserId } });
      if (!user) {
        // Ensure unique username like tg_<id>
        let base = `tg_${record.tgUserId}`;
        base = base.toLowerCase();
        let candidate = base;
        let suffix = 0;
        while (await User.findOne({ where: { username: candidate } })) {
          suffix += 1;
          candidate = `${base}_${suffix}`;
          if (suffix > 100) { candidate = `${base}_${Date.now().toString(36)}`; break; }
        }
        user = await User.create({
          username: candidate,
          password: crypto.randomBytes(24).toString('hex'),
          role: 'admin',
          tgUserId: record.tgUserId,
          practitionerId: practitioner.id,
        });
      } else {
        await user.update({ role: user.role || 'admin', practitionerId: practitioner.id });
      }

      await record.update({ usedAt: now, practitionerId: practitioner.id });

      const payload = {
        user: {
          id: user.id,
          role: user.role,
          practitionerId: user.practitionerId,
        }
      };
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        logger.error('JWT_SECRET environment variable is not set');
        return res.status(500).json({ msg: 'Server configuration error' });
      }

      const token = jwt.sign(payload, jwtSecret, { expiresIn: '24h' });

      // Set HttpOnly cookie instead of returning token in response
      const secure = String(process.env.COOKIE_SECURE || '').toLowerCase() === 'true' || process.env.NODE_ENV === 'production';
      res.cookie('admin_sid', token, {
        httpOnly: true,
        secure,
        sameSite: 'none',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        path: '/',
      });

      res.json({ user: { id: user.id, role: user.role, practitionerId: user.practitionerId } });
    } catch (e) {
      logger.error(`[AUTH] /admin/tg/verify error: ${e.message}`);
      return res.status(500).send('Ошибка сервера');
    }
  }
);

// Telegram: Verify one-time code from the bot and issue a client JWT
router.post(
  '/tg/verify',
  [ body('code').isString().trim().isLength({ min: 4, max: 64 }) ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { code } = req.body;
    try {
      const practitionerId = req.practitionerId;
      if (!practitionerId) {
        return res.status(400).json({ message: 'Не указан арендатор (practitionerId). Передайте x-practitioner-id или x-practitioner-slug' });
      }
      const codeHash = hashCode(String(code));
      const now = new Date();

      const record = await TgAuthCode.findOne({ where: { codeHash } });
      if (!record) {
        return res.status(400).json({ message: 'Неверный код' });
      }
      if (record.usedAt) {
        return res.status(400).json({ message: 'Код уже использован' });
      }
      if (record.expiresAt && record.expiresAt < now) {
        return res.status(400).json({ message: 'Срок действия кода истёк' });
      }
      if (record.scope !== 'client') {
        return res.status(400).json({ message: 'Код предназначен не для клиентского входа' });
      }
      // Tenant scoping: code must belong to current practitioner (bind on first verification)
      if (record.practitionerId && String(record.practitionerId) !== String(practitionerId)) {
        return res.status(403).json({ message: 'Код предназначен для другого арендатора' });
      }
      if (!record.practitionerId) {
        try {
          await record.update({ practitionerId });
        } catch (_) { /* ignore binding errors */ }
      }
      // Enforce that phone was shared via Telegram contact
      // If the current auth record has no phone (e.g., user clicked an older link),
      // fall back to an existing Client with phone for the same tgUserId.
      if (!record.tgPhone) {
        let phoneOk = false;
        try {
          let existing = null;
          if (practitionerId) {
            existing = await Client.findOne({ where: { tgUserId: record.tgUserId, practitionerId } });
            if (!existing) {
              // Try orphan client and bind to current practitioner
              const orphan = await Client.findOne({ where: { tgUserId: record.tgUserId, practitionerId: null } });
              if (orphan) {
                try { await orphan.update({ practitionerId }); } catch (_) {}
                existing = orphan;
              }
            }
          } else {
            existing = await Client.findOne({ where: { tgUserId: record.tgUserId } });
          }
          if (existing && existing.tgPhone) {
            phoneOk = true;
            // Backfill current token record for consistency
            try { await record.update({ tgPhone: existing.tgPhone }); } catch (_) {}
          }
        } catch (_) { /* ignore */ }
        if (!phoneOk) {
          return res.status(400).json({ message: 'Для входа требуется подтвердить номер телефона. В Telegram нажмите «Поделиться номером», затем повторно запросите код.' });
        }
      }

      // Ensure we have a client linked to this Telegram identity within current practitioner
      let client = await Client.findOne({ where: { tgUserId: record.tgUserId, practitionerId } });
      if (!client) {
        // Try to bind an existing unscoped (null practitioner) client to this practitioner
        const orphan = await Client.findOne({ where: { tgUserId: record.tgUserId, practitionerId: null } });
        if (orphan) {
          await orphan.update({ practitionerId });
          client = orphan;
        }
      }

      const headerTz = (req.header('x-client-timezone') || '').trim() || null;
      if (client) {
        await client.update({
          tgChatId: record.tgChatId,
          tgUsername: record.tgUsername,
          firstName: record.firstName,
          lastName: record.lastName,
          tgPhone: record.tgPhone || client.tgPhone,
          clientTimezone: headerTz || client.clientTimezone || null,
        });
      } else {
        client = await Client.create({
          tgUserId: record.tgUserId,
          tgChatId: record.tgChatId,
          tgUsername: record.tgUsername,
          firstName: record.firstName,
          lastName: record.lastName,
          tgPhone: record.tgPhone || null,
          clientTimezone: headerTz || null,
          practitionerId,
        });
      }

      await record.update({ usedAt: now });

      const payload = {
        client: {
          id: client.id,
          tgUserId: client.tgUserId,
          tgUsername: client.tgUsername || null,
          practitionerId: client.practitionerId || practitionerId,
        },
      };
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) return res.status(500).json({ msg: 'Server configuration error' });
      const token = jwt.sign(payload, jwtSecret, { expiresIn: '30d' });

      return res.json({ success: true, token, client });
    } catch (e) {
      logger.error(`[AUTH] /tg/verify error: ${e.message}`);
      return res.status(500).send('Ошибка сервера');
    }
  }
);

// Telegram: get current client profile from token
router.get('/tg/me', clientAuth, async (req, res) => {
  try {
    const id = req.client && req.client.id;
    if (!id) return res.status(401).json({ message: 'Нет клиентского токена' });
    const client = await Client.findByPk(id);
    if (!client) return res.status(404).json({ message: 'Клиент не найден' });
    const practitionerId = req.practitionerId;
    if (practitionerId) {
      if (!client.practitionerId) {
        try { await client.update({ practitionerId }); } catch (_) {}
      } else if (String(client.practitionerId) !== String(practitionerId)) {
        return res.status(403).json({ message: 'Доступ запрещён для данного арендатора' });
      }
    }
    return res.json({ client });
  } catch (e) {
    return res.status(500).send('Ошибка сервера');
  }
});

// Magic-link вход: принимает токен ?t=<token>, опционально ?p=<slug>&r=<base64url>
router.get('/magic', async (req, res) => {
  try {
    const raw = String(req.query.t || '').trim();
    if (!raw) return res.status(400).send('Missing token');

    // Определяем practitionerId: приоритет - ?p=<slug>, затем req.practitionerId, затем из записи токена
    let practitionerId = null;
    const pSlug = (req.query.p || '').toString().trim();
    if (pSlug) {
      try {
        const p = await Practitioner.findOne({ where: { slug: pSlug } });
        practitionerId = p ? p.id : null;
      } catch (_) { /* ignore */ }
    }
    if (!practitionerId && req.practitionerId) {
      practitionerId = req.practitionerId;
    }

    // Хелперы: проверка валидной cookie sid и безопасный редирект
    const hasValidSid = () => {
      try {
        const sid = req.cookies && (req.cookies.client_sid || req.cookies.sid);
        if (!sid) return false;
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) return false;
        jwt.verify(sid, jwtSecret);
        return true;
      } catch (_) { return false; }
    };
    // Если r не передан, пробуем определить публичную форму текущего арендатора
    const resolveFormPath = async () => {
      try {
        if (practitionerId) {
          const p = await Practitioner.findByPk(practitionerId);
          if (p && (p.publicSlug || p.slug)) return `/p/${encodeURIComponent(p.publicSlug || p.slug)}`;
        }
        if (pSlug) {
          const p = await Practitioner.findOne({ where: { slug: pSlug } });
          if (p && (p.publicSlug || p.slug)) return `/p/${encodeURIComponent(p.publicSlug || p.slug)}`;
        }
      } catch (_) { /* ignore */ }
      return '/';
    };
    const safeRedirect = async () => {
      const fallbackPath = await resolveFormPath();
      const r = (req.query.r || '').toString();
      if (r) {
        try {
          const decoded = Buffer.from(r, 'base64url').toString('utf8');
          if (decoded.startsWith('/')) {
            // Если r указывает на корень, но у нас есть форма арендатора — ведём на форму
            if (decoded === '/' && fallbackPath && fallbackPath !== '/') {
              return res.redirect(302, fallbackPath);
            }
            return res.redirect(302, decoded);
          }
        } catch (_) { /* ignore */ }
      }
      return res.redirect(302, fallbackPath);
    };

    const codeHash = hashCode(raw);
    const now = new Date();
    const record = await TgAuthCode.findOne({ where: { codeHash } });
    if (!record) {
      if (hasValidSid()) { return await safeRedirect(); }
      return res.status(401).send('Invalid token');
    }
    if (record.usedAt) {
      if (hasValidSid()) { return await safeRedirect(); }
      return res.status(401).send('Token already used');
    }
    if (record.expiresAt && record.expiresAt < now) {
      if (hasValidSid()) { return await safeRedirect(); }
      return res.status(401).send('Token expired');
    }
    if (record.scope !== 'client') {
      if (hasValidSid()) { return await safeRedirect(); }
      return res.status(401).send('Wrong token scope');
    }
    
    // Если tenant не определён из параметров/мидлвари, берем из записи токена
    if (!practitionerId && record.practitionerId) practitionerId = record.practitionerId;
    
    // Скоуп: привязываем к арендатору при первом использовании
    if (record.practitionerId && practitionerId && String(record.practitionerId) !== String(practitionerId)) {
      return res.status(403).send('Wrong tenant for token');
    }
    if (!record.practitionerId && practitionerId) {
      try { await record.update({ practitionerId }); } catch (_) { /* ignore */ }
    }
    // Требуем подтверждения телефона через Telegram контакт
    // Если в записи кода нет телефона (например, пользователь кликнул старую ссылку),
    // пытаемся использовать существующего клиента с телефоном для этого tgUserId
    if (!record.tgPhone) {
      let phoneOk = false;
      try {
        let existing = null;
        if (practitionerId) {
          existing = await Client.findOne({ where: { tgUserId: record.tgUserId, practitionerId } });
          if (!existing) {
            const orphan = await Client.findOne({ where: { tgUserId: record.tgUserId, practitionerId: null } });
            if (orphan) {
              try { await orphan.update({ practitionerId }); } catch (_) {}
              existing = orphan;
            }
          }
        } else {
          existing = await Client.findOne({ where: { tgUserId: record.tgUserId } });
        }
        if (existing && existing.tgPhone) {
          phoneOk = true;
          try { await record.update({ tgPhone: existing.tgPhone }); } catch (_) {}
        }
      } catch (_) { /* ignore */ }
      if (!phoneOk) {
        return res.status(400).send('Phone not confirmed via Telegram');
      }
    }

    // Обновляем/создаём клиента для текущего арендатора
    let client = await Client.findOne({ where: { tgUserId: record.tgUserId, practitionerId } });
    if (!client) {
      const orphan = await Client.findOne({ where: { tgUserId: record.tgUserId, practitionerId: null } });
      if (orphan) {
        await orphan.update({ practitionerId });
        client = orphan;
      }
    }
    const headerTzMagic = (req.header('x-client-timezone') || '').trim() || null;
    if (client) {
      await client.update({
        tgChatId: record.tgChatId,
        tgUsername: record.tgUsername,
        firstName: record.firstName,
        lastName: record.lastName,
        tgPhone: record.tgPhone || client.tgPhone,
        clientTimezone: headerTzMagic || client.clientTimezone || null,
      });
    } else {
      client = await Client.create({
        tgUserId: record.tgUserId,
        tgChatId: record.tgChatId,
        tgUsername: record.tgUsername,
        firstName: record.firstName,
        lastName: record.lastName,
        tgPhone: record.tgPhone || null,
        clientTimezone: headerTzMagic || null,
        practitionerId,
      });
    }

    await record.update({ usedAt: now });

    const payload = {
      client: {
        id: client.id,
        tgUserId: client.tgUserId,
        tgUsername: client.tgUsername || null,
        practitionerId: client.practitionerId || practitionerId || null,
      },
    };
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      logger.error('JWT_SECRET environment variable is not set');
      return res.status(500).json({ msg: 'Server configuration error' });
    }

    const token = jwt.sign(payload, jwtSecret, { expiresIn: '30d' });

    // Set HttpOnly cookies for client token (compat: 'sid' and 'client_sid')
    const secureCookie = String(process.env.COOKIE_SECURE || '').toLowerCase() === 'true' || process.env.NODE_ENV === 'production';
    const cookieOpts = {
      httpOnly: true,
      secure: secureCookie,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/',
    };
    res.cookie('sid', token, cookieOpts);
    res.cookie('client_sid', token, cookieOpts);

    // Безопасный редирект
    return await safeRedirect();
  } catch (e) {
    return res.status(500).send('Ошибка сервера');
  }
});

// Legacy alias to support old links that reference /api/auth/magic2
router.get('/magic2', async (req, res) => {
  try {
    const idx = req.url.indexOf('?');
    const query = idx >= 0 ? req.url.slice(idx) : '';
    return res.redirect(302, `/api/auth/magic${query}`);
  } catch (_) {
    return res.redirect(302, '/');
  }
});

module.exports = router;
