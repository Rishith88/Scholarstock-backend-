const mongoose = require('mongoose');

const wellnessLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, default: Date.now },
  mood: { type: Number, min: 0, max: 5 },
  studyHours: { type: Number, default: 0 },
  sleepHours: { type: Number, default: 0 },
  journal: { type: String, default: '' },
  meditationMinutes: { type: Number, default: 0 },
  burnoutScore: { type: Number, min: 0, max: 100, default: 0 }
}, { timestamps: true });

wellnessLogSchema.index({ userId: 1, date: -1 });

module.exports = mongoose.model('WellnessLog', wellnessLogSchema);
