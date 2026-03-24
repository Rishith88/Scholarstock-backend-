// studify-backend/server.js - UPDATED WITH PRICING & CART

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve PDF files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('✅ MongoDB Connected');
})
.catch(err => {
  console.error('❌ MongoDB Connection Error:', err.message);
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/materials', require('./routes/materials'));
app.use('/api/rentals', require('./routes/rentals'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/chatbot', require('./routes/chatbot'));
app.use('/api/founder', require('./routes/founder'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/referral', require('./routes/referral'));
app.use('/api/referral-settings', require('./routes/referralSettings'));
app.use('/api/settings', require('./routes/settings'));

// ⭐ NEW ROUTES FOR PRICING SYSTEM
app.use('/api/pricing-plans', require('./routes/pricingPlans'));
app.use('/api/cart', require('./routes/cart'));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    features: [
      'Authentication',
      'Materials',
      'Rentals',
      'Admin Panel',
      'Payments',
      'Chatbot',
      'Pricing Plans (20 plans)', // NEW
      'Shopping Cart' // NEW
    ]
  });
});

// Root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Studify Backend API', 
    version: '3.0',
    newFeatures: [
      '20 Dynamic Pricing Plans',
      'Shopping Cart System',
      'Multi-level Pricing (Global/Exam/Subcategory)'
    ]
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    message: 'Endpoint not found',
    requestedUrl: req.originalUrl
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({ 
    success: false,
    message: 'Something went wrong!', 
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 Studify Backend Server v3.0`);
  console.log(`📡 Running on: http://localhost:${PORT}`);
  console.log(`💾 MongoDB: ${mongoose.connection.readyState === 1 ? '✅ Connected' : '⏳ Connecting...'}`);
  console.log(`\n📚 Endpoints:`);
  console.log(`   - Auth:           /api/auth`);
  console.log(`   - Materials:      /api/materials`);
  console.log(`   - Rentals:        /api/rentals`);
  console.log(`   - Admin:          /api/admin`);
  console.log(`   - Pricing Plans:  /api/pricing-plans ⭐ NEW`);
  console.log(`   - Cart:           /api/cart ⭐ NEW`);
  console.log(`\n🔧 Health Check: http://localhost:${PORT}/health\n`);
});

module.exports = app;