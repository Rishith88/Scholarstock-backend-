const express = require('express');
const router = express.Router();
const { verifyToken, optionalAuth } = require('../middleware/auth');

// POST /api/doubt/solve - AI Doubt Solver endpoint
router.post('/solve', optionalAuth, async (req, res) => {
  try {
    const { question, examCategory, subcategory, material } = req.body;
    
    if (!question || typeof question !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Question is required'
      });
    }

    // Generate contextual response based on exam category and subcategory
    const answer = generateDoubtResponse(question, examCategory, subcategory, material);

    res.json({
      success: true,
      answer: JSON.stringify(answer)
    });
  } catch (error) {
    console.error('Doubt solver error:', error);
    res.status(500).json({
      success: false,
      message: 'Doubt solver temporarily unavailable'
    });
  }
});

function generateDoubtResponse(question, examCategory, subcategory, material) {
  const lowerQuestion = question.toLowerCase();
  
  // Check for common question patterns
  const isConceptual = lowerQuestion.includes('what is') || lowerQuestion.includes('define') || lowerQuestion.includes('explain');
  const isNumerical = /\d+/.test(question) && (lowerQuestion.includes('find') || lowerQuestion.includes('calculate') || lowerQuestion.includes('solve'));
  const isFormula = lowerQuestion.includes('formula') || lowerQuestion.includes('equation');
  
  const response = {
    explanation: '',
    steps: [],
    tip: ''
  };

  // Generate contextual explanation
  if (examCategory && subcategory) {
    response.explanation = `Based on your question about ${subcategory} in ${examCategory}:\n\n${question}\n\n`;
  } else {
    response.explanation = `Regarding your question:\n\n${question}\n\n`;
  }

  if (isNumerical) {
    response.explanation += "This appears to be a numerical problem. Here's how to approach it:";
    response.steps = [
      "Identify the given values and what needs to be found",
      "Recall the relevant formula or concept",
      "Substitute the values carefully",
      "Solve step by step, checking units at each stage",
      "Verify your answer makes physical/mathematical sense"
    ];
  } else if (isConceptual) {
    response.explanation += "This is a conceptual question. Understanding the fundamentals is key:";
    response.steps = [
      "Break down the concept into simpler parts",
      "Relate it to basic principles you already know",
      "Look for real-world examples or analogies",
      "Create a mental model or diagram if helpful",
      "Practice explaining it in your own words"
    ];
  } else if (isFormula) {
    response.explanation += "For formula-based questions:";
    response.steps = [
      "Write down the formula clearly",
      "Understand what each variable represents",
      "Check the units on both sides",
      "Memorize the formula through practice problems",
      "Learn the derivation for deeper understanding"
    ];
  } else {
    response.explanation += "Here's a structured approach to solve this:";
    response.steps = [
      "Read the question carefully and identify key information",
      "Determine the topic/concept being tested",
      "Recall relevant theory, formulas, or methods",
      "Plan your solution approach before starting",
      "Execute step-by-step with clear reasoning"
    ];
  }

  // Add exam-specific tip
  if (examCategory) {
    const tips = {
      'JEE': 'Focus on time management. JEE problems often test multiple concepts together.',
      'NEET': 'Remember: NEET emphasizes NCERT. Ensure your basics are strong.',
      'UPSC': 'Think conceptually. UPSC tests application, not just memorization.',
      'CAT': 'Look for shortcuts and patterns. Time is crucial in CAT.',
      'GATE': 'Practice previous year questions. GATE has a predictable pattern.'
    };
    response.tip = tips[examCategory] || 'Practice regularly and review mistakes to improve.';
  } else {
    response.tip = 'Consistent practice and understanding concepts deeply leads to success.';
  }

  return response;
}

module.exports = router;
