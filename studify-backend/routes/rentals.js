// studify-backend/routes/rentals.js
const express = require('express');
const router = express.Router();
const Rental = require('../models/Rental');
const Material = require('../models/Material');
const Transaction = require('../models/Transaction');
const { auth } = require('../middleware/auth');

// Load cashback settings dynamically from settings file
function getCashbackSettings() {
  try {
    const path = require('path');
    const fs = require('fs');
    const settingsPath = path.join(__dirname, '../data/program_settings.json');
    if (fs.existsSync(settingsPath)) {
      const s = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      return {
        rentalsRequired: s.referral?.rentalsRequiredForCashback || 3,
        amount: s.referral?.cashbackAmount || 20,
        enabled: s.referral?.enabled !== false
      };
    }
  } catch(e) {}
  return { rentalsRequired: 3, amount: 20, enabled: true };
}

function getSubcategoryPrice() {
  try {
    const path = require('path');
    const fs = require('fs');
    const settingsPath = path.join(__dirname, '../data/program_settings.json');
    if (fs.existsSync(settingsPath)) {
      const s = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      return s.pricing?.subcategoryMonthlyPrice || 199;
    }
  } catch(e) {}
  return 199;
}

const calculateExpiryDate = (plan) => {
  const now = new Date();
  const duration = { day: 1, week: 7, month: 30, bundle: 90 };
  return new Date(now.getTime() + (duration[plan] || 30) * 24 * 60 * 60 * 1000);
};

// ── GET /api/rentals/my — user's material rentals ──
router.get('/my', auth, async (req, res) => {
  try {
    const rentals = await Rental.find({ userId: req.userId, rentalType: 'material' })
      .populate('materialId', 'title examLabel examCategory subcategory type pages pricePerDay stars pdfUrl')
      .sort('-createdAt');

    const now = new Date();
    const formatted = rentals.map(r => {
      if (r.status === 'active' && r.expiryDate < now) { r.status = 'expired'; r.save(); }
      return {
        id: r._id,
        material: r.materialId,
        plan: r.plan,
        pricePaid: r.pricePaid,
        startDate: r.startDate,
        expiryDate: r.expiryDate,
        status: r.status,
        daysLeft: r.status === 'active' ? Math.max(0, Math.ceil((r.expiryDate - now) / 86400000)) : 0,
        accessCount: r.accessCount
      };
    });

    res.json({ success: true, rentals: formatted });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── GET /api/rentals/library — ALL rented subcategories (the library) ──
router.get('/library', auth, async (req, res) => {
  try {
    const rentals = await Rental.find({ userId: req.userId, rentalType: 'subcategory' })
      .sort('-createdAt');

    const now = new Date();
    const library = rentals.map(r => {
      if (r.status === 'active' && r.expiryDate < now) { r.status = 'expired'; r.save(); }
      const daysLeft = r.status === 'active' ? Math.max(0, Math.ceil((r.expiryDate - now) / 86400000)) : 0;
      const hoursLeft = r.status === 'active' ? Math.max(0, Math.ceil((r.expiryDate - now) / 3600000)) : 0;
      return {
        id: r._id,
        examCategory: r.examCategory,
        subcategory: r.subcategory,
        plan: r.plan,
        pricePaid: r.pricePaid,
        startDate: r.startDate,
        expiryDate: r.expiryDate,
        status: r.status,
        daysLeft,
        hoursLeft,
        isFree: r.pricePaid === 0
      };
    });

    res.json({ success: true, library });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── GET /api/rentals/check/:materialId ──
router.get('/check/:materialId', auth, async (req, res) => {
  try {
    // Check direct material rental
    const materialRental = await Rental.findOne({
      userId: req.userId, materialId: req.params.materialId,
      status: 'active', expiryDate: { $gt: new Date() }
    });

    if (materialRental) {
      const daysLeft = Math.max(0, Math.ceil((materialRental.expiryDate - new Date()) / 86400000));
      return res.json({ success: true, hasAccess: true, rental: { id: materialRental._id, daysLeft, plan: materialRental.plan } });
    }

    // Check subcategory rental — if user rented the subcategory this material belongs to
    const material = await Material.findById(req.params.materialId).select('examCategory subcategory');
    if (material) {
      const subRental = await Rental.findOne({
        userId: req.userId, rentalType: 'subcategory',
        examCategory: material.examCategory, subcategory: material.subcategory,
        status: 'active', expiryDate: { $gt: new Date() }
      });
      if (subRental) {
        const daysLeft = Math.max(0, Math.ceil((subRental.expiryDate - new Date()) / 86400000));
        return res.json({ success: true, hasAccess: true, rental: { id: subRental._id, daysLeft, plan: subRental.plan } });
      }

      // Check if it's Free Resources
      if (material.subcategory === 'Free Resources') {
        return res.json({ success: true, hasAccess: true, rental: { id: null, daysLeft: 999, plan: 'free' } });
      }
    }

    res.json({ success: true, hasAccess: false, rental: null });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── GET /api/rentals/check-subcategory ──
router.get('/check-subcategory', auth, async (req, res) => {
  try {
    const { examCategory, subcategory } = req.query;
    if (!examCategory || !subcategory) return res.status(400).json({ success: false, message: 'Missing params' });

    if (subcategory === 'Free Resources') {
      return res.json({ success: true, hasAccess: true, isFree: true });
    }

    const rental = await Rental.findOne({
      userId: req.userId, rentalType: 'subcategory',
      examCategory, subcategory, status: 'active', expiryDate: { $gt: new Date() }
    });

    if (rental) {
      const daysLeft = Math.max(0, Math.ceil((rental.expiryDate - new Date()) / 86400000));
      return res.json({ success: true, hasAccess: true, daysLeft, expiryDate: rental.expiryDate });
    }

    res.json({ success: true, hasAccess: false });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── POST /api/rentals/create — rent a single material ──
router.post('/create', auth, async (req, res) => {
  try {
    const { materialId, plan, pricePaid, useBalance } = req.body;
    if (!materialId || !plan || pricePaid === undefined) {
      return res.status(400).json({ success: false, message: 'Material ID, plan and price are required' });
    }

    const material = await Material.findById(materialId);
    if (!material) return res.status(404).json({ success: false, message: 'Material not found' });

    const existing = await Rental.findOne({
      userId: req.userId, materialId, status: 'active', expiryDate: { $gt: new Date() }
    });
    if (existing) return res.status(400).json({ success: false, message: 'Already have an active rental' });

    const User = require('../models/User');
    const user = await User.findById(req.userId);

    let finalPrice = pricePaid;
    let balanceUsed = 0;
    if (useBalance && user.referralBalance > 0) {
      balanceUsed = Math.min(user.referralBalance, pricePaid);
      finalPrice = Math.max(0, pricePaid - balanceUsed);
      user.referralBalance -= balanceUsed;
    }

    const rental = await Rental.create({
      userId: req.userId, materialId, rentalType: 'material',
      plan, pricePaid: finalPrice, expiryDate: calculateExpiryDate(plan),
      status: 'active', paymentMethod: 'demo'
    });

    await Transaction.create({
      userId: req.userId, materialId, rentalId: rental._id,
      amount: finalPrice, plan, status: 'completed', paymentMethod: 'demo'
    });

    // Referral cashback — dynamic settings
    let cashbackMessage = null;
    const refSettings = getCashbackSettings();
    if (refSettings.enabled && user.referredBy && !user.referralCashbackGiven) {
      user.referralCashbackGiven = true;
      const referrer = await User.findById(user.referredBy);
      if (referrer) {
        referrer.referralCount += 1;
        if (referrer.referralCount % refSettings.rentalsRequired === 0) {
          const canEarnMore = referrer.referralBalance < refSettings.maxCashbackPerUser;
          if (canEarnMore) {
            referrer.referralBalance += refSettings.amount;
            cashbackMessage = `🎉 Your referral made ${referrer.referralCount} rental${referrer.referralCount!==1?'s':''}! ₹${refSettings.cashbackAmount} added to referrer's wallet.`;
          }
        }
        await referrer.save();
      }
    }

    await user.save();

    res.status(201).json({
      success: true, message: 'Rental created successfully',
      rental: { id: rental._id, plan: rental.plan, pricePaid: finalPrice, expiryDate: rental.expiryDate },
      balanceUsed, cashbackMessage, newBalance: user.referralBalance
    });
  } catch (error) {
    console.error('Create rental error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── POST /api/rentals/rent-subcategory — rent entire subcategory ──
router.post('/rent-subcategory', auth, async (req, res) => {
  try {
    const { examCategory, subcategory, pricePaid, useBalance } = req.body;
    if (!examCategory || !subcategory || pricePaid === undefined) {
      return res.status(400).json({ success: false, message: 'examCategory, subcategory and price are required' });
    }

    // Free Resources are always accessible — no rental needed
    if (subcategory === 'Free Resources') {
      return res.json({ success: true, message: 'Free Resources are always accessible', isFree: true });
    }

    // Check if already rented
    const existing = await Rental.findOne({
      userId: req.userId, rentalType: 'subcategory',
      examCategory, subcategory, status: 'active', expiryDate: { $gt: new Date() }
    });
    if (existing) return res.status(400).json({ success: false, message: 'Already have an active rental for this subcategory' });

    const User = require('../models/User');
    const user = await User.findById(req.userId);

    let finalPrice = pricePaid;
    let balanceUsed = 0;
    if (useBalance && user.referralBalance > 0) {
      balanceUsed = Math.min(user.referralBalance, pricePaid);
      finalPrice = Math.max(0, pricePaid - balanceUsed);
      user.referralBalance -= balanceUsed;
    }

    const rental = await Rental.create({
      userId: req.userId, rentalType: 'subcategory',
      examCategory, subcategory, plan: 'month',
      pricePaid: finalPrice, expiryDate: calculateExpiryDate('month'),
      status: 'active', paymentMethod: 'demo'
    });

    // Referral cashback — dynamic from settings
    let cashbackMessage = null;
    if (user.referredBy && !user.referralCashbackGiven) {
      user.referralCashbackGiven = true;
      const referrer = await User.findById(user.referredBy);
      if (referrer) {
        referrer.referralCount += 1;
        const cs = getCashbackSettings();
        if (cs.enabled && referrer.referralCount % cs.rentalsRequired === 0) {
          referrer.referralBalance += cs.amount;
          cashbackMessage = `🎉 ${referrer.referralCount} referral rentals reached! ₹${cs.amount} added to wallet.`;
        }
        await referrer.save();
      }
    }

    await user.save();

    res.status(201).json({
      success: true, message: `${subcategory} rented for 30 days!`,
      rental: { id: rental._id, examCategory, subcategory, pricePaid: finalPrice, expiryDate: rental.expiryDate },
      balanceUsed, cashbackMessage, newBalance: user.referralBalance
    });
  } catch (error) {
    console.error('Subcategory rental error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
