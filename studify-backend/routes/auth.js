const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'studify_super_secret_jwt_key_2024_change_in_production';

// ==========================================
// REGISTER
// ==========================================
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, username, referredByUsername } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password required' });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    // Check if username already exists (if provided)
    if (username) {
      const existingUsername = await User.findOne({ username });
      if (existingUsername) {
        return res.status(400).json({ success: false, message: 'Username already taken' });
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Handle referral
    let referrer = null;
    if (referredByUsername) {
      referrer = await User.findOne({ username: referredByUsername });
      if (referrer) {
        referrer.referralCount += 1;
        await referrer.save();
      }
    }

    // Create user
    const user = new User({
      name,
      email,
      password: hashedPassword,
      username: username || undefined,
      referredByUsername: referredByUsername || null,
      referredBy: referrer ? referrer._id : null
    });

    await user.save();

    // Generate token
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        username: user.username
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Registration failed: ' + error.message });
  }
});

// ==========================================
// LOGIN
// ==========================================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
        referralBalance: user.referralBalance,
        referralCount: user.referralCount
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
});

// ==========================================
// VERIFY TOKEN
// ==========================================
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
        referralBalance: user.referralBalance,
        referralCount: user.referralCount
      }
    });
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
});

// ==========================================
// GET USER PROFILE
// ==========================================
router.get('/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, user });
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
});


// /signup is same as /register (frontend compatibility)
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, username, referredByUsername } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    if (username) {
      const existingUsername = await User.findOne({ username });
      if (existingUsername) {
        return res.status(400).json({ success: false, message: 'Username already taken' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    let referrer = null;
    if (referredByUsername) {
      referrer = await User.findOne({ username: referredByUsername.toLowerCase().trim() });
    }

    const user = new User({
      name,
      email,
      password: hashedPassword,
      username: username || undefined,
      referredByUsername: referredByUsername || null,
      referredBy: referrer ? referrer._id : null
    });

    await user.save();

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
        referralBalance: user.referralBalance || 0,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ success: false, message: 'Signup failed: ' + error.message });
  }
});

// Check username availability
router.post('/check-username', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ success: false, message: 'Username required' });
    const exists = await User.findOne({ username: username.toLowerCase().trim() });
    res.json({ success: true, available: !exists });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;

