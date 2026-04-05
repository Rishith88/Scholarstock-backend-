const express = require('express');
const router  = express.Router();
const axios   = require('axios');
const jwt     = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'studify_super_secret_jwt_key_2024_change_in_production';

// Middleware to verify JWT token
const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ success: false, message: 'No token' });
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// ── Call AI with Cerebras primary, Groq fallback ──
async function callAI(prompt) {
  const cerebrasKey = process.env.CEREBRAS_API_KEY;
  const groqKey     = process.env.GROQ_API_KEY;

  if (cerebrasKey) {
    try {
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
      return res.data.choices[0].message.content.trim();
    } catch (err) {
      console.warn('[STUDY-PLAN] Cerebras failed, trying Groq fallback');
    }
  }

  if (groqKey) {
    try {
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
      return res.data.choices[0].message.content.trim();
    } catch (err) {
      console.error('[STUDY-PLAN] Groq fallback failed');
      throw new Error('Both Cerebras and Groq failed.');
    }
  }

  throw new Error('No AI API key configured.');
}

// POST /api/study-strategist/plan
router.post('/plan', auth, async (req, res) => {
  try {
    const { examName, daysUntilExam, hoursPerWeek, weakAreas, prepLevel, goalBrief } = req.body;

    if (!examName || !daysUntilExam || !hoursPerWeek) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const prompt = `You are the Expert AI Principal Study Strategist for ScholarStock. 
    A user is preparing for: ${examName}
    Time remaining: ${daysUntilExam} days
    Weekly commitment: ${hoursPerWeek} hours
    Current level: ${prepLevel}
    Weak areas to focus on: ${weakAreas || 'None specifically mentioned'}
    Personalized Goal: ${goalBrief || 'Maximum performance and score optimization'}

    TASK: Generate an ultra-detailed, professional study roadmap in JSON format.
    The response must be hyper-specific to ${examName}'s actual syllabus and structure.

    Rules for the Plan:
    1. EXAM SYLLABUS: Include the actual top-level subjects (e.g., Physics, Chemistry, Math for JEE; Quant, Verbal for SAT).
    2. WEEKLY PHASES: Each phase must have a thematic title and map to the specific remaining time.
    3. DAILY FLOW: Provide 3-4 "Daily Rituals" or steps for a typical high-performance day.
    4. SCHOLARSTOCK EDGE: Explicitly mention using:
       - AI Doubt Solver (for difficult chapters)
       - Mock Test Generator (for weekly testing)
       - Premium PDF Library (for formula sheets/PYQs)
    5. ACTIVE RECALL: Include specific 7-30-60 day revision markers.

    JSON STRUCTURE REQUIRED:
    {
      "title": "Professional Roadmap for ${examName}",
      "executiveSummary": "A high-impact strategy summarized in 3 sentences.",
      "prepStageLabel": "${prepLevel}",
      "stats": {
        "estimatedTotalHours": ${Math.round((daysUntilExam / 7) * hoursPerWeek)},
        "weeklyIntensity": "...",
        "readinessProjection": "..."
      },
      "weeklyPhases": [
        {
          "week": "1",
          "theme": "Syllabus Breakdown & Foundation",
          "hoursSuggested": ${hoursPerWeek},
          "focusAreas": ["Exact topic 1", "Exact topic 2"],
          "milestones": ["Complete X mock questions", "Memorize Y formulas"],
          "scholarStockTip": "Use AI Doubt Solver to resolve bottlenecks in [Topic 1]."
        }
      ],
      "dailyHabits": ["Morning: Flashcards / Formula Review", "Afternoon: Deep work session (Focused learning)", "Evening: PYQ practice & ScholarStock Mock review"],
      "finalWeekPlan": ["Day 1: Full Mock Test", "Day 2: Review critical weak areas", "Day 7: Light revision + 8h sleep"],
      "riskAlerts": [
        { "risk": "Topic Burnout", "mitigation": "Switch between Quant and Verbal every 2 hours." }
      ],
      "motivationLine": "A powerful quote or advice."
    }`;

    const raw = await callAI(prompt);
    
    const startIdx = raw.indexOf('{');
    const endIdx   = raw.lastIndexOf('}');

    if (startIdx === -1 || endIdx === -1) {
      throw new Error('Invalid JSON returned from AI');
    }

    const plan = JSON.parse(raw.substring(startIdx, endIdx + 1));

    res.json({ 
      success: true, 
      plan,
      meta: { examName }
    });

  } catch (err) {
    console.error('[STUDY-PLAN] Error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
