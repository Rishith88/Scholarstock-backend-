const mongoose = require('mongoose');

const freelanceGigSchema = new mongoose.Schema({
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sellerName: { type: String, required: true },
  sellerUni: { type: String, default: '' },
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, enum: ['Graphics', 'Coding', 'Writing', 'Video', 'Tutoring', 'Engineering', 'Marketing', 'Other'], required: true },
  price: { type: Number, required: true },
  delivery: { type: String, required: true },
  tags: [String],
  rating: { type: Number, default: 0 },
  reviews: { type: Number, default: 0 },
  orders: { type: Number, default: 0 },
  featured: { type: Boolean, default: false },
  status: { type: String, enum: ['active', 'paused', 'deleted'], default: 'active' }
}, { timestamps: true });

freelanceGigSchema.index({ category: 1, status: 1 });
freelanceGigSchema.index({ sellerId: 1 });
freelanceGigSchema.index({ title: 'text', tags: 'text' });

module.exports = mongoose.model('FreelanceGig', freelanceGigSchema);
