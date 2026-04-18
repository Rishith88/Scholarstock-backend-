const mongoose = require('mongoose');

const deckSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, default: '', maxlength: 500 },
  subject: { type: String, default: '', trim: true },
  examCategory: { type: String, default: '' },
  color: { type: String, default: '#3b82f6' },
  emoji: { type: String, default: '📚' },
  cardCount: { type: Number, default: 0 },
  dueCount: { type: Number, default: 0 },
  isPublic: { type: Boolean, default: false },
  lastStudied: { type: Date, default: null },
}, { timestamps: true });

deckSchema.index({ userId: 1, updatedAt: -1 });

module.exports = mongoose.model('FlashcardDeck', deckSchema);
