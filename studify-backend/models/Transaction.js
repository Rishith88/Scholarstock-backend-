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
    default: null
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  plan: {
    type: String,
    enum: ['day', 'week', 'month', 'bundle'],
    default: 'day'
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['razorpay', 'cash', 'demo'],
    default: 'demo'
  },
  paymentId: {
    type: String
  },
  orderId: {
    type: String
  },
  paymentSignature: {
    type: String
  },
  failureReason: {
    type: String
  },
  refundId: {
    type: String
  },
  refundAmount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for analytics and reporting
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ userId: 1, createdAt: -1 });

// Calculate total revenue
transactionSchema.statics.getTotalRevenue = async function() {
  const result = await this.aggregate([
    {
      $match: { status: 'completed' }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ]);
  
  return result.length > 0 ? result[0] : { total: 0, count: 0 };
};

// Get revenue by date range
transactionSchema.statics.getRevenueByDateRange = async function(startDate, endDate) {
  return await this.aggregate([
    {
      $match: {
        status: 'completed',
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ]);
};

module.exports = mongoose.model('Transaction', transactionSchema);
