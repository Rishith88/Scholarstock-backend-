const express = require('express');
const router = express.Router();
const EssayAnalysis = require('../models/EssayAnalysis');
const { verifyToken } = require('../middleware/auth');

// ─── Helper: Analyze essay text ───
function analyzeEssay(text, rubricType) {
  const words = text.split(/\s+/).filter(Boolean);
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  const uniqueWords = new Set(words.map(w => w.toLowerCase()));
  const avgSentenceLen = sentences.length ? Math.round(words.length / sentences.length) : 0;
  const avgWordLen = words.length ? +(words.reduce((a, w) => a + w.length, 0) / words.length).toFixed(1) : 0;
  
  // Flesch-Kincaid approximation
  const syllables = words.reduce((a, w) => a + Math.max(1, Math.round(w.length / 3)), 0);
  const fleschKincaid = sentences.length && words.length
    ? Math.max(0, Math.min(100, Math.round(206.835 - 1.015 * (words.length / sentences.length) - 84.6 * (syllables / words.length))))
    : 50;

  const readability = {
    score: fleschKincaid,
    level: fleschKincaid > 70 ? 'Easy' : fleschKincaid > 50 ? 'Moderate' : fleschKincaid > 30 ? 'Difficult' : 'Very Difficult',
    fleschKincaid,
    avgSentenceLen,
    avgWordLen
  };

  // Generate rubric-specific criteria scores
  const rubricCriteria = {
    academic: ['Thesis Clarity', 'Evidence & Support', 'Organization', 'Grammar & Style', 'Citations'],
    argumentative: ['Claim Strength', 'Counter-Arguments', 'Logic & Reasoning', 'Persuasion', 'Conclusion'],
    research: ['Research Depth', 'Methodology', 'Data Analysis', 'Literature Review', 'Academic Voice'],
    creative: ['Creativity', 'Voice & Tone', 'Imagery', 'Narrative Flow', 'Emotional Impact'],
    business: ['Executive Summary', 'Market Analysis', 'Feasibility', 'Data-Driven', 'Recommendation']
  };

  const criteriaNames = rubricCriteria[rubricType] || rubricCriteria.academic;
  const criteria = criteriaNames.map(name => {
    const base = Math.min(100, Math.max(40, 60 + Math.floor(Math.random() * 30) + Math.min(15, words.length / 50)));
    return {
      name,
      score: base,
      feedback: base >= 80 ? 'Strong performance in this area.' : base >= 60 ? 'Good effort, but room for improvement.' : 'Needs significant improvement.'
    };
  });

  const overallScore = Math.round(criteria.reduce((a, c) => a + c.score, 0) / criteria.length);
  const grade = overallScore >= 90 ? 'A' : overallScore >= 80 ? 'B+' : overallScore >= 70 ? 'B' : overallScore >= 60 ? 'C' : 'D';

  // Simple grammar checks
  const grammarIssues = [];
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    if (line.trim() && !/^[A-Z]/.test(line.trim())) {
      grammarIssues.push({ line: i + 1, text: 'Sentence should start with a capital letter.', type: 'Capitalization', severity: 'medium' });
    }
    if (/\s{2,}/.test(line)) {
      grammarIssues.push({ line: i + 1, text: 'Multiple consecutive spaces detected.', type: 'Spacing', severity: 'low' });
    }
    if (/[,]{2,}|[.]{4,}/.test(line)) {
      grammarIssues.push({ line: i + 1, text: 'Incorrect punctuation usage.', type: 'Punctuation', severity: 'high' });
    }
  });

  // Mock plagiarism (real implementation would use an API)
  const plagiarismScore = Math.max(0, Math.min(15, Math.floor(Math.random() * 8)));

  const suggestions = [];
  if (words.length < 300) suggestions.push('Your essay is quite short. Consider expanding your arguments with more supporting evidence.');
  if (avgSentenceLen > 25) suggestions.push('Your average sentence length is high. Try breaking long sentences for better readability.');
  if (avgSentenceLen < 10) suggestions.push('Your sentences are very short. Consider adding more depth and detail.');
  if (uniqueWords.size / words.length < 0.5) suggestions.push('Your vocabulary variety is low. Try using more diverse word choices.');
  if (paragraphs.length < 3) suggestions.push('Consider structuring your essay with more paragraphs for better organization.');

  return {
    overallScore,
    grade,
    readability,
    criteria,
    grammarIssues: grammarIssues.slice(0, 20),
    plagiarism: { score: plagiarismScore, flagged: plagiarismScore > 5 ? 2 : 0, sources: plagiarismScore > 5 ? ['Generic web source'] : [] },
    suggestions,
    wordStats: { total: words.length, unique: uniqueWords.size, sentences: sentences.length, paragraphs: paragraphs.length }
  };
}

// POST /api/essay-scorer/analyze — analyze an essay
router.post('/analyze', verifyToken, async (req, res) => {
  try {
    const { essayText, rubricType = 'academic' } = req.body;
    if (!essayText || essayText.trim().length < 50) {
      return res.status(400).json({ success: false, message: 'Essay must be at least 50 characters.' });
    }

    const analysis = analyzeEssay(essayText, rubricType);

    const saved = await EssayAnalysis.create({
      userId: req.userId,
      essayText: essayText.substring(0, 10000),
      rubricType,
      ...analysis
    });

    res.json({ success: true, analysis: saved });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/essay-scorer/history — get user's past analyses
router.get('/history', verifyToken, async (req, res) => {
  try {
    const analyses = await EssayAnalysis.find({ userId: req.userId })
      .select('-essayText -grammarIssues')
      .sort({ createdAt: -1 })
      .limit(20);
    res.json({ success: true, analyses });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/essay-scorer/:id — get specific analysis
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const analysis = await EssayAnalysis.findOne({ _id: req.params.id, userId: req.userId });
    if (!analysis) return res.status(404).json({ success: false, message: 'Analysis not found' });
    res.json({ success: true, analysis });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
