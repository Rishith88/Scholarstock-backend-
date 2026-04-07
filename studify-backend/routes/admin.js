const express = require('express');
const router = express.Router();

// POST /api/admin/verify-vault - Verify vault code from environment variable
router.post('/verify-vault', (req, res) => {
  try {
    const { vaultCode } = req.body;
    const envVaultCode = process.env.ADMIN_VAULT_CODE || 'ADMIN2026';
    
    if (vaultCode && vaultCode.toUpperCase() === envVaultCode.toUpperCase()) {
      res.json({ success: true });
    } else {
      res.json({ success: false });
    }
  } catch (error) {
    console.error('Vault verification error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Verification failed' 
    });
  }
});

// POST /api/admin/login - Admin login
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
    
    if (username === adminUser && password === adminPass) {
      const jwt = require('jsonwebtoken');
      const token = jwt.sign(
        { role: 'admin', username },
        process.env.JWT_SECRET || 'fallback-secret',
        { expiresIn: '24h' }
      );
      
      res.json({ 
        success: true, 
        token,
        admin: { username, role: 'admin' }
      });
    } else {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

module.exports = router;
