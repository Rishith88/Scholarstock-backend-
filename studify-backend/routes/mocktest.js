// routes/mocktest.js
// Mount in server.js: app.use('/api/mocktest', require('./routes/mocktest'));
// This proxies Claude API so your key stays on the server, not exposed in frontend

const express = require('express');
const router  = express.Router();
const axios   = require('axios');
const authMiddleware = require('../middleware/auth');

// Apply auth — only logged-in users can generate tests
router.use(authMiddleware);

// POST /api/mocktest/generate
// Body: { category, subcategory, qCount, difficulty, qType }
router.post('/generate', async (req, res) => {
  try {
    const { category, subcategory, qCount = 10, difficulty = 'medium', qType = 'mcq' } = req.body;

    if (!category || !subcategory) {
      return res.status(400).json({ success: false, message: 'Category and subcategory required' });
    }

    const prompt = `You are an expert exam question generator for ${category} — ${subcategory}.

Generate exactly ${qCount} ${difficulty} difficulty ${
  qType === 'mcq' ? 'multiple choice' :
  qType === 'truefalse' ? 'true/false' :
  'mixed (MCQ and true/false)'
} questions.

Rules:
- Questions must be specific to ${subcategory} in ${category}
- Each MCQ must have exactly 4 options (A, B, C, D)
- True/False questions must have exactly 2 options: "True" and "False"
- Include a brief explanation for each correct answer
- Vary question difficulty as ${difficulty}

Respond ONLY with a valid JSON array, no markdown, no extra text:
[
  {
    "question": "Question text here?",
    "type": "mcq",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct": 0,
    "explanation": "Brief explanation why this is correct"
  }
]
For true/false: type "tf", options ["True","False"], correct 0 or 1.`;

    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-sonnet-4-5',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.CLAUDE_MOCK_API_KEY,
          'anthropic-version': '2023-06-01'
        }
      }
    );

    const raw   = response.data.content[0].text.trim();
    const clean = raw.replace(/^```json\s*/,'').replace(/^```\s*/,'').replace(/\s*```$/,'');
    const questions = JSON.parse(clean);

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(500).json({ success: false, message: 'Invalid questions generated' });
    }

    res.json({ success: true, questions });

  } catch (err) {
    console.error('[MOCKTEST] Error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
