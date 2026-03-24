const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes - require authentication
const auth = async (req, res, next) => {
  try {
    // Get token from header or query parameter (for PDF streaming in iframe)
    let token = req.header('Authorization');
    
    // Check for Bearer token
    if (token && token.startsWith('Bearer ')) {
      token = token.replace('Bearer ', '');
    }
    
    // Also check query params (for PDF iframe streaming)
    if (!token && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: 'No authentication token, access denied' 
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    if (!user.isActive) {
      return res.status(401).json({ 
        success: false,
        message: 'Account is inactive. Please contact support.' 
      });
    }

    // Attach user to request
    req.user = user;
    req.userId = user._id;
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid token' 
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false,
        message: 'Token expired. Please login again.' 
      });
    }
    
    res.status(401).json({ 
      success: false,
      message: 'Authentication failed' 
    });
  }
};

// Optional auth - doesn't fail if no token
const optionalAuth = async (req, res, next) => {
  try {
    let token = req.header('Authorization');
    
    if (token && token.startsWith('Bearer ')) {
      token = token.replace('Bearer ', '');
    }
    
    if (!token && req.query.token) {
      token = req.query.token;
    }

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      
      if (user && user.isActive) {
        req.user = user;
        req.userId = user._id;
      }
    }
    
    next();
  } catch (error) {
    // Silent fail for optional auth
    next();
  }
};

// Admin only
const adminAuth = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        message: 'Authentication required' 
      });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false,
        message: 'Admin access required' 
      });
    }

    next();
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Authorization check failed' 
    });
  }
};

module.exports = { auth, optionalAuth, adminAuth };
