const express = require('express');
const router = express.Router();
const { lookupByPhone } = require('../services/telegramLookup');

router.get('/lookup', async (req, res) => {
  const phone = req.query.phone;
  if (!phone) {
    return res.status(400).json({ error: 'phone query parameter is required' });
  }
  try {
    const data = await lookupByPhone(phone);
    if (!data) {
      return res.status(404).json({ error: 'user not found' });
    }
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'lookup failed' });
  }
});

module.exports = router;
