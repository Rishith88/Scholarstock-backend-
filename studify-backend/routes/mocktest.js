// routes/mocktest.js
// Primary: Cerebras (llama-3.3-70b) — 1M tokens/day free
// Fallback: Groq (llama-3.3-70b-versatile) — if Cerebras fails

const express = require('express');
const router  = express.Router();
const axios   = require('axios');

function buildTopicContext(category, subcategory) {
  if (subcategory === 'Free Resources' || subcategory === 'free-resources') {
    return {
      topic: category,
      context: `This is a comprehensive mock test covering the full syllabus of the ${category} exam. Include questions from all major subjects and topics tested in ${category}.`
    };
  }
  return {
    topic: `${subcategory} for ${category}`,
    context: `This is a mock test specifically for the "${subcategory}" subject/topic within the ${category} exam. Generate questions directly relevant to what is tested in ${subcategory} as part of ${category} preparation.`
  };
}

// ── Call AI with Cerebras primary, Groq fallback ──
async function callAI(prompt) {
  const cerebrasKey = process.env.CEREBRAS_API_KEY;
  const groqKey     = process.env.GROQ_API_KEY;

  // Try Cerebras first
  if (cerebrasKey) {
    try {
      console.log('[MOCKTEST] Trying Cerebras...');
      const res = await axios.post(
        'https://api.cerebras.ai/v1/chat/completions',
        {
          model: 'llama-3.3-70b',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.6,
          max_tokens: 8192,
        },
        { headers: { 'Authorization': `Bearer ${cerebrasKey}`, 'Content-Type': 'application/json' } }
      );
      console.log('[MOCKTEST] Cerebras success');
      return res.data.choices[0].message.content.trim();
    } catch (err) {
      console.warn('[MOCKTEST] Cerebras failed:', err.response?.data?.error?.message || err.message, '— trying Groq fallback');
    }
  }

  // Fallback to Groq
  if (groqKey) {
    try {
      console.log('[MOCKTEST] Trying Groq fallback...');
      const res = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.6,
          max_tokens: 8192,
        },
        { headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' } }
      );
      console.log('[MOCKTEST] Groq fallback success');
      return res.data.choices[0].message.content.trim();
    } catch (err) {
      console.error('[MOCKTEST] Groq fallback failed:', err.response?.data?.error?.message || err.message);
      throw new Error('Both Cerebras and Groq failed. Please try again.');
    }
  }

  throw new Error('No AI API key configured. Set CEREBRAS_API_KEY or GROQ_API_KEY.');
}

// POST /api/mocktest/generate
router.post('/generate', async (req, res) => {
  try {
    const { category, subcategory, qCount = 10, difficulty = 'medium', qType = 'mcq' } = req.body;

    if (!category || !subcategory) {
      return res.status(400).json({ success: false, message: 'Category and subcategory required' });
    }

    console.log('[MOCKTEST] Generating', qCount, 'questions for', category, '-', subcategory);

    const { topic, context } = buildTopicContext(category, subcategory);

    const questionTypeDesc =
      qType === 'mcq'       ? 'multiple choice (4 options each)' :
      qType === 'truefalse' ? 'true/false' :
      'mixed (some MCQ with 4 options, some true/false)';

    const difficultyDesc =
      difficulty === 'easy'  ? 'easy — suitable for beginners, basic concept questions' :
      difficulty === 'hard'  ? 'hard — advanced level, tricky and conceptual questions' :
      difficulty === 'mixed' ? 'mixed difficulty — a combination of easy, medium and hard questions' :
      'medium — moderate difficulty, standard exam level questions';

    const prompt = `You are an expert question paper setter for competitive exams in India and worldwide.

EXAM: ${category}
SUBJECT/TOPIC: ${subcategory}
CONTEXT: ${context}

Your task: Generate exactly ${qCount} ${questionTypeDesc} questions.
Difficulty level: ${difficultyDesc}

STRICT RULES:
1. Every question MUST be about actual exam content for "${topic}" — real concepts, formulas, facts, theorems, laws, dates, or problems
2. Do NOT generate questions about books, study materials, or how to prepare — generate ACTUAL subject questions
3. Each MCQ must have exactly 4 options (do not include A/B/C/D in the option text)
4. Each true/false must have exactly 2 options: "True" and "False"
5. The "correct" field must be the index (0-3 for MCQ, 0 for True, 1 for False)
6. Include a clear educational explanation for why the answer is correct

Respond ONLY with a valid JSON array. No markdown, no code fences, no extra text:
[
  {
    "question": "Actual exam question here?",
    "type": "mcq",
    "options": ["First option", "Second option", "Third option", "Fourth option"],
    "correct": 0,
    "explanation": "Clear explanation of why this answer is correct"
  }
]
For true/false use type "tf", options must be exactly ["True", "False"], correct is 0 for True or 1 for False.`;

    const raw = await callAI(prompt);

    // Robustly extract JSON array
    const startIdx = raw.indexOf('[');
    const endIdx   = raw.lastIndexOf(']');

    if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
      console.error('[MOCKTEST] No JSON array found:', raw.substring(0, 200));
      return res.status(500).json({ success: false, message: 'AI did not return valid JSON. Try again.' });
    }

    const questions = JSON.parse(raw.substring(startIdx, endIdx + 1));

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(500).json({ success: false, message: 'Invalid questions generated' });
    }

    console.log('[MOCKTEST] Successfully generated', questions.length, 'questions for', topic);
    res.json({ success: true, questions });

  } catch (err) {
    console.error('[MOCKTEST] Error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
