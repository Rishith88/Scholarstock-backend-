// studify-backend/routes/pricingPlans.js - COMPLETE 20-PLAN SYSTEM

const express = require('express');
const router = express.Router();
const PricingPlan = require('../models/PricingPlan');
const jwt = require('jsonwebtoken');

// Middleware to verify admin token
const verifyAdmin = (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ success: false, message: 'No token' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });
    req.admin = decoded;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// Default 20 pricing plans (10 individual + 10 subcategory)
const DEFAULT_INDIVIDUAL_PLANS = [
  { id: 'ind_1', name: '1 Day Access', duration: 1, price: 5, savings: 0, badge: null, active: true, order: 1 },
  { id: 'ind_2', name: '2 Days Access', duration: 2, price: 9, savings: 1, badge: null, active: true, order: 2 },
  { id: 'ind_3', name: '3 Days Access', duration: 3, price: 13, savings: 2, badge: null, active: true, order: 3 },
  { id: 'ind_4', name: '5 Days Access', duration: 5, price: 19, savings: 6, badge: null, active: true, order: 4 },
  { id: 'ind_5', name: '1 Week Access', duration: 7, price: 29, savings: 14, badge: 'popular', active: true, order: 5 },
  { id: 'ind_6', name: '10 Days Access', duration: 10, price: 39, savings: 21, badge: null, active: true, order: 6 },
  { id: 'ind_7', name: '2 Weeks Access', duration: 14, price: 49, savings: 32, badge: null, active: true, order: 7 },
  { id: 'ind_8', name: '3 Weeks Access', duration: 21, price: 69, savings: 51, badge: null, active: true, order: 8 },
  { id: 'ind_9', name: '1 Month Access', duration: 30, price: 89, savings: 81, badge: 'best_value', active: true, order: 9 },
  { id: 'ind_10', name: '2 Months Access', duration: 60, price: 149, savings: 181, badge: null, active: true, order: 10 }
];

const DEFAULT_SUBCATEGORY_PLANS = [
  { id: 'sub_1', name: '1 Day Bundle', duration: 1, price: 19, savings: 0, badge: null, active: true, order: 1 },
  { id: 'sub_2', name: '2 Days Bundle', duration: 2, price: 35, savings: 3, badge: null, active: true, order: 2 },
  { id: 'sub_3', name: '3 Days Bundle', duration: 3, price: 49, savings: 8, badge: null, active: true, order: 3 },
  { id: 'sub_4', name: '5 Days Bundle', duration: 5, price: 79, savings: 16, badge: null, active: true, order: 4 },
  { id: 'sub_5', name: '1 Week Bundle', duration: 7, price: 99, savings: 34, badge: 'popular', active: true, order: 5 },
  { id: 'sub_6', name: '10 Days Bundle', duration: 10, price: 129, savings: 61, badge: null, active: true, order: 6 },
  { id: 'sub_7', name: '2 Weeks Bundle', duration: 14, price: 159, savings: 107, badge: null, active: true, order: 7 },
  { id: 'sub_8', name: '3 Weeks Bundle', duration: 21, price: 199, savings: 200, badge: null, active: true, order: 8 },
  { id: 'sub_9', name: '1 Month Bundle', duration: 30, price: 249, savings: 321, badge: 'best_value', active: true, order: 9 },
  { id: 'sub_10', name: '2 Months Bundle', duration: 60, price: 399, savings: 741, badge: null, active: true, order: 10 }
];

// Initialize default plans on first run
async function initializeDefaultPlans() {
  try {
    const count = await PricingPlan.countDocuments({ scope: 'global' });
    if (count === 0) {
      await PricingPlan.create([
        { scope: 'global', planType: 'individual', plans: DEFAULT_INDIVIDUAL_PLANS },
        { scope: 'global', planType: 'subcategory', plans: DEFAULT_SUBCATEGORY_PLANS }
      ]);
      console.log('✅ Default pricing plans initialized');
    }
  } catch (error) {
    console.error('Error initializing plans:', error);
  }
}

initializeDefaultPlans();

// GET /api/pricing-plans/public - Get plans for specific scope (public)
router.get('/public', async (req, res) => {
  try {
    const { examCategory, subcategory } = req.query;
    
    let query = { isActive: true };
    
    if (subcategory && examCategory) {
      query = { scope: 'subcategory', examCategory, subcategory, isActive: true };
    } else if (examCategory) {
      query = { scope: 'exam', examCategory, isActive: true };
    } else {
      query = { scope: 'global', isActive: true };
    }
    
    let plans = await PricingPlan.find(query);
    
    // Fallback to global if no specific plans found
    if (plans.length === 0) {
      plans = await PricingPlan.find({ scope: 'global', isActive: true });
    }
    
    const result = {
      individualPlans: plans.find(p => p.planType === 'individual')?.plans || DEFAULT_INDIVIDUAL_PLANS,
      subcategoryPlans: plans.find(p => p.planType === 'subcategory')?.plans || DEFAULT_SUBCATEGORY_PLANS
    };
    
    res.json({ success: true, plans: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// GET /api/pricing-plans/admin - Get all plans (admin)
router.get('/admin', verifyAdmin, async (req, res) => {
  try {
    const plans = await PricingPlan.find().sort({ scope: 1, examCategory: 1 });
    res.json({ success: true, plans });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// POST /api/pricing-plans/update-global - Update global plans (admin)
router.post('/update-global', verifyAdmin, async (req, res) => {
  try {
    const { individualPlans, subcategoryPlans } = req.body;
    
    await PricingPlan.findOneAndUpdate(
      { scope: 'global', planType: 'individual' },
      { plans: individualPlans, lastUpdated: new Date() },
      { upsert: true }
    );
    
    await PricingPlan.findOneAndUpdate(
      { scope: 'global', planType: 'subcategory' },
      { plans: subcategoryPlans, lastUpdated: new Date() },
      { upsert: true }
    );
    
    res.json({ success: true, message: 'Global plans updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// POST /api/pricing-plans/update-exam - Update exam-specific plans (admin)
router.post('/update-exam', verifyAdmin, async (req, res) => {
  try {
    const { examCategory, individualPlans, subcategoryPlans } = req.body;
    
    await PricingPlan.findOneAndUpdate(
      { scope: 'exam', examCategory, planType: 'individual' },
      { plans: individualPlans, lastUpdated: new Date() },
      { upsert: true }
    );
    
    await PricingPlan.findOneAndUpdate(
      { scope: 'exam', examCategory, planType: 'subcategory' },
      { plans: subcategoryPlans, lastUpdated: new Date() },
      { upsert: true }
    );
    
    res.json({ success: true, message: `Plans for ${examCategory} updated successfully` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// POST /api/pricing-plans/update-subcategory - Update subcategory-specific plans (admin)
router.post('/update-subcategory', verifyAdmin, async (req, res) => {
  try {
    const { examCategory, subcategory, individualPlans, subcategoryPlans } = req.body;
    
    await PricingPlan.findOneAndUpdate(
      { scope: 'subcategory', examCategory, subcategory, planType: 'individual' },
      { plans: individualPlans, lastUpdated: new Date() },
      { upsert: true }
    );
    
    await PricingPlan.findOneAndUpdate(
      { scope: 'subcategory', examCategory, subcategory, planType: 'subcategory' },
      { plans: subcategoryPlans, lastUpdated: new Date() },
      { upsert: true }
    );
    
    res.json({ success: true, message: `Plans for ${examCategory} > ${subcategory} updated` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// DELETE /api/pricing-plans/delete-custom - Delete custom plans for exam/subcategory (admin)
router.delete('/delete-custom', verifyAdmin, async (req, res) => {
  try {
    const { scope, examCategory, subcategory } = req.body;
    
    let query = { scope };
    if (examCategory) query.examCategory = examCategory;
    if (subcategory) query.subcategory = subcategory;
    
    await PricingPlan.deleteMany(query);
    res.json({ success: true, message: 'Custom plans deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

module.exports = router;
