const mongoose = require('mongoose');

const DraftMaterialSchema = new mongoose.Schema({
  title: String,
  category: String,
  subcategory: String,
  difficulty: String,
  theory: String,
  formulas: [String],
  solvedExamples: [{
    question: String,
    solution: String
  }],
  mcqs: [{
    q: String,
    options: [String],
    answer: String,
    explanation: String
  }],
  syllabusMap: String,
  deepDive: String,
  memoryTricks: String,
  commonMistakes: String,
  prevYearQuestions: [{
    question: String,
    answer: String,
    marks: String
  }],
  diagramUrl: String, // NEW: For AI generated diagrams
  auditReport: String, // NEW: For the AI Auditor feedback
  topicsCovered: [String],
  suggestedPrice: Number,
  pages: Number,
  approved: { type: Boolean, default: false },
  batchId: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('DraftMaterial', DraftMaterialSchema);
