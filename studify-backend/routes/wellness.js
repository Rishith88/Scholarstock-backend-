const express = require('express');
const router = express.Router();
const WellnessLog = require('../models/WellnessLog');
const { verifyToken } = require('../middleware/auth');

// POST /api/wellness/checkin — log daily check-in
router.post('/checkin', verifyToken, async (req, res) => {
  try {
    const { mood, studyHours, sleepHours, journal, meditationMinutes } = req.body;
    if (mood === undefined) return res.status(400).json({ success: false, message: 'Mood is required' });

    // Check if already logged today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let existing = await WellnessLog.findOne({ userId: req.userId, date: { $gte: today, $lt: tomorrow } });

    // Calculate burnout score
    const burnoutScore = Math.min(100, Math.max(0, Math.round(
      ((studyHours || 0) * 8) - ((sleepHours || 7) * 5) + (mood * 10)
    )));

    if (existing) {
      existing.mood = mood;
      existing.studyHours = studyHours || 0;
      existing.sleepHours = sleepHours || 0;
      existing.journal = journal || '';
      existing.meditationMinutes = meditationMinutes || 0;
      existing.burnoutScore = burnoutScore;
      await existing.save();
      return res.json({ success: true, log: existing, message: 'Check-in updated' });
    }

    const log = await WellnessLog.create({
      userId: req.userId,
      mood,
      studyHours: studyHours || 0,
      sleepHours: sleepHours || 0,
      journal: journal || '',
      meditationMinutes: meditationMinutes || 0,
      burnoutScore
    });

    res.status(201).json({ success: true, log });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/wellness/week — get this week's logs
router.get('/week', verifyToken, async (req, res) => {
  try {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);

    const logs = await WellnessLog.find({
      userId: req.userId,
      date: { $gte: monday }
    }).sort({ date: 1 });

    // Calculate streak
    const allLogs = await WellnessLog.find({ userId: req.userId }).sort({ date: -1 }).limit(30);
    let streak = 0;
    const todayStr = new Date().toDateString();
    for (const log of allLogs) {
      const d = new Date();
      d.setDate(d.getDate() - streak);
      if (log.date.toDateString() === d.toDateString() || log.date.toDateString() === todayStr) {
        streak++;
      } else break;
    }

    // Calculate stats
    const avgStudy = logs.length ? +(logs.reduce((a, l) => a + l.studyHours, 0) / logs.length).toFixed(1) : 0;
    const avgSleep = logs.length ? +(logs.reduce((a, l) => a + l.sleepHours, 0) / logs.length).toFixed(1) : 0;
    const avgMood = logs.length ? +(logs.reduce((a, l) => a + l.mood, 0) / logs.length).toFixed(1) : 0;
    const totalMeditation = logs.reduce((a, l) => a + (l.meditationMinutes || 0), 0);
    const burnoutScore = logs.length ? Math.round(logs.reduce((a, l) => a + l.burnoutScore, 0) / logs.length) : 0;

    res.json({
      success: true,
      logs,
      stats: { avgStudy, avgSleep, avgMood, totalMeditation, burnoutScore, streak }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/wellness/history — get monthly history
router.get('/history', verifyToken, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const since = new Date();
    since.setDate(since.getDate() - parseInt(days));

    const logs = await WellnessLog.find({ userId: req.userId, date: { $gte: since } })
      .sort({ date: -1 });

    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/wellness/meditation — log meditation session
router.post('/meditation', verifyToken, async (req, res) => {
  try {
    const { minutes } = req.body;
    if (!minutes || minutes < 1) return res.status(400).json({ success: false, message: 'Minutes required' });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let log = await WellnessLog.findOne({ userId: req.userId, date: { $gte: today, $lt: tomorrow } });
    if (log) {
      log.meditationMinutes = (log.meditationMinutes || 0) + minutes;
      await log.save();
    } else {
      log = await WellnessLog.create({ userId: req.userId, meditationMinutes: minutes, mood: 2 });
    }

    res.json({ success: true, log, message: `${minutes} min meditation logged` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/wellness/meditations — get available meditations
router.get('/meditations', verifyToken, async (req, res) => {
  try {
    const meditations = [
      { id: 1, name: 'Study Break Calm', duration: '5 min', icon: '🧘', type: 'meditation', description: 'Quick breathing exercise to reset between study sessions.' },
      { id: 2, name: 'Deep Focus Prep', duration: '10 min', icon: '🎯', type: 'meditation', description: 'Guided visualization to prepare your mind for deep work.' },
      { id: 3, name: 'Exam Anxiety Relief', duration: '8 min', icon: '😮‍💨', type: 'meditation', description: 'Body scan technique specifically designed for pre-exam stress.' },
      { id: 4, name: 'Forest Rain', duration: '30 min', icon: '🌧️', type: 'soundscape', description: 'Gentle rain falling on forest canopy with distant thunder.' },
      { id: 5, name: 'Ocean Waves', duration: '45 min', icon: '🌊', type: 'soundscape', description: 'Rhythmic ocean waves for background study ambient.' },
      { id: 6, name: 'Sleep Stories: Space', duration: '20 min', icon: '🌌', type: 'sleep', description: 'A narrated journey through the cosmos to help you drift off.' },
      { id: 7, name: 'Morning Energy', duration: '7 min', icon: '☀️', type: 'meditation', description: 'Start your study day with intention and positive energy.' },
      { id: 8, name: 'Gratitude Practice', duration: '5 min', icon: '🙏', type: 'meditation', description: 'End-of-day reflection to appreciate your learning journey.' },
    ];
    res.json({ success: true, meditations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/wellness/tips — get wellness tips
router.get('/tips', verifyToken, async (req, res) => {
  try {
    const tips = [
      { title: '20-20-20 Rule', desc: 'Every 20 min, look at something 20 feet away for 20 seconds.', icon: '👁️' },
      { title: 'Hydration Check', desc: 'Drink water every hour. Dehydration reduces focus by 25%.', icon: '💧' },
      { title: 'Movement Break', desc: 'Stand and stretch every 45 min to boost blood flow to your brain.', icon: '🏃' },
      { title: 'Social Connect', desc: 'Spend 15 min talking to a friend or family member daily.', icon: '💬' },
    ];
    res.json({ success: true, tips });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
