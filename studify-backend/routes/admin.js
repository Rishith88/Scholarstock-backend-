const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Material = require('../models/Material');
const Rental = require('../models/Rental');
const { verifyToken, verifyAdmin } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Combined middleware for cleaner admin routes
const adminAuth = [verifyToken, verifyAdmin];

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'materials';

// Auto-create bucket if it doesn't exist
(async () => {
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets && buckets.find(b => b.name === SUPABASE_BUCKET);
    if (!exists) {
      await supabase.storage.createBucket(SUPABASE_BUCKET, { public: true });
      console.log(`✅ Supabase bucket '${SUPABASE_BUCKET}' created`);
    }
  } catch (e) {
    console.log('Supabase bucket check:', e.message);
  }
})();

// Multer memory storage (buffer → Supabase)
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed'), false);
  },
  limits: { fileSize: 50 * 1024 * 1024 }
});

// POST /api/admin/verify-vault - Verify vault code from environment variable
router.post('/verify-vault', (req, res) => {
  try {
    const { vaultCode } = req.body;
    // Check both ADMIN_VAULT_CODE and VAULT_CODE for compatibility with Render environment
    const envVaultCode = process.env.VAULT_CODE || process.env.ADMIN_VAULT_CODE || 'ADMIN2026';
    
    if (vaultCode && vaultCode.toUpperCase() === envVaultCode.toUpperCase()) {
      res.json({ success: true });
    } else {
      res.json({ success: false });
    }
  } catch (error) {
    console.error('Vault verification error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Verification failed' 
    });
  }
});

// POST /api/admin/login - Admin login
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
    
    if (username === adminUser && password === adminPass) {
      const token = jwt.sign(
        { role: 'admin', username },
        process.env.JWT_SECRET || 'studify_super_secret_jwt_key_2024_change_in_production',
        { expiresIn: '24h' }
      );
      
      res.json({ 
        success: true, 
        token,
        admin: { username, role: 'admin' }
      });
    } else {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// --- PROTECTED ADMIN ROUTES ---

// GET /api/admin/stats - Get dashboard statistics
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: 'user' });
    const totalMaterials = await Material.countDocuments();
    const activeRentals = await Rental.countDocuments({ status: 'active' });
    
    // Calculate total revenue from rentals
    const revenueData = await Rental.aggregate([
      { $match: { status: { $in: ['active', 'completed'] } } },
      { $group: { _id: null, total: { $sum: '$pricePaid' } } }
    ]);
    const totalRevenue = revenueData.length > 0 ? revenueData[0].total : 0;

    // Today's stats
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const todayUsers = await User.countDocuments({ 
      role: 'user', 
      createdAt: { $gte: startOfToday } 
    });
    
    const todayRentals = await Rental.countDocuments({ 
      createdAt: { $gte: startOfToday } 
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
    console.error('Stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to load stats' });
  }
});

// GET /api/admin/users - Get all users
router.get('/users', adminAuth, async (req, res) => {
  try {
    const { limit = 100, skip = 0 } = req.query;
    const users = await User.find({ role: 'user' })
      .sort('-createdAt')
      .limit(parseInt(limit))
      .skip(parseInt(skip));
    
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load users' });
  }
});

// DELETE /api/admin/users/:id - Delete a user
router.delete('/users/:id', adminAuth, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete user' });
  }
});

// GET /api/admin/materials - Get all materials
router.get('/materials', adminAuth, async (req, res) => {
  try {
    const { limit = 100, skip = 0 } = req.query;
    const materials = await Material.find()
      .sort('-createdAt')
      .limit(parseInt(limit))
      .skip(parseInt(skip));
    
    res.json({ success: true, materials });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load materials' });
  }
});

// POST /api/admin/materials - Create a new material with PDF
router.post('/materials', adminAuth, upload.single('pdf'), async (req, res) => {
  try {
    const { title, category, subcategory, price, description, author } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'PDF file is required' });
    }

    // Upload buffer to Supabase Storage
    const filename = `pdfs/${Date.now()}-${Math.round(Math.random() * 1e9)}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .upload(filename, req.file.buffer, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from(SUPABASE_BUCKET)
      .getPublicUrl(filename);

    const material = new Material({
      title,
      examCategory: category,
      subcategory,
      examLabel: category,
      pricePerDay: parseFloat(price),
      description,
      author: author || 'Admin',
      pdfUrl: urlData.publicUrl,
      isActive: true
    });

    await material.save();
    res.status(201).json({ success: true, material });
  } catch (error) {
    console.error('Add material error:', error);
    res.status(500).json({ success: false, message: 'Failed to add material', error: error.message });
  }
});

// DELETE /api/admin/materials/:id - Delete a material
router.delete('/materials/:id', adminAuth, async (req, res) => {
  try {
    const material = await Material.findById(req.params.id);
    if (!material) return res.status(404).json({ success: false, message: 'Material not found' });

    // Delete local file if it exists
    if (material.pdfUrl && !material.pdfUrl.startsWith('http')) {
      const filePath = path.join(__dirname, '..', material.pdfUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await Material.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Material deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete material' });
  }
});

// GET /api/admin/rentals - Get all rentals (transactions)
router.get('/rentals', adminAuth, async (req, res) => {
  try {
    const { limit = 100, skip = 0 } = req.query;
    const rentals = await Rental.find()
      .populate('userId', 'name email')
      .populate('materialId', 'title')
      .sort('-createdAt')
      .limit(parseInt(limit))
      .skip(parseInt(skip));
    
    // Map for frontend compatibility
    const formattedRentals = rentals.map(r => ({
      ...r.toObject(),
      user: r.userId,
      material: r.materialId
    }));

    res.json({ success: true, rentals: formattedRentals });
  } catch (error) {
    console.error('Rentals error:', error);
    res.status(500).json({ success: false, message: 'Failed to load rentals' });
  }
});

// PUT /api/admin/categories - Update categories structure
router.put('/categories', adminAuth, async (req, res) => {
  try {
    const { categories } = req.body;
    if (!categories) {
      return res.status(400).json({ success: false, message: 'Categories data required' });
    }
    
    const dataPath = path.join(__dirname, '../data/categories.json');
    fs.writeFileSync(dataPath, JSON.stringify(categories, null, 2));
    
    res.json({ success: true, message: 'Categories structure updated and saved to data/categories.json' });
  } catch (error) {
    console.error('Update categories error:', error);
    res.status(500).json({ success: false, message: 'Failed to update categories' });
  }
});

// PUT /api/admin/materials/:id/approve - Approve a material
router.put('/materials/:id/approve', adminAuth, async (req, res) => {
  try {
    const material = await Material.findById(req.params.id);
    if (!material) {
      return res.status(404).json({ success: false, message: 'Material not found' });
    }

    material.isActive = true;
    await material.save();

    res.json({ success: true, message: 'Material approved and is now active' });
  } catch (error) {
    console.error('Approve material error:', error);
    res.status(500).json({ success: false, message: 'Failed to approve material' });
  }
});

// PUT /api/admin/materials/approve-all - Approve all pending materials
router.put('/materials/approve-all', adminAuth, async (req, res) => {
  try {
    await Material.updateMany({ isActive: false }, { $set: { isActive: true } });
    res.json({ success: true, message: 'All pending materials have been approved.' });
  } catch (error) {
    console.error('Approve all materials error:', error);
    res.status(500).json({ success: false, message: 'Failed to approve all materials' });
  }
});

module.exports = router;
