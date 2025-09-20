const { TelegramClient, Api } = require('telegram');
const { StringSession } = require('telegram/sessions');
const logger = require('../config/logger');

const isTest = process.env.NODE_ENV === 'test';
const apiIdRaw = process.env.TELEGRAM_API_ID;
const apiHash = process.env.TELEGRAM_API_HASH;
const sessionString = process.env.TELEGRAM_SESSION ? process.env.TELEGRAM_SESSION.replace(/['"]/g, '') : '';
const apiId = apiIdRaw ? parseInt(apiIdRaw, 10) : undefined;
const disabled = isTest || !apiId || !apiHash || !sessionString;

let client = null;
async function ensureClient() {
  if (disabled) return null;
  if (client) return client;
  const stringSession = new StringSession(sessionString);
  client = new TelegramClient(stringSession, apiId, apiHash, { connectionRetries: 5 });
  return client;
}

async function lookupByPhone(phone) {
  logger.info(`📞 [TELEGRAM] === LOOKUP REQUEST START ===`);
  logger.info(`📞 [TELEGRAM] Input phone: "${phone}"`);
  
  // If disabled (tests or no ENV), return null.
  if (disabled) {
    return null;
  }

  try {
    const client = await ensureClient();
    if (!client) return null;
    if (!client.connected) {
      await client.connect();
      if (!client.connected) return null;
    }

    const sanitizedPhone = phone.replace(/\D/g, '');
    logger.info(`🧹 [TELEGRAM] Sanitized phone: "${sanitizedPhone}"`);
    
    if (!sanitizedPhone) {
      logger.warn('❌ [TELEGRAM] Empty sanitized phone, returning null');
      logger.info(`📞 [TELEGRAM] === LOOKUP REQUEST END (EMPTY PHONE) ===`);
      return null;
    }

    logger.info('🚀 [TELEGRAM] Making API call to contacts.ResolvePhone...');
    
    // Using a more direct method to find a user by phone
    const result = await client.invoke(
      new Api.contacts.ResolvePhone({ phone: sanitizedPhone })
    );
    
    // Minimal logging in production; avoid noisy output in tests

    if (result && result.users && result.users.length > 0) {
      const user = result.users[0];
      let avatar = null;
      if (user.photo) {
        try {
          const buffer = await client.downloadProfilePhoto(user, { isBig: false });
          if (buffer && buffer.length > 0) {
            avatar = Buffer.from(buffer).toString('base64');
          } else {
            // no avatar
          }
        } catch (photoErr) {
          logger.error('📸 [TELEGRAM] Photo download failed:', photoErr.message);
        }
      }
      
      const userData = {
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        avatar: avatar,
      };
      
      return userData;
    }
    
    return null;

  } catch (err) {
    logger.error(`❌ [TELEGRAM] Lookup error for phone ${phone}:`, err.message);
    return null;
  }
}

async function lookupByUsername(username) {
  logger.info(`📛 [TELEGRAM] === USERNAME LOOKUP START ===`);
  logger.info(`📛 [TELEGRAM] Input username: "${username}"`);

  if (disabled) {
    return null;
  }

  try {
    let uname = String(username || '').trim().replace(/^@+/, '');
    if (!uname) {
      logger.warn('❌ [TELEGRAM] Empty username, returning null');
      logger.info(`📛 [TELEGRAM] === USERNAME LOOKUP END (EMPTY) ===`);
      return null;
    }

    const client = await ensureClient();
    if (!client) return null;
    if (!client.connected) {
      await client.connect();
      if (!client.connected) return null;
    }

    const result = await client.invoke(new Api.contacts.ResolveUsername({ username: uname }));

    const users = result && result.users ? result.users : [];
    if (users.length === 0) {
      return null;
    }

    const user = users[0];
    let avatar = null;
    if (user.photo) {
      try {
        const buffer = await client.downloadProfilePhoto(user, { isBig: false });
        if (buffer && buffer.length > 0) {
          avatar = Buffer.from(buffer).toString('base64');
        }
      } catch (e) {
        logger.error('📸 [TELEGRAM] Photo download failed (username):', e.message);
      }
    }

    const userData = {
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      avatar,
    };
    return userData;
  } catch (err) {
    logger.error(`❌ [TELEGRAM] Username lookup error for ${username}:`, err.message);
    return null;
  }
}

module.exports = { lookupByPhone, lookupByUsername };
