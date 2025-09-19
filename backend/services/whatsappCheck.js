const fetch = global.fetch;

/**
 * Check if a phone is a valid WhatsApp contact using WhatsApp Business Cloud API.
 * Requires env:
 *  - WHATSAPP_TOKEN: Graph API access token
 *  - WHATSAPP_PHONE_NUMBER_ID: Business phone number ID
 *
 * Returns: { configured: boolean, valid: boolean, wa_id?: string }
 */
async function checkWhatsApp(phone) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    return { configured: false, valid: false };
  }

  const url = `https://graph.facebook.com/v17.0/${phoneNumberId}/contacts`;
  const payload = {
    blocking: 'wait',
    contacts: [{ input: String(phone || '').trim() }],
    force_check: true,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`WhatsApp API error: ${res.status} ${res.statusText} ${text}`);
  }

  const data = await res.json();
  const entry = Array.isArray(data?.contacts) ? data.contacts[0] : null;
  if (entry && entry.status === 'valid') {
    return { configured: true, valid: true, wa_id: entry.wa_id };
  }
  return { configured: true, valid: false };
}

module.exports = { checkWhatsApp };
