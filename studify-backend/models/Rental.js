// studify-backend/models/Rental.js
const mongoose = require('mongoose');

const rentalSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // ── RENTAL TYPE ──
  rentalType: {
    type: String,
    enum: ['material', 'subcategory'],
    default: 'material'
  },

  // For material rentals
  materialId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Material',
    default: null
  },

  // For subcategory rentals
  examCategory: { type: String, default: null },
  subcategory: { type: String, default: null },

  plan: {
    type: String,
    required: true,
    enum: ['day', 'week', 'month', 'bundle'],
    default: 'month'
  },
  pricePaid: { type: Number, required: true, min: 0 },
  startDate: { type: Date, default: Date.now },
  expiryDate: { type: Date, required: true },
  status: {
    type: String,
    enum: ['active', 'expired', 'cancelled'],
    default: 'active'
  },
  paymentMethod: {
    type: String,
    enum: ['razorpay', 'cash', 'demo'],
    default: 'demo'
  },
  paymentId: { type: String },
  accessCount: { type: Number, default: 0 },
  lastAccessed: { type: Date }
}, { timestamps: true });

rentalSchema.index({ userId: 1, materialId: 1, status: 1 });
rentalSchema.index({ userId: 1, examCategory: 1, subcategory: 1, status: 1 });
rentalSchema.index({ expiryDate: 1, status: 1 });

rentalSchema.methods.isValid = function() {
  return this.status === 'active' && this.expiryDate > new Date();
};

rentalSchema.methods.recordAccess = function() {
  this.accessCount += 1;
  this.lastAccessed = new Date();
  return this.save();
};

rentalSchema.statics.expireOldRentals = async function() {
  return this.updateMany(
    { status: 'active', expiryDate: { $lt: new Date() } },
    { $set: { status: 'expired' } }
  );
};

module.exports = mongoose.model('Rental', rentalSchema);
