// studify-backend/routes/cart.js - SHOPPING CART SYSTEM

const express = require('express');
const router = express.Router();
const Cart = require('../models/Cart');
const Material = require('../models/Material');
const { auth } = require('../middleware/auth');

// GET /api/cart - Get user's cart
router.get('/', auth, async (req, res) => {
  try {
    let cart = await Cart.findOne({ userId: req.userId })
      .populate('items.materialId', 'title examCategory subcategory pricePerDay');
    
    if (!cart) {
      cart = await Cart.create({ userId: req.userId, items: [] });
    }
    
    const total = cart.getTotal();
    const savings = cart.getSavings();
    
    res.json({
      success: true,
      cart: {
        items: cart.items,
        total,
        savings,
        itemCount: cart.items.length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// POST /api/cart/add - Add item to cart
router.post('/add', auth, async (req, res) => {
  try {
    const { itemType, materialId, examCategory, subcategory, planId, planName, duration, price } = req.body;
    
    if (!itemType || !planId || !planName || !duration || price === undefined) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    
    let cart = await Cart.findOne({ userId: req.userId });
    if (!cart) {
      cart = await Cart.create({ userId: req.userId, items: [] });
    }
    
    // Check if item already in cart
    const existingIndex = cart.items.findIndex(item => {
      if (itemType === 'material') {
        return item.materialId && item.materialId.toString() === materialId && item.planId === planId;
      } else {
        return item.examCategory === examCategory && 
               item.subcategory === subcategory && 
               item.planId === planId;
      }
    });
    
    if (existingIndex !== -1) {
      return res.status(400).json({ success: false, message: 'Item already in cart' });
    }
    
    // Get material title if material
    let materialTitle = null;
    if (itemType === 'material' && materialId) {
      const material = await Material.findById(materialId);
      if (material) materialTitle = material.title;
    }
    
    // Add item
    cart.items.push({
      itemType,
      materialId: itemType === 'material' ? materialId : null,
      materialTitle,
      examCategory: itemType === 'subcategory' ? examCategory : null,
      subcategory: itemType === 'subcategory' ? subcategory : null,
      planId,
      planName,
      duration,
      price
    });
    
    cart.lastUpdated = new Date();
    await cart.save();
    
    res.json({
      success: true,
      message: 'Added to cart',
      cart: {
        items: cart.items,
        total: cart.getTotal(),
        savings: cart.getSavings(),
        itemCount: cart.items.length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// DELETE /api/cart/remove/:itemId - Remove item from cart
router.delete('/remove/:itemId', auth, async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.userId });
    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }
    
    cart.items = cart.items.filter(item => item._id.toString() !== req.params.itemId);
    cart.lastUpdated = new Date();
    await cart.save();
    
    res.json({
      success: true,
      message: 'Item removed',
      cart: {
        items: cart.items,
        total: cart.getTotal(),
        savings: cart.getSavings(),
        itemCount: cart.items.length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// DELETE /api/cart/clear - Clear entire cart
router.delete('/clear', auth, async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.userId });
    if (cart) {
      cart.items = [];
      cart.lastUpdated = new Date();
      await cart.save();
    }
    
    res.json({ success: true, message: 'Cart cleared' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// POST /api/cart/checkout - Process cart checkout
router.post('/checkout', auth, async (req, res) => {
  try {
    const { useBalance } = req.body;
    
    const cart = await Cart.findOne({ userId: req.userId });
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }
    
    const User = require('../models/User');
    const Rental = require('../models/Rental');
    
    const user = await User.findById(req.userId);
    let totalPrice = cart.getTotal();
    let balanceUsed = 0;
    
    // Apply referral balance if requested
    if (useBalance && user.referralBalance > 0) {
      balanceUsed = Math.min(user.referralBalance, totalPrice);
      totalPrice -= balanceUsed;
      user.referralBalance -= balanceUsed;
      await user.save();
    }
    
    // Create rentals for each item
    const rentals = [];
    const now = new Date();
    
    for (const item of cart.items) {
      const expiryDate = new Date(now);
      expiryDate.setDate(expiryDate.getDate() + item.duration);
      
      const rental = await Rental.create({
        userId: req.userId,
        rentalType: item.itemType,
        materialId: item.materialId,
        examCategory: item.examCategory,
        subcategory: item.subcategory,
        plan: item.planName,
        pricePaid: item.price,
        startDate: now,
        expiryDate,
        status: 'active',
        paymentMethod: 'demo'
      });
      
      rentals.push(rental);
    }
    
    // Clear cart
    cart.items = [];
    await cart.save();
    
    res.json({
      success: true,
      message: 'Purchase successful!',
      rentals: rentals.map(r => ({
        id: r._id,
        type: r.rentalType,
        expiryDate: r.expiryDate
      })),
      totalPaid: totalPrice,
      balanceUsed,
      newBalance: user.referralBalance
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Checkout failed', error: error.message });
  }
});

module.exports = router;
