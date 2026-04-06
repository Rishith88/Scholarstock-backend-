const express = require('express');
const router = express.Router();
const { verifyToken, optionalAuth } = require('../middleware/auth');

// Simple rule-based chatbot responses
const CHATBOT_RESPONSES = {
  greetings: ['hello', 'hi', 'hey', 'greetings'],
  pricing: ['price', 'cost', 'how much', 'pricing', 'plan', 'subscription'],
  materials: ['material', 'pdf', 'book', 'notes', 'study material'],
  exams: ['jee', 'neet', 'upsc', 'cat', 'exam', 'test', 'competitive'],
  help: ['help', 'support', 'assist', 'how to', 'how do i'],
  about: ['about', 'what is', 'scholarstock', 'who are you'],
  rental: ['rent', 'rental', 'borrow', 'access', 'buy'],
  account: ['account', 'login', 'signup', 'register', 'profile'],
};

const RESPONSES = {
  greetings: "👋 Hello! I'm your ScholarStock assistant. I can help you find study materials, understand pricing, or answer any questions about our platform!",
  pricing: "💰 We offer flexible pricing! Individual materials start at ₹5/day, and bundle plans for full subcategories start at ₹19/day. Check out our Pricing Plans page for all options!",
  materials: "📚 We have 10,000+ study materials for 100+ competitive exams including JEE, NEET, UPSC, CAT, and more. Browse by category or search for specific topics!",
  exams: "🎯 We cover all major competitive exams: JEE Main/Advanced, NEET UG/PG, UPSC CSE, CAT, GRE, GATE, Banking exams, and many more! What exam are you preparing for?",
  help: "🤔 I can help you:\n• Find study materials\n• Understand rental plans\n• Navigate the platform\n• Answer pricing questions\n• Provide study tips\n\nWhat would you like to know?",
  about: "🎓 ScholarStock is India's premier study material rental platform. Access premium content at a fraction of the cost. Rent by day, week, or month!",
  rental: "📖 Renting is easy! Browse materials → Select a plan (1 day to 2 months) → Pay securely → Access instantly in your Library. No download needed!",
  account: "👤 You can create a free account to start renting. Click 'Get Started' in the menu. Already have an account? Click 'Login' to access your materials!",
  default: "🤔 I'm not sure I understood. I can help you with:\n• Finding study materials\n• Pricing and plans\n• How rentals work\n• Account questions\n\nWhat would you like to know?"
};

function getResponse(message) {
  const lowerMsg = message.toLowerCase();
  
  for (const [category, keywords] of Object.entries(CHATBOT_RESPONSES)) {
    if (keywords.some(keyword => lowerMsg.includes(keyword))) {
      return RESPONSES[category];
    }
  }
  
  return RESPONSES.default;
}

// POST /api/chatbot/chat - Main chat endpoint
router.post('/chat', optionalAuth, async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;
    
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ 
        success: false, 
        message: 'Message is required' 
      });
    }

    const reply = getResponse(message);
    
    // Update conversation history
    const updatedHistory = [
      ...conversationHistory,
      { role: 'user', message },
      { role: 'assistant', message: reply }
    ].slice(-10); // Keep last 10 messages

    res.json({
      success: true,
      reply,
      conversationHistory: updatedHistory
    });
  } catch (error) {
    console.error('Chatbot error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Chatbot service temporarily unavailable' 
    });
  }
});

// GET /api/chatbot/welcome - Get welcome message
router.get('/welcome', (req, res) => {
  res.json({
    success: true,
    message: RESPONSES.greetings
  });
});

module.exports = router;
