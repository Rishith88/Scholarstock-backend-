const mongoose = require('mongoose');

const competitionRegistrationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  competitionId: { type: String, required: true },
  competitionName: { type: String, required: true },
  teamName: { type: String, default: '' },
  teammates: [{ type: String }],
  status: { type: String, enum: ['registered', 'submitted', 'disqualified', 'winner'], default: 'registered' }
}, { timestamps: true });

competitionRegistrationSchema.index({ userId: 1 });
competitionRegistrationSchema.index({ competitionId: 1 });

module.exports = mongoose.model('CompetitionRegistration', competitionRegistrationSchema);
