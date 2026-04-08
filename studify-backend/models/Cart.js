const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  itemType: {
    type: String,
    enum: ['material', 'subcategory'],
    required: true
  },
  materialId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Material',
    default: null
  },
  materialTitle: {
    type: String,
    default: null
  },
  examCategory: {
    type: String,
    default: null
  },
  subcategory: {
    type: String,
    default: null
  },
  planId: {
    type: String,
    required: true
  },
  planName: {
    type: String,
    required: true
  },
  duration: {
    type: Number,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const cartSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  items: [cartItemSchema],
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Methods for cart
cartSchema.methods.getTotal = function() {
  return this.items.reduce((total, item) => total + item.price, 0);
};

cartSchema.methods.getSavings = function() {
  // Logic for calculating savings (placeholder)
  return 0;
};

module.exports = mongoose.model('Cart', cartSchema);
