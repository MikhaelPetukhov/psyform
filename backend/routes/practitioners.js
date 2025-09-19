const express = require('express');
const router = express.Router();
const { Practitioner } = require('../models');
const authMiddleware = require('../middleware/authMiddleware');
const adminOnly = require('../middleware/adminOnly');

// Public: GET /api/practitioners/public/:slug
router.get('/public/:slug', async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim();
    if (!slug) return res.status(400).json({ msg: 'slug is required' });

    const p = await Practitioner.findOne({ where: { publicSlug: slug } });
    if (!p) return res.status(404).json({ msg: 'Practitioner not found' });

    const data = {
      slug: p.slug,
      publicSlug: p.publicSlug,
      displayName: p.displayName,
      specialization: p.specialization || null,
      price: p.price || null,
      about: p.about || null,
      clientMessageTemplate: p.clientMessageTemplate || null,
    };
    return res.json({ ok: true, practitioner: data });
  } catch (e) {
    return res.status(500).json({ msg: 'Server Error' });
  }
});

// Admin: GET /api/practitioners/profile
router.get('/profile', authMiddleware, adminOnly, async (req, res) => {
  try {
    const practitionerId = req.practitionerId;
    if (!practitionerId) return res.status(400).json({ msg: 'Missing practitionerId' });
    const p = await Practitioner.findByPk(practitionerId);
    if (!p) return res.status(404).json({ msg: 'Practitioner not found' });
    return res.json({
      ok: true,
      practitioner: {
        slug: p.slug,
        publicSlug: p.publicSlug,
        displayName: p.displayName,
        specialization: p.specialization || '',
        price: p.price || '',
        about: p.about || '',
        clientMessageTemplate: p.clientMessageTemplate || '',
        timezone: p.timezone || '',
      }
    });
  } catch (e) {
    return res.status(500).json({ msg: 'Server Error' });
  }
});

// Admin: PUT /api/practitioners/profile
router.put('/profile', authMiddleware, adminOnly, async (req, res) => {
  try {
    const practitionerId = req.practitionerId;
    if (!practitionerId) return res.status(400).json({ msg: 'Missing practitionerId' });
    const p = await Practitioner.findByPk(practitionerId);
    if (!p) return res.status(404).json({ msg: 'Practitioner not found' });

    const { displayName, specialization, price, about, clientMessageTemplate, timezone } = req.body || {};
    const { isValidTimezone } = require('../utils/timezone');
    
    const updates = {};
    if (typeof displayName !== 'undefined') updates.displayName = displayName;
    if (typeof specialization !== 'undefined') updates.specialization = specialization;
    if (typeof price !== 'undefined') {
      // Handle empty string for numeric field
      updates.price = price === '' ? null : price;
    }
    if (typeof about !== 'undefined') updates.about = about;
    if (typeof clientMessageTemplate !== 'undefined') updates.clientMessageTemplate = clientMessageTemplate;
    
    // Validate and update timezone
    if (typeof timezone !== 'undefined') {
      if (!timezone) {
        return res.status(400).json({ msg: 'Timezone is required' });
      }
      if (!isValidTimezone(timezone)) {
        return res.status(400).json({ msg: 'Invalid timezone' });
      }
      updates.timezone = timezone;
    }

    await p.update(updates);
    return res.json({ ok: true, practitioner: p });
  } catch (e) {
    return res.status(500).json({ msg: 'Server Error' });
  }
});

module.exports = router;
