const express = require('express');
const router = express.Router();
const { verifyToken, optionalAuth } = require('../middleware/auth');

// POST /api/mocktest/generate - Generate mock test questions
router.post('/generate', optionalAuth, async (req, res) => {
  try {
    const { category, subcategory, qCount, difficulty, qType } = req.body;

    if (!category || !subcategory || !qCount) {
      return res.status(400).json({
        success: false,
        message: 'category, subcategory, and qCount are required'
      });
    }

    const questions = generateMockQuestions({
      category,
      subcategory,
      qCount: Math.min(parseInt(qCount) || 10, 30), // Max 30 questions
      difficulty: difficulty || 'medium',
      qType: qType || 'mcq'
    });

    res.json({
      success: true,
      questions,
      meta: {
        category,
        subcategory,
        totalQuestions: questions.length,
        difficulty,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Mock test generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate mock test'
    });
  }
});

function generateMockQuestions({ category, subcategory, qCount, difficulty, qType }) {
  const questions = [];
  
  // Question templates by category
  const templates = getQuestionTemplates(category, subcategory);
  
  for (let i = 0; i < qCount; i++) {
    const template = templates[i % templates.length];
    const question = createQuestionFromTemplate(template, i + 1, difficulty, qType);
    questions.push(question);
  }
  
  return questions;
}

function getQuestionTemplates(category, subcategory) {
  // Default templates for any category
  const defaultTemplates = [
    {
      concept: 'Fundamental Concept',
      question: 'Which of the following best describes the core principle?',
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correct: 0,
      explanation: 'The correct answer is based on fundamental principles of the subject.'
    },
    {
      concept: 'Application Problem',
      question: 'In a given scenario, what would be the most appropriate approach?',
      options: ['Approach 1', 'Approach 2', 'Approach 3', 'Approach 4'],
      correct: 1,
      explanation: 'This approach is most suitable given the constraints and requirements.'
    },
    {
      concept: 'Numerical Problem',
      question: 'Calculate the value based on given parameters.',
      options: ['10', '20', '30', '40'],
      correct: 2,
      explanation: 'Using the formula and substituting values gives us 30.'
    },
    {
      concept: 'Conceptual Understanding',
      question: 'Which statement is TRUE regarding this topic?',
      options: ['Statement A', 'Statement B', 'Statement C', 'Statement D'],
      correct: 3,
      explanation: 'Statement D is correct based on established theory.'
    },
    {
      concept: 'Analytical Reasoning',
      question: 'Analyze the following and select the correct conclusion.',
      options: ['Conclusion 1', 'Conclusion 2', 'Conclusion 3', 'Conclusion 4'],
      correct: 0,
      explanation: 'The analysis leads to conclusion 1 as the most logical outcome.'
    }
  ];

  // Category-specific templates
  const categoryTemplates = {
    'JEE': [
      {
        concept: 'Physics - Mechanics',
        question: 'A particle moves with velocity v = 2t i + 3t² j. Find acceleration at t=1s.',
        options: ['2 i + 6 j', '2 i + 3 j', '0 i + 6 j', '2 i + 0 j'],
        correct: 0,
        explanation: 'Acceleration is dv/dt = 2 i + 6t j. At t=1, a = 2 i + 6 j.'
      },
      {
        concept: 'Chemistry - Organic',
        question: 'Which reagent converts alcohol to alkyl halide?',
        options: ['NaOH', 'PCl₅', 'KMnO₄', 'H₂SO₄'],
        correct: 1,
        explanation: 'PCl₅ (phosphorus pentachloride) converts -OH to -Cl.'
      },
      {
        concept: 'Mathematics - Calculus',
        question: '∫(2x + 3)dx = ?',
        options: ['x² + 3x + C', '2x² + 3x + C', 'x² + C', '2 + C'],
        correct: 0,
        explanation: 'Using power rule: ∫2x dx = x² and ∫3 dx = 3x. So x² + 3x + C.'
      }
    ],
    'NEET': [
      {
        concept: 'Biology - Cell Biology',
        question: 'Which organelle is called the powerhouse of the cell?',
        options: ['Nucleus', 'Mitochondria', 'Ribosome', 'Golgi body'],
        correct: 1,
        explanation: 'Mitochondria produce ATP through cellular respiration.'
      },
      {
        concept: 'Physics - Optics',
        question: 'The focal length of a convex lens is positive or negative?',
        options: ['Positive', 'Negative', 'Zero', 'Infinite'],
        correct: 0,
        explanation: 'By convention, convex lenses have positive focal length.'
      }
    ],
    'UPSC': [
      {
        concept: 'Indian Polity',
        question: 'Which article of the Constitution deals with Fundamental Rights?',
        options: ['Article 12-35', 'Article 36-51', 'Article 52-62', 'Article 74-75'],
        correct: 0,
        explanation: 'Part III (Articles 12-35) contains Fundamental Rights.'
      },
      {
        concept: 'Indian History',
        question: 'The Battle of Plassey was fought in which year?',
        options: ['1757', '1764', '1857', '1947'],
        correct: 0,
        explanation: 'The Battle of Plassey was fought on June 23, 1757.'
      }
    ]
  };

  return categoryTemplates[category] || defaultTemplates;
}

function createQuestionFromTemplate(template, qNum, difficulty, qType) {
  // Adjust difficulty by modifying the question
  let questionText = template.question;
  let options = [...template.options];
  let explanation = template.explanation;
  
  // Add difficulty indicator
  const difficultyPrefix = {
    'easy': '',
    'medium': '[Medium] ',
    'hard': '[Hard] ',
    'mixed': qNum % 2 === 0 ? '[Medium] ' : ''
  };
  
  questionText = difficultyPrefix[difficulty] + questionText;
  
  // For true/false questions
  if (qType === 'truefalse' || (qType === 'mixed' && qNum % 3 === 0)) {
    const isTrue = template.correct === 0;
    return {
      question: `True or False: ${questionText}`,
      type: 'tf',
      options: ['True', 'False'],
      correct: isTrue ? 0 : 1,
      explanation: template.explanation
    };
  }
  
  // Standard MCQ
  return {
    question: `Q${qNum}. ${questionText}`,
    type: 'mcq',
    options: options,
    correct: template.correct,
    explanation: explanation
  };
}

module.exports = router;
