const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { auth } = require('../middleware/auth');
const Rental = require('../models/Rental');
const Transaction = require('../models/Transaction');
const Material = require('../models/Material');
const User = require('../models/User');

// Initialize Razorpay
let razorpay = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  try {
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
    console.log('✅ Razorpay initialized');
  } catch (error) {
    console.log('⚠️ Razorpay initialization failed:', error.message);
  }
}

const calculateExpiryDate = (plan) => {
  const now = new Date();
  const durationMap = {
    'day': 1,
    'week': 7,
    'month': 30,
    'bundle': 90
  };
  const days = durationMap[plan] || 30;
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
};

// @route   POST /api/payments/create-order
router.post('/create-order', auth, async (req, res) => {
  if (!razorpay) {
    return res.status(503).json({ success: false, message: 'Payment system not configured' });
  }

  try {
    const { amount, materialId, examCategory, subcategory, rentalPlan, rentalType } = req.body;

    if (!amount || (!materialId && (!examCategory || !subcategory)) || !rentalPlan) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const options = {
      amount: Math.round(amount * 100), // in paise
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`,
      notes: {
        userId: req.userId.toString(),
        rentalType: rentalType || 'material',
        materialId: materialId || '',
        examCategory: examCategory || '',
        subcategory: subcategory || '',
        rentalPlan: rentalPlan
      }
    };

    const order = await razorpay.orders.create(options);
    res.json({ success: true, order });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ success: false, message: 'Failed to create payment order' });
  }
});

// @route   POST /api/payments/verify
router.post('/verify', auth, async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      materialId,
      examCategory,
      subcategory,
      rentalPlan,
      rentalType,
      amount
    } = req.body;

    // Signature verification
    if (razorpay_signature) {
      const body = razorpay_order_id + '|' + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest('hex');

      if (expectedSignature !== razorpay_signature) {
        return res.status(400).json({ success: false, message: 'Invalid payment signature' });
      }
    } else if (process.env.NODE_ENV === 'production') {
       return res.status(400).json({ success: false, message: 'Payment signature required' });
    }

    const expiryDate = calculateExpiryDate(rentalPlan);

    // Create rental
    const rentalData = {
      userId: req.userId,
      rentalType: rentalType || 'material',
      plan: rentalPlan,
      pricePaid: amount,
      expiryDate,
      paymentId: razorpay_payment_id,
      status: 'active',
      paymentMethod: 'razorpay'
    };

    if (rentalType === 'subcategory') {
      rentalData.examCategory = examCategory;
      rentalData.subcategory = subcategory;
    } else {
      rentalData.materialId = materialId;
    }

    const rental = await Rental.create(rentalData);

    // Create transaction
    await Transaction.create({
      userId: req.userId,
      materialId: rentalType === 'material' ? materialId : null,
      rentalId: rental._id,
      amount,
      plan: rentalPlan,
      status: 'completed',
      paymentMethod: 'razorpay',
      paymentId: razorpay_payment_id
    });

    // Update user stats or handle referrals if needed
    const user = await User.findById(req.userId);
    // ... referral logic ...

    res.json({
      success: true,
      message: 'Payment verified and rental created',
      rental
    });

  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ success: false, message: 'Payment verification failed' });
  }
});

// @route   GET /api/payments/key
router.get('/key', (req, res) => {
  res.json({ success: true, key: process.env.RAZORPAY_KEY_ID });
});

module.exports = router;
