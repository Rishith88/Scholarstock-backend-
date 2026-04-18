const express = require('express');
const router = express.Router();
const Flashcard = require('../models/Flashcard');
const FlashcardDeck = require('../models/FlashcardDeck');
const { verifyToken } = require('../middleware/auth');

// ── SM-2 Algorithm ──
function sm2(card, quality) {
  // quality: 0-5 (0=blackout, 3=correct with effort, 5=perfect)
  let { easeFactor, interval, repetitions } = card;

  if (quality >= 3) {
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 6;
    else interval = Math.round(interval * easeFactor);
    repetitions += 1;
  } else {
    repetitions = 0;
    interval = 1;
  }

  easeFactor = Math.max(1.3, easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + interval);

  return { easeFactor, interval, repetitions, dueDate };
}

// GET /api/flashcards/decks — list user's decks
router.get('/decks', verifyToken, async (req, res) => {
  try {
    const decks = await FlashcardDeck.find({ userId: req.userId }).sort({ updatedAt: -1 });

    // Attach due counts
    const deckIds = decks.map(d => d._id);
    const now = new Date();
    const dueCounts = await Flashcard.aggregate([
      { $match: { userId: req.userId, deckId: { $in: deckIds }, dueDate: { $lte: now } } },
      { $group: { _id: '$deckId', count: { $sum: 1 } } },
    ]);
    const dueMap = {};
    dueCounts.forEach(d => { dueMap[d._id.toString()] = d.count; });

    const result = decks.map(d => ({
      ...d.toObject(),
      dueCount: dueMap[d._id.toString()] || 0,
    }));

    res.json({ success: true, decks: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/flashcards/decks — create deck
router.post('/decks', verifyToken, async (req, res) => {
  try {
    const { name, description, subject, examCategory, color, emoji } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Deck name required' });
    const deck = await FlashcardDeck.create({ userId: req.userId, name, description, subject, examCategory, color: color || '#3b82f6', emoji: emoji || '📚' });
    res.status(201).json({ success: true, deck });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/flashcards/decks/:id — update deck
router.put('/decks/:id', verifyToken, async (req, res) => {
  try {
    const deck = await FlashcardDeck.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: req.body },
      { new: true }
    );
    if (!deck) return res.status(404).json({ success: false, message: 'Deck not found' });
    res.json({ success: true, deck });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/flashcards/decks/:id — delete deck + all cards
router.delete('/decks/:id', verifyToken, async (req, res) => {
  try {
    const deck = await FlashcardDeck.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!deck) return res.status(404).json({ success: false, message: 'Deck not found' });
    await Flashcard.deleteMany({ deckId: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/flashcards/decks/:id/cards — get all cards in deck
router.get('/decks/:id/cards', verifyToken, async (req, res) => {
  try {
    const deck = await FlashcardDeck.findOne({ _id: req.params.id, userId: req.userId });
    if (!deck) return res.status(404).json({ success: false, message: 'Deck not found' });
    const cards = await Flashcard.find({ deckId: req.params.id, userId: req.userId }).sort({ dueDate: 1 });
    res.json({ success: true, cards, deck });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/flashcards/due — get all due cards across all decks
router.get('/due', verifyToken, async (req, res) => {
  try {
    const { deckId } = req.query;
    const query = { userId: req.userId, dueDate: { $lte: new Date() } };
    if (deckId) query.deckId = deckId;
    const cards = await Flashcard.find(query).sort({ dueDate: 1 }).limit(100);
    res.json({ success: true, cards, count: cards.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/flashcards/decks/:id/cards — add card to deck
router.post('/decks/:id/cards', verifyToken, async (req, res) => {
  try {
    const deck = await FlashcardDeck.findOne({ _id: req.params.id, userId: req.userId });
    if (!deck) return res.status(404).json({ success: false, message: 'Deck not found' });

    const { front, back, hint, tags } = req.body;
    if (!front || !back) return res.status(400).json({ success: false, message: 'Front and back required' });

    const card = await Flashcard.create({ userId: req.userId, deckId: req.params.id, front, back, hint, tags });
    await FlashcardDeck.findByIdAndUpdate(req.params.id, { $inc: { cardCount: 1 } });
    res.status(201).json({ success: true, card });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/flashcards/bulk — bulk add cards to deck
router.post('/bulk', verifyToken, async (req, res) => {
  try {
    const { deckId, cards } = req.body;
    if (!deckId || !Array.isArray(cards) || cards.length === 0) {
      return res.status(400).json({ success: false, message: 'deckId and cards array required' });
    }
    const deck = await FlashcardDeck.findOne({ _id: deckId, userId: req.userId });
    if (!deck) return res.status(404).json({ success: false, message: 'Deck not found' });

    const toInsert = cards.filter(c => c.front && c.back).map(c => ({
      userId: req.userId, deckId, front: c.front, back: c.back, hint: c.hint || '', tags: c.tags || [],
    }));

    const inserted = await Flashcard.insertMany(toInsert);
    await FlashcardDeck.findByIdAndUpdate(deckId, { $inc: { cardCount: inserted.length } });
    res.json({ success: true, count: inserted.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/flashcards/:id — update card
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const card = await Flashcard.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: { front: req.body.front, back: req.body.back, hint: req.body.hint, tags: req.body.tags } },
      { new: true }
    );
    if (!card) return res.status(404).json({ success: false, message: 'Card not found' });
    res.json({ success: true, card });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/flashcards/:id — delete card
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const card = await Flashcard.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!card) return res.status(404).json({ success: false, message: 'Card not found' });
    await FlashcardDeck.findByIdAndUpdate(card.deckId, { $inc: { cardCount: -1 } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/flashcards/:id/review — submit review result (SM-2)
router.post('/:id/review', verifyToken, async (req, res) => {
  try {
    const { quality } = req.body; // 0-5
    if (quality === undefined || quality < 0 || quality > 5) {
      return res.status(400).json({ success: false, message: 'quality must be 0-5' });
    }

    const card = await Flashcard.findOne({ _id: req.params.id, userId: req.userId });
    if (!card) return res.status(404).json({ success: false, message: 'Card not found' });

    const updated = sm2(card, quality);
    card.easeFactor = updated.easeFactor;
    card.interval = updated.interval;
    card.repetitions = updated.repetitions;
    card.dueDate = updated.dueDate;
    card.lastReviewed = new Date();
    card.totalReviews += 1;
    if (quality >= 3) card.correctCount += 1;
    else card.incorrectCount += 1;

    await card.save();
    await FlashcardDeck.findByIdAndUpdate(card.deckId, { lastStudied: new Date() });

    res.json({ success: true, card, nextReview: updated.dueDate, interval: updated.interval });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/flashcards/stats — overall stats
router.get('/stats', verifyToken, async (req, res) => {
  try {
    const now = new Date();
    const [totalCards, dueCards, deckCount, reviewStats] = await Promise.all([
      Flashcard.countDocuments({ userId: req.userId }),
      Flashcard.countDocuments({ userId: req.userId, dueDate: { $lte: now } }),
      FlashcardDeck.countDocuments({ userId: req.userId }),
      Flashcard.aggregate([
        { $match: { userId: req.userId, totalReviews: { $gt: 0 } } },
        { $group: { _id: null, totalReviews: { $sum: '$totalReviews' }, totalCorrect: { $sum: '$correctCount' } } },
      ]),
    ]);

    const stats = reviewStats[0] || { totalReviews: 0, totalCorrect: 0 };
    const accuracy = stats.totalReviews > 0 ? Math.round((stats.totalCorrect / stats.totalReviews) * 100) : 0;

    res.json({ success: true, stats: { totalCards, dueCards, deckCount, totalReviews: stats.totalReviews, accuracy } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
