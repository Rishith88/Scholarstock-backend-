// studify-backend/routes/referralSettings.js
// Admin-editable referral program configuration

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const SETTINGS_PATH = path.join(__dirname, '../data/referral-settings.json');

const DEFAULT_SETTINGS = {
  enabled: true,
  rentalsNeeded: 3,       // how many rentals by referred person trigger cashback
  cashbackAmount: 20,     // ₹ given to referrer
  maxCashbackPerUser: 500 // max ₹ a single user can earn from referrals
};

function getSettings() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
    }
  } catch (e) {}
  return DEFAULT_SETTINGS;
}

function saveSettings(settings) {
  const dir = path.dirname(SETTINGS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

// Middleware - verify admin token
const verifyAdmin = (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ success: false, message: 'No token' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });
    req.admin = decoded;
    next();
  } catch (e) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// GET /api/referral-settings — public (used by rentals.js to check current rules)
router.get('/', (req, res) => {
  res.json({ success: true, settings: getSettings() });
});

// PUT /api/referral-settings — admin only
router.put('/', verifyAdmin, (req, res) => {
  try {
    const { enabled, rentalsNeeded, cashbackAmount, maxCashbackPerUser } = req.body;

    if (rentalsNeeded < 1 || cashbackAmount < 0) {
      return res.status(400).json({ success: false, message: 'Invalid values' });
    }

    const settings = {
      enabled: !!enabled,
      rentalsNeeded: parseInt(rentalsNeeded),
      cashbackAmount: parseFloat(cashbackAmount),
      maxCashbackPerUser: parseFloat(maxCashbackPerUser) || 500
    };

    saveSettings(settings);
    res.json({ success: true, message: 'Referral settings saved!', settings });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error', error: e.message });
  }
});

module.exports = router;
module.exports.getSettings = getSettings;
