// studify-backend/routes/materials.js

const express = require('express');
const router = express.Router();
const Material = require('../models/Material');
const { auth } = require('../middleware/auth');

// Helper function to check if material is free
// ⭐ FREE = subcategory is "Free Resources"
function isFreeResource(material) {
  return material.subcategory?.toLowerCase() === 'free resources';
}

// Get all materials with pagination and filters
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      category, 
      subcategory,
      search,
      sort = '-createdAt'
    } = req.query;

    const skip = (page - 1) * limit;
    
    // Build query
    let query = { isActive: true };
    
    if (category) {
      query.examCategory = category;
    }
    
    if (subcategory) {
      query.subcategory = subcategory;
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } }
      ];
    }
    
    const materials = await Material.find(query)
      .sort(sort)
      .limit(parseInt(limit))
      .skip(skip)
      .select('-__v');
    
    // ⭐ CHECK IF MATERIAL IS FREE (subcategory = "Free Resources")
    const materialsWithFreeCheck = materials.map(material => {
      const materialObj = material.toObject();
      
      if (isFreeResource(materialObj)) {
        materialObj.pricePerDay = 0;  // Set price to 0
        materialObj.isFreeResource = true;  // Add flag
      }
      
      return materialObj;
    });
    
    const total = await Material.countDocuments(query);
    
    res.json({
      success: true,
      materials: materialsWithFreeCheck,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        limit: parseInt(limit)
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

// Get single material by ID
router.get('/:id', async (req, res) => {
  try {
    const material = await Material.findById(req.params.id);
    
    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Material not found'
      });
    }
    
    // Increment views
    material.views += 1;
    await material.save();
    
    // ⭐ CHECK IF FREE
    const materialObj = material.toObject();
    
    if (isFreeResource(materialObj)) {
      materialObj.pricePerDay = 0;
      materialObj.isFreeResource = true;
    }
    
    res.json({
      success: true,
      material: materialObj
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Create new material (protected route)
router.post('/', auth, async (req, res) => {
  try {
    const material = new Material({
      ...req.body,
      uploadedBy: req.user.userId
    });
    
    await material.save();
    
    res.status(201).json({
      success: true,
      message: 'Material created successfully',
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

// Update material (protected route)
router.put('/:id', auth, async (req, res) => {
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

// Delete material (protected route)
router.delete('/:id', auth, async (req, res) => {
  try {
    const material = await Material.findByIdAndDelete(req.params.id);
    
    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Material not found'
      });
    }
    
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

const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');

// Stream/view PDF
router.get('/:id/stream', async (req, res) => {
  try {
    const material = await Material.findById(req.params.id);
    if (!material) return res.status(404).json({ success: false, message: 'Material not found' });

    // ⭐ CHECK IF FREE RESOURCE - No token needed!
    const isFree = isFreeResource(material.toObject());

    if (!isFree) {
      // Accept token from query param OR Authorization header
      const token = req.query.token ||
                    req.headers.authorization?.split(' ')[1];

      if (!token || token === 'undefined' || token === 'null') {
        return res.status(401).json({ success: false, message: 'No token provided' });
      }

      try {
        jwt.verify(token, process.env.JWT_SECRET);
      } catch (e) {
        return res.status(401).json({ success: false, message: 'Invalid or expired token' });
      }
    }

    // ── If pdfUrl is a full HTTP/S URL (cloud storage like S3, Cloudinary, etc.) ──
    if (material.pdfUrl && (material.pdfUrl.startsWith('http://') || material.pdfUrl.startsWith('https://'))) {
      // Redirect to the cloud URL directly
      return res.redirect(material.pdfUrl);
    }

    // ── Otherwise treat as local file path ──
    const filePath = path.join(__dirname, '..', material.pdfUrl);

    if (!fs.existsSync(filePath)) {
      console.error('[STREAM] File not found at path:', filePath);
      return res.status(404).json({
        success: false,
        message: 'PDF file not found. Note: files do not persist on Render free tier between deploys. Use cloud storage (S3/Cloudinary) for production.'
      });
    }

    const stat = fs.statSync(filePath);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `inline; filename="${material.title}.pdf"`);
    res.setHeader('Cache-Control', 'no-store'); // prevent browser caching for security

    fs.createReadStream(filePath).pipe(res);

  } catch (error) {
    console.error('[STREAM] Error:', error.message);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// Get featured materials
router.get('/featured/list', async (req, res) => {
  try {
    const materials = await Material.find({ 
      isFeatured: true, 
      isActive: true 
    })
    .limit(10)
    .sort('-createdAt');
    
    res.json({
      success: true,
      materials
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Search materials
router.get('/search/query', async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;
    
    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }
    
    const materials = await Material.find({
      isActive: true,
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { tags: { $regex: q, $options: 'i' } },
        { author: { $regex: q, $options: 'i' } }
      ]
    })
    .limit(parseInt(limit))
    .sort('-views');
    
    res.json({
      success: true,
      query: q,
      count: materials.length,
      materials
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

module.exports = router;

