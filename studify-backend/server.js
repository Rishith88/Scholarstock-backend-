const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Database connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/scholarstock', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Initialize default pricing plans
    const PricingPlan = require('./models/PricingPlan');
    await PricingPlan.initializeDefaultPlans();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

// Routes - ONLY EXISTING ROUTE FILES
app.use('/api/auth', require('./routes/auth'));
app.use('/api/materials', require('./routes/materials'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/cart', require('./routes/cart'));
app.use('/api/rentals', require('./routes/rentals'));
app.use('/api/referral', require('./routes/referral'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/founder', require('./routes/founder'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/referral-settings', require('./routes/referralSettings'));

// AI Routes
app.use('/api/chatbot', require('./routes/chatbot'));
app.use('/api/doubt', require('./routes/doubt'));
app.use('/api/study-strategist', require('./routes/studyPlanner'));
app.use('/api/calculator', require('./routes/calculater')); // Note: file is spelled "calculater"
app.use('/api/mocktest', require('./routes/mocktest'));

// Pricing Plans
app.use('/api/pricing-plans', require('./routes/pricingPlans'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'ScholarStock API is running',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Route not found' 
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
});
