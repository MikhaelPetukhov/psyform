# Telegram Session Setup Guide

## Problem
The Telegram lookup feature is failing with `AUTH_KEY_UNREGISTERED` error because the `TELEGRAM_SESSION` in your `.env` file is empty. Telegram requires a valid authenticated session to perform API operations.

## Solution
You need to generate a session string by authenticating with your Telegram account once.

## Steps

### Option 1: Using the Interactive Script
1. Run the session generator script:
   ```bash
   cd backend/scripts
   node generateTelegramSession.js
   ```

2. Follow the prompts:
   - Enter your phone number (with country code, e.g., +79772881499)
   - Enter the verification code sent to your Telegram app
   - If you have 2FA enabled, enter your password

3. Copy the generated session string and update your `.env` file:
   ```
   TELEGRAM_SESSION=your_generated_session_string_here
   ```

4. Restart your Docker containers:
   ```bash
   docker-compose down
   docker-compose up
   ```

### Option 2: Manual Setup (if script doesn't work)
If the interactive script has issues, you can create a simple test script to generate the session manually.

## Important Notes
- **Security**: The session string gives access to your Telegram account. Keep it secure and private.
- **Account**: Use a dedicated Telegram account for the application, not your personal account.
- **Permissions**: The account needs to be able to import contacts and access user information.

## Testing
After setting up the session, test the Telegram lookup by:
1. Going to the admin panel
2. Trying to lookup a phone number
3. The lookup should return user information instead of 404 errors

## Troubleshooting
- If you get `PHONE_NUMBER_INVALID`: Make sure to include the country code
- If you get `SESSION_PASSWORD_NEEDED`: You have 2FA enabled, provide your password
- If the session expires: Re-run the generator script to create a new session
