const express = require('express');
const router = express.Router();
const TutoringRequest = require('../models/TutoringRequest');
const { verifyToken } = require('../middleware/auth');

// POST /api/peer-tutoring/request — post a tutoring request
router.post('/request', verifyToken, async (req, res) => {
  try {
    const { subject, topic, details, budget, urgency } = req.body;
    if (!subject || !topic) return res.status(400).json({ success: false, message: 'Subject and topic required' });

    const request = await TutoringRequest.create({
      studentId: req.userId,
      studentName: req.user.name,
      subject, topic,
      details: details || '',
      budget: budget || 0,
      urgency: urgency || 'medium'
    });

    res.status(201).json({ success: true, request });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/peer-tutoring/requests — list open requests
router.get('/requests', verifyToken, async (req, res) => {
  try {
    const { subject, urgency } = req.query;
    const query = { status: 'open' };
    if (subject) query.subject = { $regex: subject, $options: 'i' };
    if (urgency) query.urgency = urgency;

    const requests = await TutoringRequest.find(query)
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ success: true, requests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/peer-tutoring/my-requests — user's own requests
router.get('/my-requests', verifyToken, async (req, res) => {
  try {
    const requests = await TutoringRequest.find({ studentId: req.userId }).sort({ createdAt: -1 });
    res.json({ success: true, requests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/peer-tutoring/:id/bid — place a bid on a request
router.post('/:id/bid', verifyToken, async (req, res) => {
  try {
    const { message, rate } = req.body;
    const request = await TutoringRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    if (request.status !== 'open') return res.status(400).json({ success: false, message: 'Request is no longer open' });
    if (request.studentId.toString() === req.userId.toString()) return res.status(400).json({ success: false, message: 'Cannot bid on your own request' });

    const alreadyBid = request.bids.some(b => b.tutorId.toString() === req.userId.toString());
    if (alreadyBid) return res.status(400).json({ success: false, message: 'Already bid on this request' });

    request.bids.push({ tutorId: req.userId, tutorName: req.user.name, message: message || '', rate: rate || 0 });
    await request.save();

    res.json({ success: true, request, message: 'Bid placed!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/peer-tutoring/:id/accept — accept a bid
router.post('/:id/accept', verifyToken, async (req, res) => {
  try {
    const { tutorId } = req.body;
    const request = await TutoringRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Not found' });
    if (request.studentId.toString() !== req.userId.toString()) return res.status(403).json({ success: false, message: 'Only the requester can accept bids' });

    request.acceptedBid = tutorId;
    request.status = 'in-progress';
    await request.save();

    res.json({ success: true, request });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/peer-tutoring/:id/complete — mark complete with rating
router.post('/:id/complete', verifyToken, async (req, res) => {
  try {
    const { rating, review } = req.body;
    const request = await TutoringRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Not found' });
    if (request.studentId.toString() !== req.userId.toString()) return res.status(403).json({ success: false, message: 'Only requester can complete' });

    request.status = 'completed';
    if (rating) request.rating = rating;
    if (review) request.review = review;
    await request.save();

    res.json({ success: true, request });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
