const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const input = require('input'); // You'll need to install this: npm install input
require('dotenv').config({ path: '../.env' });

const apiId = parseInt(process.env.TELEGRAM_API_ID, 10);
const apiHash = process.env.TELEGRAM_API_HASH;

if (!apiId || !apiHash) {
  console.error('Missing TELEGRAM_API_ID or TELEGRAM_API_HASH in .env file');
  process.exit(1);
}

console.log('=== Telegram Session Generator ===');
console.log('This script will help you generate a session string for Telegram API');
console.log('You will need to provide your phone number and verification code');
console.log('');

(async () => {
  const stringSession = new StringSession(''); // Start with empty session
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  try {
    console.log('Connecting to Telegram...');
    
    await client.start({
      phoneNumber: async () => {
        const phone = await input.text('Enter your phone number (with country code, e.g., +1234567890): ');
        return phone;
      },
      password: async () => {
        const password = await input.text('Enter your 2FA password (if enabled, otherwise press Enter): ');
        return password || undefined;
      },
      phoneCode: async () => {
        const code = await input.text('Enter the verification code sent to your phone: ');
        return code;
      },
      onError: (err) => {
        console.error('Authentication error:', err);
      },
    });

    console.log('');
    console.log('✅ Successfully authenticated!');
    console.log('');
    
    // Get the session string
    const sessionString = client.session.save();
    console.log('Your session string is:');
    console.log('='.repeat(60));
    console.log(sessionString);
    console.log('='.repeat(60));
    console.log('');
    console.log('📝 Copy this session string and add it to your .env file:');
    console.log(`TELEGRAM_SESSION=${sessionString}`);
    console.log('');
    console.log('⚠️  IMPORTANT: Keep this session string secure and private!');
    console.log('   It allows access to your Telegram account.');
    
  } catch (error) {
    console.error('Failed to authenticate:', error);
  } finally {
    await client.disconnect();
  }
})();
