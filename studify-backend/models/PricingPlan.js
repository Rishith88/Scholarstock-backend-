const mongoose = require('mongoose');

const pricingPlanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    enum: ['individual', 'bundle', 'unlimited']
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  duration: {
    type: String,
    required: true,
    enum: ['1 day', '7 days', '15 days', '30 days', '60 days', '90 days']
  },
  durationDays: {
    type: Number,
    required: true
  },
  features: [{
    type: String
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  isPopular: {
    type: Boolean,
    default: false
  },
  category: {
    type: String,
    default: null // null means all categories
  },
  subcategory: {
    type: String,
    default: null
  },
  maxMaterials: {
    type: Number,
    default: null // null means unlimited
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp on save
pricingPlanSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Static method to get default plans
pricingPlanSchema.statics.getDefaultPlans = function() {
  return [
    {
      name: 'individual',
      title: 'Individual Material',
      description: 'Access to one specific material',
      price: 5,
      duration: '1 day',
      durationDays: 1,
      features: ['1 material access', '24 hours duration', 'Full PDF viewer', 'Search enabled'],
      isPopular: false
    },
    {
      name: 'individual',
      title: 'Individual Material',
      description: 'Access to one specific material',
      price: 15,
      duration: '7 days',
      durationDays: 7,
      features: ['1 material access', '7 days duration', 'Full PDF viewer', 'Search enabled', 'Highlight & notes'],
      isPopular: false
    },
    {
      name: 'bundle',
      title: 'Subcategory Bundle',
      description: 'Access all materials in a subcategory',
      price: 19,
      duration: '1 day',
      durationDays: 1,
      features: ['All materials in subcategory', '24 hours duration', 'Full PDF viewer', 'Priority support'],
      isPopular: false
    },
    {
      name: 'bundle',
      title: 'Subcategory Bundle',
      description: 'Access all materials in a subcategory',
      price: 49,
      duration: '7 days',
      durationDays: 7,
      features: ['All materials in subcategory', '7 days duration', 'Full PDF viewer', 'Priority support', 'Download option'],
      isPopular: true
    },
    {
      name: 'bundle',
      title: 'Subcategory Bundle',
      description: 'Access all materials in a subcategory',
      price: 99,
      duration: '30 days',
      durationDays: 30,
      features: ['All materials in subcategory', '30 days duration', 'Full PDF viewer', 'Priority support', 'Download option', 'Offline access'],
      isPopular: false
    },
    {
      name: 'unlimited',
      title: 'Unlimited Access',
      description: 'Access all materials on the platform',
      price: 199,
      duration: '30 days',
      durationDays: 30,
      features: ['All materials access', '30 days duration', 'Full PDF viewer', 'Priority support', 'Download option', 'Offline access', 'AI tutor access'],
      isPopular: false
    },
    {
      name: 'unlimited',
      title: 'Unlimited Access',
      description: 'Access all materials on the platform',
      price: 499,
      duration: '90 days',
      durationDays: 90,
      features: ['All materials access', '90 days duration', 'Full PDF viewer', 'Priority support', 'Download option', 'Offline access', 'AI tutor access', 'Mock tests included'],
      isPopular: true
    }
  ];
};

// Initialize default plans if none exist
pricingPlanSchema.statics.initializeDefaultPlans = async function() {
  const count = await this.countDocuments();
  if (count === 0) {
    const plans = this.getDefaultPlans();
    await this.insertMany(plans);
    console.log('Default pricing plans initialized');
  }
};

module.exports = mongoose.model('PricingPlan', pricingPlanSchema);
