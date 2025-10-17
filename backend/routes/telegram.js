const express = require('express');
const router = express.Router();
const { getBot } = require('../services/telegramBot');
const logger = require('../config/logger');

router.get('/status', (req, res) => {
  res.json({
    ok: true,
    publicWebUrl: process.env.PUBLIC_WEB_URL || null,
    cookieSecure: String(process.env.COOKIE_SECURE || '').toLowerCase() === 'true',
  });
});

// Get bot info for frontend (username + t.me link)
router.get('/bot', async (req, res) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return res.status(404).json({ configured: false, error: 'Bot token not configured' });
  }

  try {
    // Prefer already launched bot instance
    const running = typeof getBot === 'function' ? getBot() : null;
    let username = null;
    if (running) {
      const me = await running.telegram.getMe();
      username = me && me.username ? me.username : null;
    }
    // Fallback: create a temporary Telegraf instance just to call getMe()
    if (!username) {
      const { Telegraf } = require('telegraf');
      const temp = new Telegraf(botToken);
      const me = await temp.telegram.getMe();
      username = me && me.username ? me.username : null;
    }

    // Final fallback: env-provided username (frontend-style) or hardcoded placeholder
    if (!username) {
      const envUser = (process.env.REACT_APP_TELEGRAM_BOT_USERNAME || '').trim().replace(/^@/, '');
      username = envUser || 'PsyForm_bot';
    }

    const link = `https://t.me/${username}`;
    return res.json({ username, link, configured: true });
  } catch (e) {
    const envUser = (process.env.REACT_APP_TELEGRAM_BOT_USERNAME || '').trim().replace(/^@/, '');
    if (envUser) {
      return res.json({ username: envUser, link: `https://t.me/${envUser}`, configured: true });
    }
    return res.status(500).json({ configured: false, error: 'Failed to fetch bot info' });
  }
});

// Resolve Telegram username to check that it exists for the bot
router.get('/username', async (req, res) => {
  const raw = (req.query.username || '').trim();
  if (!raw) {
    return res.status(400).json({ error: 'username query parameter is required' });
  }
  const normalized = raw.replace(/^@/, '');
  if (!/^[a-zA-Z0-9_]{5,}$/.test(normalized)) {
    return res.status(400).json({ error: 'Invalid username format' });
  }

  const bot = typeof getBot === 'function' ? getBot() : null;
  if (!bot) {
    return res.status(503).json({ error: 'Bot is not initialized' });
  }

  try {
    const chat = await bot.telegram.getChat(`@${normalized}`);
    if (chat && chat.type === 'private') {
      return res.json({ ok: true });
    }
    return res.status(404).json({ ok: false });
  } catch (err) {
    try { logger.warn(`[TELEGRAM] username lookup failed for ${normalized}: ${err.message}`); } catch (_) {}
    const code = err?.response?.error_code;
    if (code === 400) {
      return res.status(404).json({ ok: false });
    }
    return res.status(502).json({ error: 'Lookup failed' });
  }
});

module.exports = router;
