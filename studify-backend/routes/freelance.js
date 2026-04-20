const express = require('express');
const router = express.Router();
const FreelanceGig = require('../models/FreelanceGig');
const { verifyToken } = require('../middleware/auth');

// POST /api/freelance/gigs — create a new gig
router.post('/gigs', verifyToken, async (req, res) => {
  try {
    const { title, description, category, price, delivery, tags } = req.body;
    if (!title || !description || !category || !price || !delivery) {
      return res.status(400).json({ success: false, message: 'Title, description, category, price, and delivery are required' });
    }

    const gig = await FreelanceGig.create({
      sellerId: req.userId,
      sellerName: req.user.name,
      sellerUni: req.body.sellerUni || '',
      title, description, category,
      price: Number(price),
      delivery,
      tags: tags || []
    });

    res.status(201).json({ success: true, gig });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/freelance/gigs — list gigs with filters
router.get('/gigs', async (req, res) => {
  try {
    const { category, search, sort = 'featured', page = 1, limit = 20 } = req.query;
    const query = { status: 'active' };
    if (category && category !== 'All') query.category = category;
    if (search) query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { tags: { $regex: search, $options: 'i' } }
    ];

    let sortObj = { featured: -1, createdAt: -1 };
    if (sort === 'price') sortObj = { price: 1 };
    if (sort === 'rating') sortObj = { rating: -1 };

    const gigs = await FreelanceGig.find(query)
      .sort(sortObj)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await FreelanceGig.countDocuments(query);

    res.json({ success: true, gigs, total, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/freelance/my-gigs — seller's own gigs
router.get('/my-gigs', verifyToken, async (req, res) => {
  try {
    const gigs = await FreelanceGig.find({ sellerId: req.userId }).sort({ createdAt: -1 });
    res.json({ success: true, gigs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/freelance/gigs/:id — update a gig
router.put('/gigs/:id', verifyToken, async (req, res) => {
  try {
    const gig = await FreelanceGig.findById(req.params.id);
    if (!gig) return res.status(404).json({ success: false, message: 'Gig not found' });
    if (gig.sellerId.toString() !== req.userId.toString()) return res.status(403).json({ success: false, message: 'Not your gig' });

    const { title, description, category, price, delivery, tags, status } = req.body;
    if (title) gig.title = title;
    if (description) gig.description = description;
    if (category) gig.category = category;
    if (price) gig.price = Number(price);
    if (delivery) gig.delivery = delivery;
    if (tags) gig.tags = tags;
    if (status) gig.status = status;
    await gig.save();

    res.json({ success: true, gig });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/freelance/gigs/:id — delete a gig
router.delete('/gigs/:id', verifyToken, async (req, res) => {
  try {
    const gig = await FreelanceGig.findById(req.params.id);
    if (!gig) return res.status(404).json({ success: false, message: 'Gig not found' });
    if (gig.sellerId.toString() !== req.userId.toString()) return res.status(403).json({ success: false, message: 'Not your gig' });

    gig.status = 'deleted';
    await gig.save();
    res.json({ success: true, message: 'Gig deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
