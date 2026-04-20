const mongoose = require('mongoose');

const tutoringRequestSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  studentName: { type: String, required: true },
  subject: { type: String, required: true },
  topic: { type: String, required: true },
  details: { type: String, default: '' },
  budget: { type: Number, default: 0 },
  urgency: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  status: { type: String, enum: ['open', 'in-progress', 'completed', 'cancelled'], default: 'open' },
  bids: [{
    tutorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    tutorName: String,
    message: String,
    rate: Number,
    createdAt: { type: Date, default: Date.now }
  }],
  acceptedBid: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  sessionDate: { type: Date },
  rating: { type: Number, min: 1, max: 5 },
  review: { type: String }
}, { timestamps: true });

tutoringRequestSchema.index({ status: 1, createdAt: -1 });
tutoringRequestSchema.index({ studentId: 1 });

module.exports = mongoose.model('TutoringRequest', tutoringRequestSchema);
