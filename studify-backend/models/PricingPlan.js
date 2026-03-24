const mongoose = require('mongoose');

const pricingPlanSchema = new mongoose.Schema({
  // Scope: 'global', 'exam', 'subcategory'
  scope: {
    type: String,
    enum: ['global', 'exam', 'subcategory'],
    default: 'global'
  },
  
  // If scope is 'exam' or 'subcategory'
  examCategory: { type: String, default: null },
  subcategory: { type: String, default: null },
  
  // Plan type: individual material or subcategory bundle
  planType: {
    type: String,
    enum: ['individual', 'subcategory'],
    required: true
  },
  
  // 10 plans for each type
  plans: [{
    id: { type: String, required: true },
    name: { type: String, required: true },
    duration: { type: Number, required: true }, // days
    price: { type: Number, required: true },
    savings: { type: Number, default: 0 },
    badge: { type: String, default: null }, // 'popular', 'best_value'
    active: { type: Boolean, default: true },
    order: { type: Number, required: true }
  }],
  
  isActive: { type: Boolean, default: true },
  lastUpdated: { type: Date, default: Date.now }
});

pricingPlanSchema.index({ scope: 1, examCategory: 1, subcategory: 1 });

module.exports = mongoose.model('PricingPlan', pricingPlanSchema);
