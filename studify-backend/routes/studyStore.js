const express = require('express');
const router = express.Router();
const { StoreProduct, StoreOrder } = require('../models/StoreProduct');
const { verifyToken } = require('../middleware/auth');

// GET /api/store/products — list products
router.get('/products', async (req, res) => {
  try {
    const { category, search, sort = 'popular', page = 1, limit = 20 } = req.query;
    const query = { isActive: true };
    if (category && category !== 'All') query.category = category;
    if (search) query.name = { $regex: search, $options: 'i' };

    let sortObj = { reviews: -1 };
    if (sort === 'price-low') sortObj = { price: 1 };
    if (sort === 'price-high') sortObj = { price: -1 };
    if (sort === 'rating') sortObj = { rating: -1 };

    const products = await StoreProduct.find(query)
      .sort(sortObj)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await StoreProduct.countDocuments(query);

    res.json({ success: true, products, total, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/store/products/:id — single product
router.get('/products/:id', async (req, res) => {
  try {
    const product = await StoreProduct.findById(req.params.id);
    if (!product || !product.isActive) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/store/orders — place an order
router.post('/orders', verifyToken, async (req, res) => {
  try {
    const { items, shippingAddress, paymentMethod } = req.body;
    if (!items || !items.length) return res.status(400).json({ success: false, message: 'No items in order' });

    // Validate stock and calculate total
    let totalAmount = 0;
    const orderItems = [];
    for (const item of items) {
      const product = await StoreProduct.findById(item.productId);
      if (!product || !product.isActive) return res.status(400).json({ success: false, message: `Product ${item.productId} not found` });
      if (product.stock < item.quantity && product.condition !== 'Digital') {
        return res.status(400).json({ success: false, message: `${product.name} is out of stock` });
      }

      // Deduct stock
      if (product.condition !== 'Digital') {
        product.stock -= item.quantity;
        await product.save();
      }

      const lineTotal = product.price * item.quantity;
      totalAmount += lineTotal;
      orderItems.push({ productId: product._id, name: product.name, quantity: item.quantity, price: product.price });
    }

    const order = await StoreOrder.create({
      userId: req.userId,
      items: orderItems,
      totalAmount,
      shippingAddress: shippingAddress || '',
      paymentMethod: paymentMethod || 'razorpay'
    });

    res.status(201).json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/store/orders — user's order history
router.get('/orders', verifyToken, async (req, res) => {
  try {
    const orders = await StoreOrder.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/store/orders/:id — single order
router.get('/orders/:id', verifyToken, async (req, res) => {
  try {
    const order = await StoreOrder.findOne({ _id: req.params.id, userId: req.userId });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── ADMIN: Seed products (one-time setup) ──
router.post('/seed', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });

    const existing = await StoreProduct.countDocuments();
    if (existing > 0) return res.json({ success: true, message: 'Products already seeded', count: existing });

    const defaultProducts = [
      { name: 'Engineering Mathematics — B.S. Grewal', category: 'Reference Books', price: 450, originalPrice: 680, image: '📘', rating: 4.8, reviews: 324, stock: 45, badge: 'Bestseller', features: ['Latest Edition', 'Includes Solutions', 'Hardcover'], condition: 'New', description: 'Definitive textbook for engineering math.' },
      { name: 'Fundamentals of Physics — Halliday & Resnick', category: 'Reference Books', price: 520, originalPrice: 850, image: '📗', rating: 4.9, reviews: 567, stock: 32, badge: 'Top Pick', features: ['11th Edition', 'Full Color'], condition: 'New', description: 'Comprehensive physics textbook.' },
      { name: 'Data Structures & Algorithms Made Easy', category: 'Reference Books', price: 380, originalPrice: 550, image: '📙', rating: 4.7, reviews: 891, stock: 78, badge: 'Bestseller', features: ['C/C++/Java', 'Interview Ready'], condition: 'New', description: 'Gold standard for DSA interview prep.' },
      { name: 'Organic Chemistry — Morrison & Boyd', category: 'Reference Books', price: 490, originalPrice: 720, image: '📕', rating: 4.6, reviews: 234, stock: 28, features: ['7th Edition', 'Mechanism Focus'], condition: 'New', description: 'Classic organic chemistry reference.' },
      { name: 'Handwritten Calculus Notes Bundle', category: 'Study Notes', price: 120, originalPrice: 200, image: '📝', rating: 4.9, reviews: 156, stock: 999, badge: 'Student Pick', features: ['30+ Pages', 'Color Coded', 'Exam Focused'], condition: 'Digital', description: 'Color-coded calculus notes.' },
      { name: 'Machine Learning Crash Course Kit', category: 'Study Kits', price: 650, originalPrice: 1200, image: '🧠', rating: 4.8, reviews: 89, stock: 15, badge: 'Bundle Deal', features: ['4 Items', 'Beginner Friendly'], condition: 'New', description: 'Complete ML starter kit.' },
      { name: 'Previous Year Question Papers (CS)', category: 'Question Banks', price: 80, originalPrice: 150, image: '📋', rating: 4.5, reviews: 445, stock: 999, features: ['2016-2026', 'Solutions Included'], condition: 'Digital', description: '10 years CS PYQs with solutions.' },
      { name: 'Scientific Calculator — Casio fx-991EX', category: 'Stationery', price: 1350, originalPrice: 1650, image: '🧮', rating: 4.7, reviews: 198, stock: 22, features: ['552 Functions', 'Solar+Battery'], condition: 'New', description: 'Advanced scientific calculator.' },
      { name: 'Premium Notebook Set (5 Pack)', category: 'Stationery', price: 280, originalPrice: 400, image: '📓', rating: 4.6, reviews: 312, stock: 55, features: ['200 Pages Each', '80gsm Paper'], condition: 'New', description: 'A5 ruled notebooks.' },
      { name: 'DSA Cheatsheet Poster Set', category: 'Study Kits', price: 150, originalPrice: 250, image: '🗺️', rating: 4.8, reviews: 267, stock: 40, badge: 'Student Pick', features: ['4 Posters', 'A2 Size', 'Laminated'], condition: 'New', description: 'Complete DSA reference posters.' },
    ];

    await StoreProduct.insertMany(defaultProducts);
    res.json({ success: true, message: 'Products seeded!', count: defaultProducts.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
