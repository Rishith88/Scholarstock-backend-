const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const DashboardLayout = require('../models/DashboardLayout');
const Task = require('../models/Task');
const Material = require('../models/Material');
const Flashcard = require('../models/Flashcard');
const CourseSyncRecord = require('../models/CourseSyncRecord');

// GET /api/dashboard/layout — get user's dashboard layout
router.get('/layout', verifyToken, async (req, res) => {
  try {
    let layout = await DashboardLayout.findOne({ userId: req.userId });
    
    if (!layout) {
      // Return default layout if none exists
      layout = {
        userId: req.userId,
        widgets: [
          { widgetType: 'UpcomingDeadlines', gridX: 0, gridY: 0, gridW: 6, gridH: 3 },
          { widgetType: 'StudyStats', gridX: 6, gridY: 0, gridW: 6, gridH: 3 },
          { widgetType: 'RecentDocuments', gridX: 0, gridY: 3, gridW: 6, gridH: 3 },
          { widgetType: 'TodoList', gridX: 6, gridY: 3, gridW: 6, gridH: 3 },
          { widgetType: 'FlashcardDue', gridX: 0, gridY: 6, gridW: 4, gridH: 2 },
          { widgetType: 'StudyStreak', gridX: 4, gridY: 6, gridW: 4, gridH: 2 },
          { widgetType: 'ExamCountdown', gridX: 8, gridY: 6, gridW: 4, gridH: 2 },
        ],
      };
    }
    
    res.json({ success: true, layout });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/dashboard/layout — save layout
router.post('/layout', verifyToken, async (req, res) => {
  try {
    const { widgets } = req.body;
    if (!widgets || !Array.isArray(widgets)) {
      return res.status(400).json({ success: false, message: 'widgets array required' });
    }

    let layout = await DashboardLayout.findOne({ userId: req.userId });
    if (!layout) {
      layout = new DashboardLayout({ userId: req.userId, widgets });
    } else {
      layout.widgets = widgets;
      layout.updatedAt = new Date();
    }

    await layout.save();
    res.json({ success: true, layout });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/dashboard/layout — update layout
router.put('/layout', verifyToken, async (req, res) => {
  try {
    const { widgets } = req.body;
    if (!widgets || !Array.isArray(widgets)) {
      return res.status(400).json({ success: false, message: 'widgets array required' });
    }

    const layout = await DashboardLayout.findOneAndUpdate(
      { userId: req.userId },
      { widgets, updatedAt: new Date() },
      { new: true, upsert: true }
    );

    res.json({ success: true, layout });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/dashboard/widgets/data — get all widget data
router.get('/widgets/data', verifyToken, async (req, res) => {
  try {
    const [tasks, materials, flashcards, syncRecords] = await Promise.all([
      Task.find({ userId: req.userId, status: { $ne: 'completed' } })
        .sort({ dueDate: 1 })
        .limit(10),
      Material.find({ uploadedBy: req.userId })
        .sort({ createdAt: -1 })
        .limit(5),
      Flashcard.find({ userId: req.userId, nextReviewDate: { $lte: new Date() } })
        .limit(10),
      CourseSyncRecord.find({ userId: req.userId })
        .sort({ syncedAt: -1 })
        .limit(5),
    ]);

    res.json({
      success: true,
      data: {
        upcomingDeadlines: tasks,
        recentDocuments: materials,
        flashcardsDue: flashcards,
        syncHistory: syncRecords,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
