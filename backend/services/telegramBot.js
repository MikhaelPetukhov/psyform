let Telegraf, Markup; // Ленивая загрузка из 'telegraf' при старте бота
const crypto = require('crypto');
const { Op } = require('sequelize');
const logger = require('../config/logger');
const { Client, Practitioner, TgAuthCode, Booking } = require('../models');

let bot = null;
// In-memory map to store pending login tokens per Telegram user until they share contact
// key: tgUserId (string), value: { token: string, slug: string|null }
const pendingLoginTokens = new Map();
// Track users who entered admin onboarding mode to issue admin-scoped codes on contact share
const adminModeUsers = new Set(); // keys: tgUserId (string)

function getAuthCodeTTLMinutes() {
  const v = parseInt(process.env.AUTH_CODE_TTL_MIN || '10', 10);
  return Number.isFinite(v) && v > 0 ? v : 10;
}

function hashCode(code) {
  const pepper = process.env.AUTH_CODE_SECRET || (process.env.JWT_SECRET || 'secret');
  return crypto.createHash('sha256').update(`${code}:${pepper}`).digest('hex');
}

function genCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getPublicWebUrl() {
  return process.env.PUBLIC_WEB_URL || '';
}

function decodeBase64Url(value) {
  if (!value) return null;
  try {
    let normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    while (normalized.length % 4) normalized += '=';
    return Buffer.from(normalized, 'base64').toString('utf8');
  } catch (_) {
    return null;
  }
}

// Ensure we create a unique auth code entry, or reuse an active one for the same user.
// Scope can be 'client' (default) or 'admin'.
// Returns { record, code, codeHash, reused }
async function ensureUniqueAuthCodeForClient(client, preferredCode = null, scope = 'client', practitionerId = null) {
  const ttl = getAuthCodeTTLMinutes();
  const now = new Date();
  const calcExpiresAt = () => new Date(Date.now() + ttl * 60 * 1000);

  async function tryAllocate(code) {
    const codeHash = hashCode(code);
    try {
      const existing = await TgAuthCode.findOne({ where: { codeHash } });
      if (existing) {
        const notExpired = !existing.expiresAt || existing.expiresAt > now;
        const notUsed = !existing.usedAt;
        // If the same user tries again and the code is still valid, reuse/update it idempotently
        const samePractitioner = !practitionerId
          || !existing.practitionerId
          || String(existing.practitionerId) === String(practitionerId);
        if (String(existing.tgUserId) === String(client.tgUserId)
          && existing.scope === scope
          && notExpired
          && notUsed
          && samePractitioner) {
          const updatePayload = {
            tgChatId: client.tgChatId,
            tgUsername: client.tgUsername,
            firstName: client.firstName,
            lastName: client.lastName,
            tgPhone: client.tgPhone || null,
            expiresAt: calcExpiresAt(),
          };
          if (practitionerId && !existing.practitionerId) {
            updatePayload.practitionerId = practitionerId;
          }
          await existing.update(updatePayload);
          return { record: existing, code, codeHash, reused: true };
        }
        // Collision with other user or used/expired entry: do not reuse, request another code
        return null;
      }

      const record = await TgAuthCode.create({
        codeHash,
        tgUserId: client.tgUserId,
        tgChatId: client.tgChatId,
        tgUsername: client.tgUsername,
        firstName: client.firstName,
        lastName: client.lastName,
        tgPhone: client.tgPhone || null,
        expiresAt: calcExpiresAt(),
        scope,
        practitionerId: practitionerId || null,
      });
      return { record, code, codeHash, reused: false };
    } catch (e) {
      // Race condition: another process created the same code concurrently
      if (e && e.name === 'SequelizeUniqueConstraintError') return null;
      throw e;
    }
  }

  if (preferredCode) {
    const res = await tryAllocate(preferredCode);
    if (res) return res;
  }

  // Try several times with 6-digit codes to avoid rare collisions
  for (let i = 0; i < 5; i++) {
    const code = genCode();
    const res = await tryAllocate(code);
    if (res) return res;
  }

  // Fallback: strong random token (suitable for magic-link, less friendly for manual input)
  const fallback = crypto.randomBytes(16).toString('hex');
  const res = await tryAllocate(fallback);
  if (res) return res;

  throw new Error('Unable to generate unique auth code');
}

async function createOrUpdateClientFromCtx(ctx, extra = {}) {
  const from = ctx.from || {};
  const chat = ctx.chat || {};
  const tgUserId = String(from.id);
  const tgChatId = String(chat.id);

  const payload = {
    tgUserId,
    tgChatId,
    tgUsername: from.username ? String(from.username).toLowerCase() : null,
    firstName: from.first_name || null,
    lastName: from.last_name || null,
    ...extra,
  };

  let client = await Client.findOne({ where: { tgUserId } });
  if (client) {
    await client.update(payload);
    try { logger.info(`[TELEGRAM BOT] client upsert: update tgUserId=${tgUserId} chatId=${tgChatId} username=${payload.tgUsername || '-'} phone=${payload.tgPhone || '-'}`); } catch (_) {}
  } else {
    client = await Client.create(payload);
    try { logger.info(`[TELEGRAM BOT] client upsert: create tgUserId=${tgUserId} chatId=${tgChatId} username=${payload.tgUsername || '-'} phone=${payload.tgPhone || '-'}`); } catch (_) {}
  }
  return client;
}

async function sendAuthCode(ctx, client, forcedCode = null, options = {}) {
  const opts = options || {};
  const resolvedPractitionerId = opts.practitionerId
    || (opts.practitioner && opts.practitioner.id)
    || client?.practitionerId
    || null;

  const { code } = await ensureUniqueAuthCodeForClient(client, forcedCode, 'client', resolvedPractitionerId);
  const ttl = getAuthCodeTTLMinutes();

  const baseUrl = getPublicWebUrl();
  const isDevLike = !baseUrl || baseUrl.includes('localhost') || baseUrl.includes('your-domain.com');
  if (isDevLike) {
    const fallbackUrl = baseUrl || process.env.PUBLIC_WEB_URL || 'http://localhost:3001';
    await ctx.reply(
      `🔐 Код для входа: ${code}\n\nПерейдите на сайт ${fallbackUrl} и введите этот код в форме авторизации.`
    );
    return;
  }

  let practitionerSlug = opts.practitionerSlug || null;
  if (!practitionerSlug && opts.practitioner) {
    practitionerSlug = opts.practitioner.slug || opts.practitioner.publicSlug || null;
  }
  if (!practitionerSlug && resolvedPractitionerId) {
    try {
      const p = await Practitioner.findByPk(resolvedPractitionerId);
      if (p) practitionerSlug = p.slug || p.publicSlug || null;
    } catch (_) { /* ignore */ }
  }
  if (!practitionerSlug) {
    const fallbackSlug = (process.env.DEFAULT_PRACTITIONER_SLUG || '').trim();
    practitionerSlug = fallbackSlug || null;
  }

  const postLoginPath = (process.env.POST_LOGIN_REDIRECT || '').trim();
  const rParam = postLoginPath && postLoginPath.startsWith('/')
    ? `&r=${encodeURIComponent(Buffer.from(postLoginPath, 'utf8').toString('base64url'))}`
    : '';
  const link = `${baseUrl.replace(/\/$/, '')}/api/auth/magic?t=${encodeURIComponent(code)}${practitionerSlug ? `&p=${encodeURIComponent(practitionerSlug)}` : ''}${rParam}`;

  await ctx.reply(
    `🔐 Теперь нажмите кнопку ниже, чтобы войти на сайт (ссылка действует ${ttl} минут):`,
    Markup.inlineKeyboard([[Markup.button.url('🌐 Войти на сайт', link)]])
  );
}

// Admin-scoped auth code sender (shows numeric code or magic-link when PUBLIC_WEB_URL is set)
async function sendAdminAuthCode(ctx, identity, forcedCode = null) {
  const { code } = await ensureUniqueAuthCodeForClient(identity, forcedCode, 'admin');
  const ttl = getAuthCodeTTLMinutes();
  const baseUrl = getPublicWebUrl();

  if (!baseUrl || baseUrl.includes('localhost') || baseUrl.includes('your-domain.com')) {
    const text = `✅ Готово!\nВаш администраторский код для входа: ${code}\nСрок действия: ${ttl} мин.\n\nДля автоматического входа укажите PUBLIC_WEB_URL в переменных окружения и следуйте по инлайн‑ссылке.`;
    await ctx.reply(text, { disable_web_page_preview: true });
  } else {
    const link = `${baseUrl.replace(/\/$/, '')}/api/auth/admin/magic?t=${encodeURIComponent(code)}`;
    const text = `✅ Готово!\nНажмите кнопку ниже, чтобы войти в кабинет администратора.\nСсылка действует ${ttl} мин.`;
    await ctx.reply(
      text,
      { disable_web_page_preview: true, ...Markup.inlineKeyboard([[Markup.button.url('🔐 Войти в кабинет', link)]]) }
    );
  }
}

async function sendReminderMessage(client, booking) {
  const dt = new Date(booking.slotTime);
  const tz = process.env.TIMEZONE || 'Europe/Moscow';
  const dateStr = dt.toLocaleString('ru-RU', { timeZone: tz, hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });

  const text = `Напоминание: завтра у вас сессия в ${dateStr}. Подтвердите, пожалуйста.`;

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('Да, подтверждаю ✅', `confirm_booking:${booking.id}`),
      Markup.button.callback('Нет, отменить ❌', `decline_booking:${booking.id}`),
    ],
  ]);

  await bot.telegram.sendMessage(client.tgChatId, text, keyboard);
}

function startTelegramBot() {
  if (process.env.NODE_ENV === 'test') {
    logger.info('[TELEGRAM BOT] Disabled in test env');
    return null;
  }
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    logger.warn('[TELEGRAM BOT] TELEGRAM_BOT_TOKEN is missing, bot not started');
    return null;
  }

  // Ленивая загрузка telegraf (уменьшает пиковое потребление памяти при старте контейнера)
  ({ Telegraf, Markup } = require('telegraf'));
  bot = new Telegraf(token);

  bot.start(async (ctx) => {
    try {
      // Parse deep-link payload if present: /start login_<token>
      const payload = (ctx.startPayload || '').trim();
      const tgUserId = String(ctx.from?.id || '');
      if (payload && payload.startsWith('admin_login_')) {
        const token = payload.substring('admin_login_'.length);
        if (token && tgUserId) {
          pendingLoginTokens.set(tgUserId, { token, slug: null });
        }
        if (tgUserId) adminModeUsers.add(tgUserId);
      } else if (payload && payload.startsWith('login_')) {
        const rest = payload.substring('login_'.length);
        let token = rest;
        let slug = null;
        const idx = rest.indexOf('_');
        if (idx >= 0) {
          token = rest.substring(0, idx);
          const encodedSlug = rest.substring(idx + 1);
          const decoded = decodeBase64Url(encodedSlug);
          slug = decoded ? decoded.trim() : null;
        }
        if (token && tgUserId) {
          pendingLoginTokens.set(tgUserId, { token, slug: slug || null });
        }
      }
      // Enable admin mode if payload contains admin directive
      if (payload && (payload === 'admin' || payload === 'admin_login' || payload.startsWith('admin'))) {
        if (tgUserId) adminModeUsers.add(tgUserId);
      }

      // Create/update client without phone first
      await createOrUpdateClientFromCtx(ctx);
      const isAdmin = adminModeUsers.has(String(ctx.from?.id || ''));
      await ctx.reply(
        isAdmin
          ? 'Привет! Это PsyForm. Поделитесь номером телефона и получите ссылку для входа в кабинет администратора.'
          : 'Привет! Это PsyForm. Поделитесь номером телефона и получите ссылку для входа на сайт.',
        Markup.keyboard([[Markup.button.contactRequest('📱 Поделиться номером')]]).oneTime().resize()
      );
    } catch (e) {
      logger.error(`[TELEGRAM BOT] /start error: ${e.message}`);
    }
  });

  // Admin command to start admin onboarding flow
  bot.command('admin', async (ctx) => {
    try {
      const tgUserId = String(ctx.from?.id || '');
      if (tgUserId) adminModeUsers.add(tgUserId);
      await ctx.reply(
        'Режим администратора активирован. Поделитесь номером телефона, чтобы получить администраторский код для входа в кабинет.',
        Markup.keyboard([[Markup.button.contactRequest('📱 Поделиться номером')]]).oneTime().resize()
      );
    } catch (e) {
      logger.error(`[TELERAM BOT] /admin error: ${e.message}`);
    }
  });

  bot.hears('🔐 Получить код без номера', async (ctx) => {
    try {
      await ctx.reply('Чтобы получить код, пожалуйста, нажмите кнопку "Поделиться номером" и отправьте ваш контакт в этот чат.');
    } catch (e) {
      logger.error(`[TELEGRAM BOT] code request error: ${e.message}`);
    }
  });

  // Handle contact share
  bot.on('contact', async (ctx) => {
    try {
      const contact = ctx.message.contact;
      const phone = (contact && contact.phone_number) ? contact.phone_number.replace(/\D/g, '') : null;
      
      // Validate that contact belongs to this user
      if (contact.user_id !== ctx.from.id) {
        await ctx.reply('❌ Пожалуйста, поделитесь своим собственным контактом.');
        return;
      }
      const tgUserIdStr = String(ctx.from.id);
      const isAdmin = adminModeUsers.has(tgUserIdStr);

      if (isAdmin) {
        // Admin flow: create a temporary identity object without persisting Client
        const identity = {
          tgUserId: tgUserIdStr,
          tgChatId: String(ctx.chat?.id || ctx.from.id),
          tgUsername: ctx.from?.username || null,
          firstName: ctx.from?.first_name || null,
          lastName: ctx.from?.last_name || null,
          tgPhone: phone || null,
        };
        // Always generate a fresh numeric admin code (do not reuse deep-link token)
        await sendAdminAuthCode(ctx, identity, null);
        adminModeUsers.delete(tgUserIdStr);
      } else {
        const pendingEntryRaw = pendingLoginTokens.get(tgUserIdStr) || null;
        let pendingToken = null;
        let pendingSlug = null;
        if (pendingEntryRaw) {
          if (typeof pendingEntryRaw === 'string') {
            pendingToken = pendingEntryRaw;
          } else if (typeof pendingEntryRaw === 'object') {
            pendingToken = pendingEntryRaw.token || null;
            pendingSlug = pendingEntryRaw.slug || null;
          }
        }

        let practitioner = null;
        if (pendingSlug) {
          try {
            practitioner = await Practitioner.findOne({
              where: {
                [Op.or]: [
                  { publicSlug: pendingSlug },
                  { slug: pendingSlug },
                ],
              },
            });
          } catch (_) { /* ignore */ }
        }
        if (!practitioner) {
          const fallbackSlug = (process.env.DEFAULT_PRACTITIONER_SLUG || '').trim();
          if (fallbackSlug) {
            try {
              practitioner = await Practitioner.findOne({
                where: {
                  [Op.or]: [
                    { slug: fallbackSlug },
                    { publicSlug: fallbackSlug },
                  ],
                },
              });
            } catch (_) { /* ignore */ }
          }
        }

        const extraPayload = { tgPhone: phone };
        if (practitioner && practitioner.id) {
          extraPayload.practitionerId = practitioner.id;
        }
        const client = await createOrUpdateClientFromCtx(ctx, extraPayload);

        const practitionerId = practitioner?.id || client?.practitionerId || null;

        await sendAuthCode(ctx, client, pendingToken || null, {
          practitioner,
          practitionerId,
        });

        if (pendingEntryRaw) pendingLoginTokens.delete(tgUserIdStr);
      }
    } catch (e) {
      logger.error(`[TELEGRAM BOT] contact error: ${e.message}`);
    }
  });

  // Inline callbacks for reminders
  bot.on('callback_query', async (ctx) => {
    try {
      const data = ctx.callbackQuery.data || '';
      const tz = process.env.TIMEZONE || 'Europe/Moscow';
      const fromId = String(ctx.from?.id || '');

      async function ensureOwnership(booking) {
        try {
          if (!booking) return false;
          // Primary: linked client
          if (booking.clientId) {
            const c = await Client.findByPk(booking.clientId);
            if (!c) return false;
            if (String(c.tgUserId || '') === fromId) return true;
            return false;
          }
          // Fallback: stored telegramUserId in booking (if present)
          if (booking.telegramUserId && String(booking.telegramUserId) === fromId) return true;
          return false;
        } catch (_) {
          return false;
        }
      }

      async function notifyPractitionerAbout(booking, actionText) {
        try {
          if (!booking || !booking.practitionerId) return;
          const p = await Practitioner.findByPk(booking.practitionerId);
          if (!p || !p.tgChatId) return;
          const dt = new Date(booking.slotTime);
          const dateStr = dt.toLocaleString('ru-RU', { timeZone: tz, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
          const name = booking.clientName || 'клиент';
          let extra = { disable_web_page_preview: true };
          try {
            const base = getPublicWebUrl();
            if (base && p.slug) {
              const url = `${base.replace(/\/$/, '')}/psychologist/${encodeURIComponent(p.slug)}`;
              const label = actionText === 'declined' ? 'Перезаписать' : 'Открыть кабинет';
              extra = { ...extra, ...Markup.inlineKeyboard([[Markup.button.url(label, url)]]) };
            }
          } catch (_) { /* ignore */ }
          const title = actionText === 'declined' ? 'Отмена записи' : 'Подтверждение записи';
          const line = actionText === 'declined' ? 'отменил' : 'подтвердил';
          await bot.telegram.sendMessage(p.tgChatId, `${title}: ${name} ${line} приём на ${dateStr} (МСК).`, extra);
        } catch (_) { /* ignore */ }
      }

      if (data.startsWith('confirm_booking:') || data.startsWith('decline_booking:')) {
        const id = data.split(':')[1];
        const booking = await Booking.findByPk(id);
        if (!booking) {
          await ctx.answerCbQuery('Запись не найдена');
          return;
        }
        // Ownership check
        const allowed = await ensureOwnership(booking);
        if (!allowed) {
          await ctx.answerCbQuery('Действие недоступно', { show_alert: true });
          return;
        }

        const newStatus = data.startsWith('confirm_') ? 'confirmed' : 'declined';
        await booking.update({ clientConfirmation: newStatus });
        try { await ctx.editMessageReplyMarkup(); } catch (_) {}
        await ctx.answerCbQuery(newStatus === 'confirmed' ? 'Подтверждено ✅' : 'Отменено ❌');
        await ctx.reply(newStatus === 'confirmed' ? 'Спасибо! Приём подтверждён ✅' : 'Понял. Приём отменён ❌');

        await notifyPractitionerAbout(booking, newStatus);
      }
    } catch (e) {
      logger.error(`[TELEGRAM BOT] callback error: ${e.message}`);
    }
  });

  // --- Webhook vs Long-polling ---
  const webhookEnabled = String(process.env.TELEGRAM_WEBHOOK_ENABLED || 'false').toLowerCase() === 'true';
  const publicUrl = (process.env.PUBLIC_WEB_URL || '').trim();
  if (webhookEnabled && publicUrl && publicUrl.startsWith('http')) {
    const secret = (process.env.TELEGRAM_WEBHOOK_SECRET || 'dev-secret').trim();
    const path = `/api/telegram/webhook/${secret}`;
    const fullUrl = `${publicUrl.replace(/\/$/, '')}${path}`;
    // Настраиваем webhook и НЕ запускаем long-polling
    bot.telegram.setWebhook(fullUrl)
      .then(async () => {
        try {
          const me = await bot.telegram.getMe();
          logger.info(`[TELEGRAM BOT] Webhook set to ${path} as @${me?.username || '-'} (id=${me?.id || '-'})`);
        } catch (_) {
          logger.info(`[TELEGRAM BOT] Webhook set to ${path}`);
        }
      })
      .catch((e) => logger.error(`[TELEGRAM BOT] setWebhook error: ${e.message}`));
    // Telegraf сам не слушает порт — обработка будет в Express роуте /api/telegram/webhook/:secret
    return bot;
  }

  // Fallback: long-polling для локальной разработки
  bot.launch()
    .then(async () => {
      try {
        const me = await bot.telegram.getMe();
        logger.info(`[TELEGRAM BOT] Started via long polling as @${me?.username || '-'} (id=${me?.id || '-'})`);
      } catch (e) {
        logger.info('[TELEGRAM BOT] Started via long polling');
      }
    })
    .catch((e) => logger.error(`[TELEGRAM BOT] Launch error: ${e.message}`));
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));

  return bot;
}

/**
 * Send booking confirmation request to client
 */
async function sendBookingConfirmationRequest(booking) {
  if (!bot) {
    logger.warn('Telegram bot not initialized, cannot send confirmation request');
    return;
  }

  try {
    const client = booking.client;
    if (!client || (!client.tgUserId && !client.tgChatId)) {
      logger.warn('No Telegram ID for booking confirmation request');
      return;
    }

    // Prefer chatId for private chats; fallback to userId (равен chatId в личных чатах)
    const chatId = client.tgChatId || client.tgUserId;
    try { logger.info(`[TELEGRAM BOT] confirm: booking=${booking.id} chatId=${chatId} userId=${client.tgUserId || '-'} practitionerId=${booking.practitionerId || '-'} slot=${booking.slotTime}..${booking.endTime}`); } catch (_) {}

    const practitioner = await Practitioner.findByPk(booking.practitionerId);
    const practitionerName = practitioner ? practitioner.displayName : 'Психолог';
    
    const slotTime = new Date(booking.slotTime);
    const endTime = new Date(booking.endTime);
    
    const dateStr = slotTime.toLocaleDateString('ru-RU', { 
      timeZone: 'Europe/Moscow',
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
    
    const timeStr = `${slotTime.toLocaleTimeString('ru-RU', { 
      timeZone: 'Europe/Moscow',
      hour: '2-digit', 
      minute: '2-digit' 
    })}-${endTime.toLocaleTimeString('ru-RU', { 
      timeZone: 'Europe/Moscow',
      hour: '2-digit', 
      minute: '2-digit' 
    })}`;

    const message = `📅 Подтвердите, пожалуйста, вашу запись:

👨‍⚕️ Психолог: ${practitionerName}
📆 Дата: ${dateStr}
🕐 Время: ${timeStr} (МСК)

Подтверждаете ли вы участие в этой сессии?`;

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ Подтверждаю', `confirm_booking:${booking.id}`),
        Markup.button.callback('❌ Отменяю', `decline_booking:${booking.id}`)
      ]
    ]);

    try { logger.info(`[TELEGRAM BOT] sendMessage -> chatId=${chatId} textPreview=${JSON.stringify(message).slice(0,120)}`); } catch (_) {}
    await bot.telegram.sendMessage(chatId, message, keyboard);
    
    logger.info(`Confirmation request sent to client chatId=${chatId} for booking ${booking.id}`);
    
  } catch (error) {
    const desc = (error && error.response && error.response.description) ? error.response.description : (error?.message || 'Unknown error');
    logger.error(`[TELEGRAM BOT] confirm error: ${desc}`);
    throw error;
  }
}

// Legacy function - use notifyClientReminder instead
async function sendReminder(booking) {
  return await notifyClientReminder(booking, '24h');
}

// Generic client reminder: when = '24h' | '1h'
async function notifyClientReminder(booking, when = '24h') {
  if (!bot) return false;
  if (!booking || !booking.clientId) return false;
  const client = await Client.findByPk(booking.clientId);
  if (!client || !client.tgChatId) return false;

  const dt = new Date(booking.slotTime);
  const tz = process.env.TIMEZONE || 'Europe/Moscow';
  const dateStr = dt.toLocaleString('ru-RU', { timeZone: tz, hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
  let text = when === '1h'
    ? `Напоминание: через 1 час у вас сессия (${dateStr}). Подтвердите, пожалуйста.`
    : `Напоминание: завтра у вас сессия (${dateStr}). Подтвердите, пожалуйста.`;

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('Да, подтверждаю ✅', `confirm_booking:${booking.id}`),
      Markup.button.callback('Нет, отменить ❌', `decline_booking:${booking.id}`),
    ],
  ]);

  await bot.telegram.sendMessage(client.tgChatId, text, keyboard);
  return true;
}

async function sendNewBookingMessage(client, booking) {
  const dt = new Date(booking.slotTime);
  const tz = process.env.TIMEZONE || 'Europe/Moscow';
  const dateStr = dt.toLocaleString('ru-RU', { timeZone: tz, hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });

  const text = `Создана запись на ${dateStr}. Пожалуйста, подтвердите.`;

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('Да, подтверждаю ✅', `confirm_booking:${booking.id}`),
      Markup.button.callback('Нет, отменить ❌', `decline_booking:${booking.id}`),
    ],
  ]);

  await bot.telegram.sendMessage(client.tgChatId, text, keyboard);
}

async function notifyNewShortNoticeBooking(booking) {
  if (!bot) return false;
  if (!booking || !booking.clientId) return false;
  const client = await Client.findByPk(booking.clientId);
  if (!client || !client.tgChatId) return false;
  await sendNewBookingMessage(client, booking);
  return true;
}

// Notify practitioner (admin) about newly created booking
async function notifyPractitionerNewBooking(booking) {
  if (!bot) return false;
  if (!booking || !booking.practitionerId) return false;
  try {
    const p = await Practitioner.findByPk(booking.practitionerId);
    if (!p || !p.tgChatId) return false;
    const { formatTimeWithZone, createTimeRange } = require('../utils/timezone');
    const timeRange = createTimeRange(booking.slotTime, booking.endTime, booking.sourceTimezone || 'Europe/Moscow');
    const moscowTime = formatTimeWithZone(booking.slotTime, 'Europe/Moscow');
    const dateStr = `${moscowTime.time} ${moscowTime.date}`;
    const name = booking.clientName || 'клиент';

    // Optional link to admin panel
    let extra = { disable_web_page_preview: true };
    try {
      const base = getPublicWebUrl();
      if (base && p.slug) {
        const url = `${base.replace(/\/$/, '')}/psychologist/${encodeURIComponent(p.slug)}`;
        extra = { ...extra, ...Markup.inlineKeyboard([[Markup.button.url('Открыть кабинет', url)]]) };
      }
    } catch (_) { /* ignore */ }

    await bot.telegram.sendMessage(p.tgChatId, `Новая запись: ${name} — ${dateStr}.`, extra);
    return true;
  } catch (_) {
    return false;
  }
}

// Notify client on any new booking creation (generic confirmation message)
async function notifyBookingCreated(booking) {
  if (!bot) return false;
  if (!booking || !booking.clientId) return false;
  const client = await Client.findByPk(booking.clientId);
  if (!client || !client.tgChatId) return false;

  const dt = new Date(booking.slotTime);
  const tz = process.env.TIMEZONE || 'Europe/Moscow';
  const dateStr = dt.toLocaleString('ru-RU', { timeZone: tz, hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
  let practitionerName = 'специалисту';
  let text = '';
  try {
    if (booking.practitionerId) {
      const p = await Practitioner.findByPk(booking.practitionerId);
      if (p) {
        practitionerName = p.displayName || practitionerName;
        const tmpl = p.clientMessageTemplate;
        if (tmpl && tmpl.trim()) {
          const timeStr = dt.toLocaleTimeString('ru-RU', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
          const vars = {
            '{{clientName}}': client.firstName || client.tgUsername || 'клиент',
            '{{practitionerName}}': practitionerName,
            '{{date}}': dateStr,
            '{{time}}': timeStr,
          };
          text = Object.keys(vars).reduce((acc, k) => acc.split(k).join(vars[k]), tmpl);
        }
      }
    }
  } catch (_) { /* ignore and fallback */ }
  if (!text) {
    text = `Вы записаны на приём к ${practitionerName} на ${dateStr}.\nСсылка на видеосессию придёт ближе к началу сеанса.`;
  }

  try {
    await bot.telegram.sendMessage(client.tgChatId, text);
    return true;
  } catch (_) {
    return false;
  }
}

function getBot() { return bot; }

const sendRescheduleNotification = async (booking, oldStart, oldEnd) => {
  if (!bot) {
    logger.warn('Telegram bot not initialized, skipping reschedule notification');
    return;
  }

  try {
    const chatId = booking.client.tgChatId || booking.client.tgUserId;
    if (!chatId) {
      logger.warn(`No chat ID for client ${booking.client.clientName}`);
      return;
    }

    const oldTime = formatBookingTime(oldStart, oldEnd);
    const newTime = formatBookingTime(booking.slotTime, booking.endTime);

    const message = `📅 *Время вашей сессии изменено*\n\n` +
      `Старое время: ${oldTime}\n` +
      `Новое время: ${newTime}\n\n` +
      `Клиент: ${booking.clientName}\n\n` +
      `Если у вас есть вопросы, свяжитесь с психологом.`;

    await bot.telegram.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    logger.info(`Reschedule notification sent to client ${booking.client.clientName}`);

  } catch (error) {
    logger.error(`Error sending reschedule notification: ${error.message}`);
    throw error;
  }
};

module.exports = { 
  startTelegramBot, 
  getBot, 
  sendReminder, 
  hashCode, 
  notifyNewShortNoticeBooking, 
  notifyBookingCreated, 
  ensureUniqueAuthCodeForClient, 
  notifyPractitionerNewBooking, 
  notifyClientReminder,
  sendBookingConfirmationRequest,
  sendRescheduleNotification
};
