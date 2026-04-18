const mongoose = require('mongoose');

const flashcardSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  deckId: { type: mongoose.Schema.Types.ObjectId, ref: 'FlashcardDeck', required: true, index: true },
  front: { type: String, required: true, trim: true, maxlength: 1000 },
  back: { type: String, required: true, trim: true, maxlength: 2000 },
  hint: { type: String, default: '', maxlength: 500 },
  tags: [{ type: String, trim: true }],

  // SM-2 Spaced Repetition fields
  easeFactor: { type: Number, default: 2.5 },       // EF — starts at 2.5
  interval: { type: Number, default: 1 },            // days until next review
  repetitions: { type: Number, default: 0 },         // times reviewed successfully
  dueDate: { type: Date, default: Date.now },         // next review date
  lastReviewed: { type: Date, default: null },

  // Stats
  totalReviews: { type: Number, default: 0 },
  correctCount: { type: Number, default: 0 },
  incorrectCount: { type: Number, default: 0 },
}, { timestamps: true });

flashcardSchema.index({ userId: 1, dueDate: 1 });
flashcardSchema.index({ deckId: 1 });

module.exports = mongoose.model('Flashcard', flashcardSchema);
