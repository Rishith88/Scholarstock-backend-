// studify-backend/routes/chatbot.js

const express = require('express');
const router = express.Router();
const https = require('https');

router.post('/chat', async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ success: false, error: 'GEMINI_API_KEY not configured in .env' });
    }

    const systemPrompt = `You are ScholarStock AI, a powerful assistant built into the ScholarStock study platform.
1. PLATFORM ASSISTANT — Help users with Studify:
   - Finding study materials for exams (JEE, NEET, UPSC, CAT, GATE, etc.)
   - Rental plans: ₹19/day (school), ₹29/day (premium), ₹39/day (advanced)
   - 100+ exam categories, 10,000+ materials, 24-hour PDF access, no subscriptions

2. FULL AI TUTOR — Help students with actual learning:
   - Solve math, physics, chemistry, biology problems step by step
   - Explain complex concepts clearly
   - Help with exam preparation strategies
   - Answer questions from any subject or topic
   - Write, debug, and explain code
   - Summarize topics, create revision notes
   - Answer general knowledge questions

You are powered by Google Gemini and have full reasoning capabilities. Never refuse to solve a problem or explain a concept. Always give detailed, accurate, helpful answers. Format math and equations clearly. Be encouraging and supportive to students.`;

    // Build Gemini contents array (alternating user/model)
    const contents = [];

    conversationHistory.forEach(msg => {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      });
    });

    contents.push({
      role: 'user',
      parts: [{ text: message }]
    });

    const requestBody = JSON.stringify({
      system_instruction: {
        parts: [{ text: systemPrompt }]
      },
      contents,
      generationConfig: {
        maxOutputTokens: 8192,
        temperature: 0.7
      }
    });

    const apiKey = process.env.GEMINI_API_KEY;
    const model = 'gemini-2.5-flash';
    const path = `/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const responseData = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'generativelanguage.googleapis.com',
        port: 443,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody)
        }
      };

      const request = https.request(options, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(new Error('Invalid JSON from Gemini')); }
        });
      });

      request.on('error', reject);
      request.write(requestBody);
      request.end();
    });

    if (responseData.error) {
      console.error('Gemini API error:', responseData.error);
      return res.status(500).json({ success: false, error: 'AI service error: ' + responseData.error.message });
    }

    const reply = responseData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!reply) {
      return res.status(500).json({ success: false, error: 'No response from Gemini' });
    }

    const updatedHistory = [
      ...conversationHistory,
      { role: 'user', content: message },
      { role: 'assistant', content: reply }
    ].slice(-10);

    res.json({ success: true, reply, conversationHistory: updatedHistory });

  } catch (error) {
    console.error('Chatbot error:', error.message);
    res.status(500).json({ success: false, error: 'Internal server error: ' + error.message });
  }
});

module.exports = router;
