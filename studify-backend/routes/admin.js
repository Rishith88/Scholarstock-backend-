// studify-backend/routes/admin.js - WITH VAULT VERIFICATION

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const User = require('../models/User');
const Material = require('../models/Material');
const Rental = require('../models/Rental');

// Setup multer for PDF uploads
const uploadDir = path.join(__dirname, '../uploads/pdfs');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed'));
  }
});

// Get credentials from .env
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'StudifyAdmin@2024';
const VAULT_CODE = process.env.VAULT_CODE || 'STUDIFY2024';

// Verify vault code endpoint
router.post('/verify-vault', async (req, res) => {
  try {
    const { vaultCode } = req.body;

    if (!vaultCode) {
      return res.status(400).json({
        success: false,
        message: 'Vault code is required'
      });
    }

    // Check if vault code matches
    if (vaultCode === VAULT_CODE) {
      return res.json({
        success: true,
        message: 'Vault unlocked successfully'
      });
    } else {
      return res.status(401).json({
        success: false,
        message: 'Invalid vault code. Access denied.'
      });
    }

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Admin login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Check credentials
    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      return res.status(401).json({
        success: false,
        message: 'Invalid admin credentials'
      });
    }

    // Generate admin token
    const token = jwt.sign(
      { username: ADMIN_USERNAME, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      admin: {
        username: ADMIN_USERNAME,
        role: 'admin'
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Middleware to verify admin token
const verifyAdmin = (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    req.admin = decoded;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
};

// Get dashboard statistics
router.get('/stats', verifyAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalMaterials = await Material.countDocuments();
    const activeRentals = await Rental.countDocuments({ status: 'active' });
    
    // Calculate total revenue
    const rentals = await Rental.find();
    const totalRevenue = rentals.reduce((sum, rental) => sum + (rental.pricePaid || 0), 0);

    // Get stats by time period
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayUsers = await User.countDocuments({
      createdAt: { $gte: today }
    });
    
    const todayRentals = await Rental.countDocuments({
      createdAt: { $gte: today }
    });

    res.json({
      success: true,
      data: {
        totalUsers,
        totalMaterials,
        totalRevenue,
        activeRentals,
        todayUsers,
        todayRentals
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Get all users
router.get('/users', verifyAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await User.countDocuments();

    res.json({
      success: true,
      users,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Get all materials
router.get('/materials', verifyAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const materials = await Material.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await Material.countDocuments();

    res.json({
      success: true,
      materials,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Get all rentals/transactions
router.get('/rentals', verifyAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const rentals = await Rental.find()
      .populate('userId', 'name email')
      .populate('materialId', 'title examLabel pricePerDay')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await Rental.countDocuments();

    res.json({
      success: true,
      rentals,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Get single user details
router.get('/users/:id', verifyAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user's rentals
    const rentals = await Rental.find({ user: req.params.id })
      .populate('material', 'title examLabel pricePerDay')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      user,
      rentals
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Delete user
router.delete('/users/:id', verifyAdmin, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Also delete user's rentals
    await Rental.deleteMany({ user: req.params.id });

    res.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Create material
router.post('/materials', verifyAdmin, upload.single('pdf'), async (req, res) => {
  try {
    console.log('📥 Received upload request');
    console.log('Body:', req.body);
    console.log('File:', req.file);

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'PDF file is required' });
    }

    // Map frontend fields to backend fields
    const category = req.body.category; // Frontend sends 'category'
    const price = req.body.price; // Frontend sends 'price'

    if (!category) {
      return res.status(400).json({ success: false, message: 'Category is required' });
    }

    const pdfUrl = `/uploads/pdfs/${req.file.filename}`;

    const material = new Material({
      title: req.body.title,
      description: req.body.description || '',
      examCategory: category,  // Map category -> examCategory
      examLabel: category,     // Same as examCategory
      subcategory: req.body.subcategory,
      pricePerDay: parseFloat(price) || 29,  // Map price -> pricePerDay
      type: req.body.type || 'notes',
      pages: parseInt(req.body.pages) || 1,
      pdfUrl
    });

    await material.save();

    console.log('✅ Material saved:', material._id);

    res.json({
      success: true,
      message: 'Material created successfully',
      material
    });

  } catch (error) {
    console.error('❌ Material creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Update material
router.put('/materials/:id', verifyAdmin, async (req, res) => {
  try {
    const material = await Material.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Material not found'
      });
    }

    res.json({
      success: true,
      message: 'Material updated successfully',
      material
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Delete material
router.delete('/materials/:id', verifyAdmin, async (req, res) => {
  try {
    const material = await Material.findByIdAndDelete(req.params.id);

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Material not found'
      });
    }

    // Also delete related rentals
    await Rental.deleteMany({ materialId: req.params.id });

    res.json({
      success: true,
      message: 'Material deleted successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Get revenue analytics
router.get('/analytics/revenue', verifyAdmin, async (req, res) => {
  try {
    const { period } = req.query; // day, week, month, year
    
    const now = new Date();
    let startDate = new Date();
    
    switch(period) {
      case 'day':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setMonth(now.getMonth() - 1);
    }

    const rentals = await Rental.find({
      createdAt: { $gte: startDate }
    });

    const revenue = rentals.reduce((sum, r) => sum + (r.pricePaid || 0), 0);

    res.json({
      success: true,
      period,
      revenue,
      transactions: rentals.length
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Get categories (admin panel loads these)
router.get('/categories', verifyAdmin, async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const dataPath = path.join(__dirname, '../data/categories.json');

    if (fs.existsSync(dataPath)) {
      // Saved file exists — use it as the single source of truth
      const categories = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      res.json({ success: true, categories });
    } else {
      // First time ever — send hardcoded so admin panel populates
      const { SUBCATEGORIES } = require('../models/Material');
      res.json({ success: true, categories: SUBCATEGORIES });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// Save categories (admin clicks "Save All Changes")
router.put('/categories', verifyAdmin, async (req, res) => {
  try {
    const { categories } = req.body;

    if (!categories || typeof categories !== 'object') {
      return res.status(400).json({ success: false, message: 'Invalid categories data' });
    }

    const fs = require('fs');
    const path = require('path');
    const dataDir = path.join(__dirname, '../data');
    const dataPath = path.join(dataDir, 'categories.json');

    // Create data folder if it doesn't exist (same pattern as founder.js)
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    // Whatever admin sends = the new truth. Hardcoded is replaced.
    fs.writeFileSync(dataPath, JSON.stringify(categories, null, 2));

    res.json({ success: true, message: 'Categories saved successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

module.exports = router;
