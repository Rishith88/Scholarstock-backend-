// studify-backend/routes/referral.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { auth } = require('../middleware/auth');

// GET /api/referral/my
router.get('/my', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('name username referralBalance referralCount');
    res.json({
      success: true,
      username: user.username,
      referralBalance: user.referralBalance,
      referralCount: user.referralCount,
      nextCashbackIn: 3 - (user.referralCount % 3),
      referralLink: `${process.env.SITE_URL || 'http://localhost:3000'}?ref=${user.username}`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/referral/validate — check if username exists
router.post('/validate', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ success: false, message: 'Username required' });
    const referrer = await User.findOne({ username: username.toLowerCase().trim() }).select('name username');
    if (!referrer) return res.status(404).json({ success: false, message: 'Username not found' });
    res.json({ success: true, referrerName: referrer.name });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/referral/history
router.get('/history', auth, async (req, res) => {
  try {
    const referred = await User.find({ referredBy: req.userId })
      .select('name createdAt referralCashbackGiven')
      .sort('-createdAt');

    const history = referred.map(u => ({
      name: u.name.split(' ')[0] + '***',
      joinedAt: u.createdAt,
      status: u.referralCashbackGiven ? 'First rental done ✅' : 'Pending first rental ⏳'
    }));

    const user = await User.findById(req.userId).select('referralCount referralBalance');
    res.json({
      success: true, history,
      totalReferrals: user.referralCount,
      totalEarned: Math.floor(user.referralCount / 3) * 20,
      nextCashbackIn: 3 - (user.referralCount % 3)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
