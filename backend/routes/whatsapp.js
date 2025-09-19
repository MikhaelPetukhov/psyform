const express = require('express');
const router = express.Router();
const { checkWhatsApp } = require('../services/whatsappCheck');

// GET /api/whatsapp/check?phone=+7XXXXXXXXXX
// Always returns 200 with shape: { configured: boolean, valid: boolean, wa_id?: string }
router.get('/check', async (req, res) => {
  const phone = String(req.query.phone || '').trim();
  if (!phone) {
    return res.status(400).json({ error: 'phone query parameter is required' });
  }
  try {
    const result = await checkWhatsApp(phone);
    return res.json(result);
  } catch (err) {
    logger.error('[WHATSAPP] Check error:', err.message);
    return res.json({ configured: true, valid: false });
  }
});

module.exports = router;
