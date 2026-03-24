// studify-backend/routes/categories.js

const express = require('express');
const router = express.Router();
const Material = require('../models/Material');
const { SUBCATEGORIES } = require('../models/Material');

// Auth middleware (if needed for protected routes)
const auth = require('../middleware/auth');

// ============================================
// GET ALL CATEGORIES WITH SUBCATEGORIES
// Automatically adds "Free Resources" to every category
// ============================================
router.get('/structure', async (req, res) => {
  try {
    // Clone the categories object to avoid modifying the original
    const categoriesWithFreeResources = {};
    
    // Add "Free Resources" to each category automatically
    Object.keys(SUBCATEGORIES).forEach(category => {
      const subcats = Array.isArray(SUBCATEGORIES[category]) 
        ? [...SUBCATEGORIES[category]] 
        : [];
      
      // Add "Free Resources" at the beginning if not already present
      if (!subcats.includes('Free Resources')) {
        subcats.unshift('Free Resources');
      }
      
      categoriesWithFreeResources[category] = subcats;
    });
    
    res.json({
      success: true,
      categories: categoriesWithFreeResources
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// ============================================
// GET SUBCATEGORIES FOR A SPECIFIC CATEGORY
// Automatically includes "Free Resources"
// ============================================
router.get('/:category/subcategories', async (req, res) => {
  try {
    const { category } = req.params;
    
    let subcategories = SUBCATEGORIES[category];
    
    if (!subcategories) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }
    
    // Clone and add "Free Resources" if not present
    subcategories = Array.isArray(subcategories) ? [...subcategories] : [];
    if (!subcategories.includes('Free Resources')) {
      subcategories.unshift('Free Resources');
    }
    
    res.json({
      success: true,
      category,
      subcategories
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// ============================================
// GET MATERIALS BY CATEGORY AND SUBCATEGORY
// ============================================
router.get('/:category/:subcategory/materials', async (req, res) => {
  try {
    const { category, subcategory } = req.params;
    const { page = 1, limit = 20, sort = '-createdAt' } = req.query;
    
    const skip = (page - 1) * limit;
    
    const materials = await Material.find({
      examCategory: category,
      subcategory: subcategory,
      isActive: true
    })
    .sort(sort)
    .limit(parseInt(limit))
    .skip(skip);
    
    const total = await Material.countDocuments({
      examCategory: category,
      subcategory: subcategory,
      isActive: true
    });
    
    res.json({
      success: true,
      category,
      subcategory,
      materials,
      pagination: {
        total,
        page: parseInt(page),
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

// ============================================
// GET STATS FOR ALL CATEGORIES
// ============================================
router.get('/stats/all', async (req, res) => {
  try {
    const stats = await Material.aggregate([
      {
        $group: {
          _id: {
            category: '$examCategory',
            subcategory: '$subcategory'
          },
          count: { $sum: 1 },
          totalViews: { $sum: '$views' },
          avgRating: { $avg: '$rating' }
        }
      },
      {
        $sort: { '_id.category': 1, '_id.subcategory': 1 }
      }
    ]);
    
    // Format the stats
    const formattedStats = {};
    
    stats.forEach(stat => {
      const category = stat._id.category;
      const subcategory = stat._id.subcategory;
      
      if (!formattedStats[category]) {
        formattedStats[category] = {
          total: 0,
          subcategories: {}
        };
      }
      
      formattedStats[category].total += stat.count;
      formattedStats[category].subcategories[subcategory] = {
        count: stat.count,
        views: stat.totalViews,
        avgRating: stat.avgRating ? stat.avgRating.toFixed(1) : 0
      };
    });
    
    res.json({
      success: true,
      stats: formattedStats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// ============================================
// SEARCH WITHIN CATEGORY/SUBCATEGORY
// ============================================
router.get('/:category/:subcategory/search', async (req, res) => {
  try {
    const { category, subcategory } = req.params;
    const { q, page = 1, limit = 20 } = req.query;
    
    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }
    
    const skip = (page - 1) * limit;
    
    const materials = await Material.find({
      examCategory: category,
      subcategory: subcategory,
      isActive: true,
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { tags: { $regex: q, $options: 'i' } }
      ]
    })
    .limit(parseInt(limit))
    .skip(skip);
    
    const total = await Material.countDocuments({
      examCategory: category,
      subcategory: subcategory,
      isActive: true,
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { tags: { $regex: q, $options: 'i' } }
      ]
    });
    
    res.json({
      success: true,
      query: q,
      category,
      subcategory,
      materials,
      pagination: {
        total,
        page: parseInt(page),
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

module.exports = router;
