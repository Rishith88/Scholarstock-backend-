const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '../data/founder.json');

// Initialize with default content
if (!fs.existsSync(dataPath)) {
  const defaultContent = {
    chapter1: "Welcome to Studify - where education meets affordability. Our journey began with a simple observation: quality study materials were too expensive for most students.",
    chapter2: "We believe that every student deserves access to premium educational resources, regardless of their financial situation. That's why we created a rental model that makes sense.",
    chapter3: "Join us in revolutionizing how students access educational resources. Together, we're making quality education accessible to everyone, one rental at a time."
  };
  fs.writeFileSync(dataPath, JSON.stringify(defaultContent, null, 2));
}

// @route   GET /api/founder
// @desc    Get founder page content
// @access  Public
router.get('/', (req, res) => {
  try {
    const content = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    res.json({
      success: true,
      ...content
    });
  } catch (error) {
    console.error('Get founder content error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/founder
// @desc    Save founder page content
// @access  Private (Admin)
router.post('/', (req, res) => {
  try {
    const { chapter1, chapter2, chapter3 } = req.body;

    if (!chapter1 || !chapter2 || !chapter3) {
      return res.status(400).json({
        success: false,
        message: 'All chapters are required'
      });
    }

    const content = { chapter1, chapter2, chapter3 };
    fs.writeFileSync(dataPath, JSON.stringify(content, null, 2));

    res.json({
      success: true,
      message: 'Founder page updated successfully',
      ...content
    });
  } catch (error) {
    console.error('Save founder content error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
