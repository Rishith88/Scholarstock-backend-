// routes/doubt.js
// Mount in server.js: app.use('/api/doubt', require('./routes/doubt'));
// Uses same GEMINI_API_KEY as chatbot and mocktest

const express = require('express');
const router  = express.Router(); 
const axios   = require('axios');

// POST /api/doubt/solve
// Body: { question, examCategory, subcategory, material }
router.post('/solve', async (req, res) => {
  try {
    const { question, examCategory, subcategory, material } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({ success: false, message: 'Question is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ success: false, message: 'Gemini API key not configured' });
    }

    const examCtx = examCategory || 'competitive exams';
    const subCtx  = subcategory  || 'general topics';

    const prompt = `You are an expert AI tutor for ${examCtx} — specifically ${subCtx}.
A student needs help understanding a concept or solving a problem.
${material ? `Context: The student is reading "${material}".` : ''}

Student question: ${question}

Respond ONLY with valid JSON, no markdown, no extra text:
{
  "explanation": "Clear main explanation in 2-4 sentences",
  "steps": ["Step 1: ...", "Step 2: ...", "Step 3: ..."],
  "relatedTopics": ["Topic 1", "Topic 2", "Topic 3"],
  "tip": "One quick exam tip"
}

Rules:
- For math/physics/chemistry: show actual formulas and calculations in steps
- relatedTopics: exactly 3 short topic names to study next
- tip: one practical exam tip, max 1 sentence
- Keep everything concise and exam-focused`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 2048 }
      },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const raw = response.data.candidates[0].content.parts[0].text.trim();
    const startIdx = raw.indexOf('{');
    const endIdx   = raw.lastIndexOf('}');
    if (startIdx === -1 || endIdx === -1) {
      return res.status(500).json({ success: false, message: 'Invalid AI response' });
    }

    const answer = JSON.parse(raw.substring(startIdx, endIdx + 1));
    console.log('[DOUBT] Solved for', examCtx, '-', subCtx);
    res.json({ success: true, answer });

  } catch (err) {
    if (err.response) {
      console.error('[DOUBT] Gemini error:', err.response.status);
      return res.status(500).json({ success: false, message: `AI error: ${err.response.data?.error?.message || 'Unknown'}` });
    }
    console.error('[DOUBT] Error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
