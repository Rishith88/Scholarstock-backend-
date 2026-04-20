const express = require('express');
const router = express.Router();
const ScholarCoin = require('../models/ScholarCoin');
const { verifyToken } = require('../middleware/auth');

// Helper: ensure user has a coin wallet
async function getOrCreateWallet(userId) {
  let wallet = await ScholarCoin.findOne({ userId });
  if (!wallet) {
    wallet = await ScholarCoin.create({ userId, balance: 100, totalEarned: 100, transactions: [{ type: 'earn', amount: 100, action: 'Welcome bonus', icon: '🎉' }] });
  }
  return wallet;
}

// GET /api/scholar-coins/balance — get user's coin balance & recent activity
router.get('/balance', verifyToken, async (req, res) => {
  try {
    const wallet = await getOrCreateWallet(req.userId);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weeklyEarned = wallet.transactions
      .filter(t => t.type === 'earn' && t.createdAt >= weekAgo)
      .reduce((a, t) => a + t.amount, 0);

    res.json({
      success: true,
      balance: wallet.balance,
      totalEarned: wallet.totalEarned,
      totalSpent: wallet.totalSpent,
      streakDays: wallet.streakDays,
      weeklyEarned,
      purchasedItems: wallet.purchasedItems
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/scholar-coins/earn — earn coins for an action
router.post('/earn', verifyToken, async (req, res) => {
  try {
    const { action, amount, icon = '🪙' } = req.body;
    if (!action || !amount || amount < 1) return res.status(400).json({ success: false, message: 'Action and positive amount required' });
    if (amount > 500) return res.status(400).json({ success: false, message: 'Max earn per action is 500' });

    const wallet = await getOrCreateWallet(req.userId);
    wallet.balance += amount;
    wallet.totalEarned += amount;
    wallet.transactions.push({ type: 'earn', amount, action, icon });

    // Keep only last 100 transactions
    if (wallet.transactions.length > 100) wallet.transactions = wallet.transactions.slice(-100);
    await wallet.save();

    res.json({ success: true, balance: wallet.balance, message: `+${amount} coins earned!` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/scholar-coins/spend — redeem coins
router.post('/spend', verifyToken, async (req, res) => {
  try {
    const { itemId, itemName, cost } = req.body;
    if (!itemId || !cost) return res.status(400).json({ success: false, message: 'Item and cost required' });

    const wallet = await getOrCreateWallet(req.userId);
    if (wallet.balance < cost) return res.status(400).json({ success: false, message: 'Insufficient coins' });
    if (wallet.purchasedItems.includes(itemId)) return res.status(400).json({ success: false, message: 'Already purchased' });

    wallet.balance -= cost;
    wallet.totalSpent += cost;
    wallet.purchasedItems.push(itemId);
    wallet.transactions.push({ type: 'spend', amount: cost, action: `Redeemed: ${itemName || itemId}`, icon: '🛍️' });
    if (wallet.transactions.length > 100) wallet.transactions = wallet.transactions.slice(-100);
    await wallet.save();

    res.json({ success: true, balance: wallet.balance, message: `Redeemed ${itemName}!` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/scholar-coins/leaderboard — top earners
router.get('/leaderboard', verifyToken, async (req, res) => {
  try {
    const top = await ScholarCoin.find()
      .sort({ totalEarned: -1 })
      .limit(20)
      .populate('userId', 'name username');

    const leaderboard = top.map((w, i) => ({
      rank: i + 1,
      name: w.userId?.name || 'Anonymous',
      coins: w.totalEarned,
      isYou: w.userId?._id?.toString() === req.userId.toString()
    }));

    res.json({ success: true, leaderboard });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/scholar-coins/activity — recent transactions
router.get('/activity', verifyToken, async (req, res) => {
  try {
    const wallet = await getOrCreateWallet(req.userId);
    const recent = wallet.transactions.slice(-20).reverse();
    res.json({ success: true, transactions: recent });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/scholar-coins/daily-login — daily login streak
router.post('/daily-login', verifyToken, async (req, res) => {
  try {
    const wallet = await getOrCreateWallet(req.userId);
    const today = new Date().toDateString();
    const lastLogin = wallet.lastLoginDate ? wallet.lastLoginDate.toDateString() : null;

    if (lastLogin === today) return res.json({ success: true, message: 'Already claimed today', balance: wallet.balance, streak: wallet.streakDays });

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const isConsecutive = lastLogin === yesterday.toDateString();

    wallet.streakDays = isConsecutive ? wallet.streakDays + 1 : 1;
    wallet.lastLoginDate = new Date();

    let bonus = 10;
    if (wallet.streakDays % 7 === 0) bonus += 100; // Weekly streak bonus

    wallet.balance += bonus;
    wallet.totalEarned += bonus;
    wallet.transactions.push({ type: 'earn', amount: bonus, action: `Daily login (${wallet.streakDays} day streak)`, icon: '🔥' });
    if (wallet.transactions.length > 100) wallet.transactions = wallet.transactions.slice(-100);
    await wallet.save();

    res.json({ success: true, balance: wallet.balance, streak: wallet.streakDays, bonus, message: `+${bonus} coins!` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
