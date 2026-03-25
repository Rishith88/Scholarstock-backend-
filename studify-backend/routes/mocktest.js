// routes/mocktest.js
// Mount in server.js: app.use('/api/mocktest', require('./routes/mocktest'));
// Uses same GEMINI_API_KEY as your chatbot — no new keys needed!

const express = require('express');
const router  = express.Router();
const axios   = require('axios');

// POST /api/mocktest/generate
// Body: { category, subcategory, qCount, difficulty, qType }
router.post('/generate', async (req, res) => {
  try {
    const { category, subcategory, qCount = 10, difficulty = 'medium', qType = 'mcq' } = req.body;

    if (!category || !subcategory) {
      return res.status(400).json({ success: false, message: 'Category and subcategory required' });
    }

    // Check API key exists
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('[MOCKTEST] GEMINI_API_KEY is not set in environment variables');
      return res.status(500).json({ success: false, message: 'Gemini API key not configured on server' });
    }

    console.log('[MOCKTEST] Generating', qCount, 'questions for', category, '-', subcategory);

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

Respond ONLY with a valid JSON array, no markdown, no extra text, no code fences:
[
  {
    "question": "Question text here?",
    "type": "mcq",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct": 0,
    "explanation": "Brief explanation why this is correct"
  }
]
For true/false: use type "tf", options ["True","False"], correct is 0 for True or 1 for False.`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4000,
        }
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );

    // Extract text from Gemini response
    const raw = response.data.candidates[0].content.parts[0].text.trim();

    // Strip any accidental markdown fences
    const clean = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const questions = JSON.parse(clean);

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(500).json({ success: false, message: 'Invalid questions generated' });
    }

    console.log('[MOCKTEST] Successfully generated', questions.length, 'questions');
    res.json({ success: true, questions });

  } catch (err) {
    if (err.response) {
      console.error('[MOCKTEST] Gemini API error:', err.response.status, JSON.stringify(err.response.data));
      return res.status(500).json({
        success: false,
        message: `Gemini API error ${err.response.status}: ${err.response.data?.error?.message || 'Unknown error'}`
      });
    }
    console.error('[MOCKTEST] Error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

