// routes/doubt.js
// Primary: Cerebras (llama-3.3-70b) — 1M tokens/day free
// Fallback: Groq (llama-3.3-70b-versatile) — if Cerebras fails

const express = require('express');
const router  = express.Router();
const axios   = require('axios');

// ── Call AI with Cerebras primary, Groq fallback ──
async function callAI(prompt) {
  const cerebrasKey = process.env.CEREBRAS_API_KEY;
  const groqKey     = process.env.GROQ_API_KEY;

  if (cerebrasKey) {
    try {
      console.log('[DOUBT] Trying Cerebras...');
      const res = await axios.post(
        'https://api.cerebras.ai/v1/chat/completions',
        {
          model: 'llama-3.3-70b',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.4,
          max_tokens: 8192,
        },
        { headers: { 'Authorization': `Bearer ${cerebrasKey}`, 'Content-Type': 'application/json' } }
      );
      console.log('[DOUBT] Cerebras success');
      return res.data.choices[0].message.content.trim();
    } catch (err) {
      console.warn('[DOUBT] Cerebras failed:', err.response?.data?.error?.message || err.message, '— trying Groq');
    }
  }

  if (groqKey) {
    try {
      console.log('[DOUBT] Trying Groq fallback...');
      const res = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.4,
          max_tokens: 8192,
        },
        { headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' } }
      );
      console.log('[DOUBT] Groq fallback success');
      return res.data.choices[0].message.content.trim();
    } catch (err) {
      console.error('[DOUBT] Groq failed:', err.response?.data?.error?.message || err.message);
      throw new Error('Both Cerebras and Groq failed. Please try again.');
    }
  }

  throw new Error('No AI API key configured. Set CEREBRAS_API_KEY or GROQ_API_KEY.');
}

// POST /api/doubt/solve
router.post('/solve', async (req, res) => {
  try {
    const { question, examCategory, subcategory, material } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({ success: false, message: 'Question is required' });
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

    const raw = await callAI(prompt);

    const startIdx = raw.indexOf('{');
    const endIdx   = raw.lastIndexOf('}');
    if (startIdx === -1 || endIdx === -1) {
      return res.status(500).json({ success: false, message: 'Invalid AI response' });
    }

    const answer = JSON.parse(raw.substring(startIdx, endIdx + 1));
    console.log('[DOUBT] Solved for', examCtx, '-', subCtx);
    res.json({ success: true, answer });

  } catch (err) {
    console.error('[DOUBT] Error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
