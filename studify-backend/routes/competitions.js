const express = require('express');
const router = express.Router();
const CompetitionRegistration = require('../models/CompetitionRegistration');
const { verifyToken } = require('../middleware/auth');

// POST /api/competitions/register — register for a competition
router.post('/register', verifyToken, async (req, res) => {
  try {
    const { competitionId, competitionName, teamName, teammates } = req.body;
    if (!competitionId || !competitionName) return res.status(400).json({ success: false, message: 'Competition ID and name required' });

    const existing = await CompetitionRegistration.findOne({ userId: req.userId, competitionId });
    if (existing) return res.status(400).json({ success: false, message: 'Already registered for this competition' });

    const reg = await CompetitionRegistration.create({
      userId: req.userId,
      competitionId,
      competitionName,
      teamName: teamName || '',
      teammates: teammates || []
    });

    res.status(201).json({ success: true, registration: reg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/competitions/my — user's registrations
router.get('/my', verifyToken, async (req, res) => {
  try {
    const registrations = await CompetitionRegistration.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json({ success: true, registrations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/competitions/:competitionId/participants — count participants
router.get('/:competitionId/participants', verifyToken, async (req, res) => {
  try {
    const count = await CompetitionRegistration.countDocuments({ competitionId: req.params.competitionId });
    res.json({ success: true, count });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/competitions/:competitionId/unregister — cancel registration
router.delete('/:competitionId/unregister', verifyToken, async (req, res) => {
  try {
    const result = await CompetitionRegistration.findOneAndDelete({ userId: req.userId, competitionId: req.params.competitionId });
    if (!result) return res.status(404).json({ success: false, message: 'Registration not found' });
    res.json({ success: true, message: 'Unregistered successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
