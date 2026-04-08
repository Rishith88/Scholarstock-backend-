const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  materialId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Material',
    default: null
  },
  rentalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Rental',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  plan: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'completed'
  },
  paymentMethod: {
    type: String,
    enum: ['razorpay', 'cash', 'demo'],
    default: 'demo'
  },
  paymentId: {
    type: String,
    default: null
  }
}, { timestamps: true });

transactionSchema.index({ userId: 1, status: 1 });
transactionSchema.index({ rentalId: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
