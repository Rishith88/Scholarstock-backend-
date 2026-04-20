const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, local files)
    if(!origin) return callback(null, true);
    
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'http://localhost:5173',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000',
      'null' // For local file:// access
    ];
    
    if(allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('null')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', require('express').static(require('path').join(__dirname, 'uploads')));
// Database connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/scholarstock', {
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

// Routes
// Routes
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
app.use('/api/calculator', require('./routes/calculater'));
app.use('/api/mocktest', require('./routes/mocktest'));
app.use('/api/content-engine', require('./routes/contentEngine'));

// Pricing Plans
app.use('/api/pricing-plans', require('./routes/pricingPlans'));

// Study Rooms (Feature 4 — Collaborative Study Rooms)
app.use('/api/study-rooms', require('./routes/studyRooms'));

// Universities (Feature 3 — University Course Sync)
app.use('/api/universities', require('./routes/universities'));

// Flashcards & Spaced Repetition (Feature 5)
app.use('/api/flashcards', require('./routes/flashcards'));

// Dashboard Layout (Feature 7)
app.use('/api/dashboard', require('./routes/dashboardRoutes'));

// Offline Sync (Feature 6)
app.use('/api/sync', require('./routes/syncRoutes'));

// Course Sync (Feature 3)
app.use('/api/course-sync', require('./routes/courseSyncRoutes'));

// Shortcuts API (Feature 8)
app.use('/api/shortcuts', require('./routes/shortcutsRoutes'));

// ── NEW: 11 Massive Features Backend ──
app.use('/api/essay-scorer', require('./routes/essayScorer'));
app.use('/api/wellness', require('./routes/wellness'));
app.use('/api/scholar-coins', require('./routes/scholarCoins'));
app.use('/api/peer-tutoring', require('./routes/peerTutoring'));
app.use('/api/competitions', require('./routes/competitions'));
app.use('/api/freelance', require('./routes/freelance'));
app.use('/api/store', require('./routes/studyStore'));

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
