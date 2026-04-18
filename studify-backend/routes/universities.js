const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { verifyToken, verifyAdmin } = require('../middleware/auth');

// ── University Schema (inline — no separate model file needed) ──
let University;
try {
  University = mongoose.model('University');
} catch {
  const schema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    domain: { type: String, required: true, trim: true, lowercase: true },
    country: { type: String, default: 'India' },
    verified: { type: Boolean, default: false },
    status: { type: String, enum: ['active', 'pending', 'suspended'], default: 'pending' },
    studentCount: { type: Number, default: 0 },
    materialCount: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    settings: {
      domainAutoAccess: { type: Boolean, default: true },
      institutionOnlyAccounts: { type: Boolean, default: false },
      freeAccessForStudents: { type: Boolean, default: true },
      guestAccessAllowed: { type: Boolean, default: true },
      guestPremiumPricing: { type: Number, default: 9.99 },
      revenueSplitUniversity: { type: Number, default: 70 },
      revenueSplitUploader: { type: Number, default: 20 },
      revenueSplitPlatform: { type: Number, default: 10 },
    },
    totalRevenue: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
  }, { timestamps: true });
  schema.index({ domain: 1 }, { unique: true });
  schema.index({ status: 1 });
  University = mongoose.model('University', schema);
}

// GET /api/universities — list all (public, paginated)
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', status } = req.query;
    const query = {};
    if (search) query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { code: { $regex: search, $options: 'i' } },
      { domain: { $regex: search, $options: 'i' } },
    ];
    if (status) query.status = status;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [universities, total] = await Promise.all([
      University.find(query).sort({ verified: -1, studentCount: -1 }).skip(skip).limit(parseInt(limit)),
      University.countDocuments(query),
    ]);
    res.json({ success: true, universities, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/universities/:id — single university
router.get('/:id', async (req, res) => {
  try {
    const uni = await University.findById(req.params.id);
    if (!uni) return res.status(404).json({ success: false, message: 'University not found' });
    res.json({ success: true, university: uni });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/universities/domain/:domain — lookup by email domain
router.get('/domain/:domain', async (req, res) => {
  try {
    const uni = await University.findOne({ domain: req.params.domain.toLowerCase(), status: 'active' });
    if (!uni) return res.json({ success: true, university: null, access: 'none' });
    res.json({ success: true, university: uni, access: uni.settings.freeAccessForStudents ? 'free' : 'paid' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/universities — add university (admin only)
router.post('/', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { name, code, domain, country, settings } = req.body;
    if (!name || !code || !domain) return res.status(400).json({ success: false, message: 'name, code and domain are required' });
    const existing = await University.findOne({ domain: domain.toLowerCase() });
    if (existing) return res.status(409).json({ success: false, message: 'University with this domain already exists' });
    const uni = await University.create({ name, code, domain, country, settings });
    res.status(201).json({ success: true, university: uni });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/universities/:id — update (admin only)
router.put('/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const uni = await University.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true });
    if (!uni) return res.status(404).json({ success: false, message: 'University not found' });
    res.json({ success: true, university: uni });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/universities/:id — delete (admin only)
router.delete('/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const uni = await University.findByIdAndDelete(req.params.id);
    if (!uni) return res.status(404).json({ success: false, message: 'University not found' });
    res.json({ success: true, message: 'University deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/universities/:id/verify — verify a university (admin only)
router.post('/:id/verify', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const uni = await University.findByIdAndUpdate(req.params.id, { verified: true, status: 'active' }, { new: true });
    if (!uni) return res.status(404).json({ success: false, message: 'University not found' });
    res.json({ success: true, university: uni });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
