const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { auth } = require('../middleware/auth');
const Rental = require('../models/Rental');
const Transaction = require('../models/Transaction');
const Material = require('../models/Material');

// Initialize Razorpay (only if keys are provided)
let razorpay = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_ID !== 'your_razorpay_key_id_here') {
  try {
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
    console.log('✅ Razorpay initialized');
  } catch (error) {
    console.log('⚠️  Razorpay not configured (payment features disabled)');
  }
} else {
  console.log('⚠️  Razorpay keys not configured (payment features disabled)');
}

// @route   POST /api/payments/create-order
// @desc    Create Razorpay order
// @access  Private
router.post('/create-order', auth, async (req, res) => {
  if (!razorpay) {
    return res.status(503).json({
      success: false,
      message: 'Payment system not configured'
    });
  }

  try {
    const { amount, materialId, rentalPlan } = req.body;

    // Validate input
    if (!amount || !materialId || !rentalPlan) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Check if material exists
    const material = await Material.findById(materialId);
    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Material not found'
      });
    }

    // Create Razorpay order
    const options = {
      amount: amount * 100, // Razorpay expects amount in paise
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
      notes: {
        userId: req.user.id,
        materialId: materialId,
        rentalPlan: rentalPlan
      }
    };

    const order = await razorpay.orders.create(options);

    res.json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency
      }
    });

  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment order'
    });
  }
});

// @route   POST /api/payments/verify
// @desc    Verify Razorpay payment
// @access  Private
router.post('/verify', auth, async (req, res) => {
  if (!razorpay) {
    return res.status(503).json({
      success: false,
      message: 'Payment system not configured'
    });
  }

  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      materialId,
      rentalPlan,
      amount
    } = req.body;

    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    const isAuthentic = expectedSignature === razorpay_signature;

    if (!isAuthentic) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed'
      });
    }

    // Get material details
    const material = await Material.findById(materialId);
    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Material not found'
      });
    }

    // Calculate rental duration
    let duration = 1; // default 1 day
    if (rentalPlan === 'week') duration = 7;
    if (rentalPlan === 'month') duration = 30;

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + duration);

    // Create rental
    const rental = await Rental.create({
      user: req.user.id,
      material: materialId,
      plan: rentalPlan,
      startDate: startDate,
      endDate: endDate,
      pricePaid: amount,
      paymentId: razorpay_payment_id,
      status: 'active'
    });

    // Create transaction record
    await Transaction.create({
      user: req.user.id,
      rental: rental._id,
      amount: amount,
      paymentMethod: 'razorpay',
      paymentId: razorpay_payment_id,
      status: 'completed'
    });

    // Update material statistics
    material.totalRentals = (material.totalRentals || 0) + 1;
    await material.save();

    res.json({
      success: true,
      message: 'Payment verified successfully',
      rental: rental
    });

  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Payment verification failed'
    });
  }
});

// @route   GET /api/payments/key
// @desc    Get Razorpay public key
// @access  Public
router.get('/key', (req, res) => {
  if (!razorpay) {
    return res.status(503).json({
      success: false,
      message: 'Payment system not configured'
    });
  }

  res.json({
    success: true,
    key: process.env.RAZORPAY_KEY_ID
  });
});

// @route   GET /api/payments/history
// @desc    Get user's payment history
// @access  Private
router.get('/history', auth, async (req, res) => {
  try {
    const transactions = await Transaction.find({ user: req.user.id })
      .populate('rental')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      transactions: transactions
    });

  } catch (error) {
    console.error('Payment history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment history'
    });
  }
});

module.exports = router;
