// studify-backend/routes/settings.js
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const SETTINGS_PATH = path.join(__dirname, '../data/settings.json');

const DEFAULT_SETTINGS = {
  pricing: {
    subcategoryMonthlyPrice: 199,
    materialDayPrice: 29,
    freeResourcesEnabled: true
  },
  referral: {
    cashbackAmount: 20,
    rentalsRequiredForCashback: 3,
    enabled: true
  },
  subcategoryPrices: {}
};

function getSettings() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
  } catch (e) {}
  return DEFAULT_SETTINGS;
}

function saveSettings(s) {
  const dir = path.dirname(SETTINGS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(s, null, 2));
}

router.get('/', (req, res) => res.json({ success: true, settings: getSettings() }));

router.put('/', (req, res) => {
  try {
    const cur = getSettings();
    const updated = {
      pricing: { ...cur.pricing, ...(req.body.pricing||{}) },
      referral: { ...cur.referral, ...(req.body.referral||{}) },
      subcategoryPrices: req.body.subcategoryPrices || cur.subcategoryPrices || {}
    };
    saveSettings(updated);
    res.json({ success: true, settings: updated });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;
module.exports.getSettings = getSettings;
