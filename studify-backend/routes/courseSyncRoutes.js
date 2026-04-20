const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');

// Optional rate limiter - fallback to no-op if not available
let courseSyncLimiter = (req, res, next) => next();
try {
  const { courseSyncLimiter: limiter } = require('../middleware/rateLimiter');
  courseSyncLimiter = limiter;
} catch (err) {
  console.warn('⚠️ Rate limiter not available, skipping course sync rate limiting');
}

const University = require('../models/University');
const CourseSyncRecord = require('../models/CourseSyncRecord');
const Material = require('../models/Material');
const Task = require('../models/Task');
const User = require('../models/User');

// GET /api/course-sync/universities — list available universities
router.get('/universities', async (req, res) => {
  try {
    const universities = await University.find().select('universityId name location affiliatedBoard');
    res.json({ success: true, universities });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/course-sync/history — get sync history for user
router.get('/history', verifyToken, async (req, res) => {
  try {
    const history = await CourseSyncRecord.find({ userId: req.userId })
      .sort({ syncedAt: -1 })
      .limit(50);
    res.json({ success: true, history });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/course-sync/sync — sync course with rate limiting
router.post('/sync', verifyToken, courseSyncLimiter, async (req, res) => {
  try {
    const { universityId, courseCode } = req.body;
    if (!universityId || !courseCode) {
      return res.status(400).json({ success: false, message: 'universityId and courseCode required' });
    }

    const user = await User.findById(req.userId);
    const isPaid = user.role === 'admin' || user.subscriptionStatus === 'active';

    // Check subscription limits for free users
    if (!isPaid) {
      const thisMonth = new Date();
      thisMonth.setDate(1);
      const syncCount = await CourseSyncRecord.countDocuments({
        userId: req.userId,
        syncedAt: { $gte: thisMonth },
      });
      if (syncCount >= 3) {
        return res.status(429).json({ success: false, message: 'Free users limited to 3 syncs per month' });
      }
    }

    // Find university and course
    const university = await University.findOne({ universityId });
    if (!university) {
      return res.status(404).json({ success: false, message: 'University not found' });
    }

    const course = university.courses.find(c => c.courseCode === courseCode);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    // Match syllabus topics to existing materials
    const keywords = course.syllabus.split(/\s+/).slice(0, 20);
    const matchedMaterials = await Material.find({
      $text: { $search: keywords.join(' ') },
    }).limit(20);

    const matchedMaterialIds = matchedMaterials.map(m => m._id);

    // Create tasks from assignments
    const taskIdsCreated = [];
    for (const assignment of course.assignments) {
      if (assignment.dueDate) {
        const task = await Task.create({
          userId: req.userId,
          title: assignment.title,
          description: assignment.description,
          dueDate: assignment.dueDate,
          priority: 'high',
          status: 'pending',
        });
        taskIdsCreated.push(task._id);
      }
    }

    // Create sync record
    const syncRecord = await CourseSyncRecord.create({
      userId: req.userId,
      universityId,
      courseCode,
      topicCount: keywords.length,
      matchedMaterialIds,
      taskIdsCreated,
    });

    res.json({
      success: true,
      syncRecord,
      matchedMaterialCount: matchedMaterials.length,
      tasksCreated: taskIdsCreated.length,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/course-sync/resync — idempotent re-sync
router.post('/resync', verifyToken, async (req, res) => {
  try {
    const { universityId, courseCode } = req.body;
    if (!universityId || !courseCode) {
      return res.status(400).json({ success: false, message: 'universityId and courseCode required' });
    }

    // Check if already synced
    const existing = await CourseSyncRecord.findOne({
      userId: req.userId,
      universityId,
      courseCode,
    });

    if (existing) {
      return res.json({ success: true, syncRecord: existing, message: 'Already synced' });
    }

    // Otherwise perform sync
    const university = await University.findOne({ universityId });
    if (!university) {
      return res.status(404).json({ success: false, message: 'University not found' });
    }

    const course = university.courses.find(c => c.courseCode === courseCode);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    const keywords = course.syllabus.split(/\s+/).slice(0, 20);
    const matchedMaterials = await Material.find({
      $text: { $search: keywords.join(' ') },
    }).limit(20);

    const syncRecord = await CourseSyncRecord.create({
      userId: req.userId,
      universityId,
      courseCode,
      topicCount: keywords.length,
      matchedMaterialIds: matchedMaterials.map(m => m._id),
    });

    res.json({ success: true, syncRecord });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
