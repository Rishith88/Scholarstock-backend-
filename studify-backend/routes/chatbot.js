// routes/chatbot.js
// Primary: Cerebras (llama-3.3-70b) — 1M tokens/day free
// Fallback: Groq (llama-3.3-70b-versatile) — if Cerebras fails

const express = require('express');
const router = express.Router();
const axios = require('axios');

const SYSTEM_PROMPT = `You are ScholarStock AI, a powerful assistant built into the ScholarStock study platform.
1. PLATFORM ASSISTANT — Help users with ScholarStock:
   - Finding study materials for exams (JEE, NEET, UPSC, CAT, GATE, etc.)
   - Rental plans: 19/day (school), 29/day (premium), 39/day (advanced)
   - 100+ exam categories, 10,000+ materials, 24-hour PDF access, no subscriptions

2. FULL AI TUTOR — Help students with actual learning:
   - Solve math, physics, chemistry, biology problems step by step
   - Explain complex concepts clearly
   - Help with exam preparation strategies
   - Answer questions from any subject or topic
   - Write, debug, and explain code
   - Summarize topics, create revision notes
   - Answer general knowledge questions

Never refuse to solve a problem or explain a concept. Always give detailed, accurate, helpful answers. Format math and equations clearly. Be encouraging and supportive to students.`;

// ── Call AI with Cerebras primary, Groq fallback ──
async function callAI(messages) {
  const cerebrasKey = process.env.CEREBRAS_API_KEY;
  const groqKey     = process.env.GROQ_API_KEY;

  if (cerebrasKey) {
    try {
      console.log('[CHATBOT] Trying Cerebras...');
      const res = await axios.post(
        'https://api.cerebras.ai/v1/chat/completions',
        {
          model: 'llama-3.3-70b',
          messages,
          temperature: 0.7,
          max_tokens: 8192,
        },
        { headers: { 'Authorization': `Bearer ${cerebrasKey}`, 'Content-Type': 'application/json' } }
      );
      console.log('[CHATBOT] Cerebras success');
      return res.data.choices[0].message.content.trim();
    } catch (err) {
      console.warn('[CHATBOT] Cerebras failed:', err.response?.data?.error?.message || err.message, '— trying Groq');
    }
  }

  if (groqKey) {
    try {
      console.log('[CHATBOT] Trying Groq fallback...');
      const res = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: 'llama-3.3-70b-versatile',
          messages,
          temperature: 0.7,
          max_tokens: 8192,
        },
        { headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' } }
      );
      console.log('[CHATBOT] Groq fallback success');
      return res.data.choices[0].message.content.trim();
    } catch (err) {
      console.error('[CHATBOT] Groq failed:', err.response?.data?.error?.message || err.message);
      throw new Error('Both Cerebras and Groq failed. Please try again.');
    }
  }

  throw new Error('No AI API key configured. Set CEREBRAS_API_KEY or GROQ_API_KEY.');
}

router.post('/chat', async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    // Build messages array with system prompt
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      // Include conversation history
      ...conversationHistory.map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      })),
      // Add current message
      { role: 'user', content: message }
    ];

    // Keep last 10 messages to avoid token limits
    const trimmedMessages = [
      messages[0], // always keep system prompt
      ...messages.slice(1).slice(-10)
    ];

    const reply = await callAI(trimmedMessages);

    const updatedHistory = [
      ...conversationHistory,
      { role: 'user', content: message },
      { role: 'assistant', content: reply }
    ].slice(-10);

    res.json({ success: true, reply, conversationHistory: updatedHistory });

  } catch (error) {
    console.error('[CHATBOT] Error:', error.message);
    res.status(500).json({ success: false, error: 'Internal server error: ' + error.message });
  }
});

module.exports = router;