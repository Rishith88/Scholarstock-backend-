// routes/mocktest.js
// Mount in server.js: app.use('/api/mocktest', require('./routes/mocktest'));
// Uses same GEMINI_API_KEY as your chatbot — no new keys needed!

const express = require('express');
const router  = express.Router();
const axios   = require('axios');

// ── Helper: build a smart topic description from category + subcategory ──
function buildTopicContext(category, subcategory) {
  // If subcategory is "Free Resources", generate for the whole exam category
  if (subcategory === 'Free Resources' || subcategory === 'free-resources') {
    return {
      topic: category,
      context: `This is a comprehensive mock test covering the full syllabus of the ${category} exam. Include questions from all major subjects and topics tested in ${category}.`
    };
  }

  // Otherwise combine both for full context
  return {
    topic: `${subcategory} for ${category}`,
    context: `This is a mock test specifically for the "${subcategory}" subject/topic within the ${category} exam. Generate questions that are directly relevant to what is tested in ${subcategory} as part of ${category} preparation.`
  };
}

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

    const { topic, context } = buildTopicContext(category, subcategory);

    const questionTypeDesc =
      qType === 'mcq'       ? 'multiple choice (4 options each)' :
      qType === 'truefalse' ? 'true/false' :
      'mixed (some MCQ with 4 options, some true/false)';

    const difficultyDesc =
      difficulty === 'easy'   ? 'easy — suitable for beginners, basic concept questions' :
      difficulty === 'hard'   ? 'hard — advanced level, tricky and conceptual questions' :
      difficulty === 'mixed'  ? 'mixed difficulty — a combination of easy, medium and hard questions' :
      'medium — moderate difficulty, standard exam level questions';

    const prompt = `You are an expert question paper setter for competitive exams in India and worldwide.

EXAM: ${category}
SUBJECT/TOPIC: ${subcategory}
CONTEXT: ${context}

Your task: Generate exactly ${qCount} ${questionTypeDesc} questions.
Difficulty level: ${difficultyDesc}

STRICT RULES:
1. Every question MUST be about actual exam content for "${topic}" — real concepts, formulas, facts, theorems, laws, dates, or problems that appear in ${category} exams
2. Do NOT generate questions about books, study materials, or how to prepare — generate ACTUAL subject questions
3. Questions must test real knowledge — like what appears in the actual ${category} exam
4. Each MCQ must have exactly 4 options labeled naturally (do not include A/B/C/D in the option text itself)
5. Each true/false must have exactly 2 options: "True" and "False"
6. The "correct" field must be the index (0, 1, 2, or 3 for MCQ — 0 for True, 1 for False)
7. Include a clear, educational explanation for why the answer is correct

EXAMPLES of good questions for JEE Mains — Physics:
- "What is the SI unit of electric flux?" (not "Which book covers electric flux?")
- "A ball is thrown vertically upward with velocity 20 m/s. What is the maximum height reached?" (not "Which chapter covers projectile motion?")

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
For true/false questions use type "tf", options must be exactly ["True", "False"], correct is 0 for True or 1 for False.`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 8192,
        }
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );

    // Extract text from Gemini response
    const raw = response.data.candidates[0].content.parts[0].text.trim();

    // Robustly extract JSON array — find first [ and last ] in response
    const startIdx = raw.indexOf('[');
    const endIdx   = raw.lastIndexOf(']');

    if(startIdx === -1 || endIdx === -1 || endIdx < startIdx){
      console.error('[MOCKTEST] No JSON array found in response:', raw.substring(0, 200));
      return res.status(500).json({ success: false, message: 'Gemini did not return valid JSON. Try again.' });
    }

    const clean = raw.substring(startIdx, endIdx + 1);
    const questions = JSON.parse(clean);

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(500).json({ success: false, message: 'Invalid questions generated' });
    }

    console.log('[MOCKTEST] Successfully generated', questions.length, 'questions for', topic);
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
