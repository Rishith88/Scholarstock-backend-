const mongoose = require('mongoose');

const pricingPlanSchema = new mongoose.Schema({
  scope: { type: String, default: 'global', enum: ['global', 'exam', 'subcategory'] },
  planType: { type: String, enum: ['individual', 'subcategory'] },
  examCategory: { type: String, default: null },
  subcategory: { type: String, default: null },
  isActive: { type: Boolean, default: true },
  lastUpdated: { type: Date, default: Date.now },
  plans: { type: mongoose.Schema.Types.Mixed, default: [] },
  // Legacy fields kept for backward compat
  name: { type: String },
  title: { type: String },
  description: { type: String },
  price: { type: Number },
  duration: { type: String },
  durationDays: { type: Number },
  features: [{ type: String }],
  isPopular: { type: Boolean, default: false },
  category: { type: String, default: null },
  maxMaterials: { type: Number, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

pricingPlanSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

pricingPlanSchema.statics.initializeDefaultPlans = async function() {
  // No-op — pricingPlans route handles initialization
};

let PricingPlan;
try {
  PricingPlan = mongoose.model('PricingPlan');
} catch(e) {
  PricingPlan = mongoose.model('PricingPlan', pricingPlanSchema);
}

module.exports = PricingPlan;
