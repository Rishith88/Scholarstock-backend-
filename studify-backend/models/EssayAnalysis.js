const mongoose = require('mongoose');

const essayAnalysisSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  essayText: { type: String, required: true },
  rubricType: { type: String, enum: ['academic', 'argumentative', 'research', 'creative', 'business'], default: 'academic' },
  overallScore: { type: Number, min: 0, max: 100 },
  grade: { type: String },
  readability: {
    score: Number,
    level: String,
    fleschKincaid: Number,
    avgSentenceLen: Number,
    avgWordLen: Number
  },
  plagiarism: {
    score: Number,
    flagged: Number,
    sources: [String]
  },
  criteria: [{
    name: String,
    score: Number,
    feedback: String
  }],
  grammarIssues: [{
    line: Number,
    text: String,
    type: String,
    severity: { type: String, enum: ['high', 'medium', 'low'] }
  }],
  suggestions: [String],
  wordStats: {
    total: Number,
    unique: Number,
    sentences: Number,
    paragraphs: Number
  }
}, { timestamps: true });

essayAnalysisSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('EssayAnalysis', essayAnalysisSchema);
