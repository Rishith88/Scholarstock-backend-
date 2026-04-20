const mongoose = require('mongoose');

const scholarCoinSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  balance: { type: Number, default: 0 },
  totalEarned: { type: Number, default: 0 },
  totalSpent: { type: Number, default: 0 },
  streakDays: { type: Number, default: 0 },
  lastLoginDate: { type: Date },
  purchasedItems: [{ type: String }],
  transactions: [{
    type: { type: String, enum: ['earn', 'spend'] },
    amount: Number,
    action: String,
    icon: String,
    createdAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

scholarCoinSchema.index({ userId: 1 });
scholarCoinSchema.index({ balance: -1 });

module.exports = mongoose.model('ScholarCoin', scholarCoinSchema);
