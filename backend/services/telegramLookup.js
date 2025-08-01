const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { Api } = require('telegram');

const apiId = parseInt(process.env.TELEGRAM_API_ID || '0', 10);
const apiHash = process.env.TELEGRAM_API_HASH;
const sessionString = process.env.TELEGRAM_SESSION || '';

if (!apiId || !apiHash) {
  throw new Error('Telegram API credentials are not configured');
}

const client = new TelegramClient(new StringSession(sessionString), apiId, apiHash, {
  connectionRetries: 5,
});
let started = false;

async function ensureStarted() {
  if (!started) {
    await client.connect();
    started = true;
  }
}

async function lookupByPhone(phone) {
  await ensureStarted();
  const result = await client.invoke(
    new Api.contacts.ImportContacts({
      contacts: [new Api.InputPhoneContact({ clientId: Date.now(), phone, firstName: 'tmp', lastName: '' })],
    })
  );
  const user = result.users && result.users[0];
  if (!user) return null;

  let avatar = null;
  try {
    const buffer = await client.downloadProfilePhoto(user);
    if (buffer) {
      avatar = buffer.toString('base64');
    }
  } catch (e) {
    // ignore if no avatar
  }

  return {
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    avatar,
  };
}

module.exports = { lookupByPhone };
