const mongoose = require('mongoose');

const storeProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, enum: ['Reference Books', 'Study Notes', 'Study Kits', 'Question Banks', 'Stationery'], required: true },
  price: { type: Number, required: true },
  originalPrice: { type: Number, required: true },
  image: { type: String, default: '📘' },
  seller: { type: String, default: 'ScholarStock Official' },
  rating: { type: Number, default: 0 },
  reviews: { type: Number, default: 0 },
  stock: { type: Number, default: 0 },
  badge: { type: String, default: null },
  features: [String],
  condition: { type: String, enum: ['New', 'Used', 'Digital'], default: 'New' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const storeOrderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'StoreProduct' },
    name: String,
    quantity: Number,
    price: Number
  }],
  totalAmount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'], default: 'pending' },
  shippingAddress: { type: String },
  paymentMethod: { type: String, default: 'razorpay' },
  paymentId: { type: String }
}, { timestamps: true });

storeProductSchema.index({ category: 1, isActive: 1 });
storeProductSchema.index({ name: 'text' });
storeOrderSchema.index({ userId: 1, createdAt: -1 });

const StoreProduct = mongoose.model('StoreProduct', storeProductSchema);
const StoreOrder = mongoose.model('StoreOrder', storeOrderSchema);

module.exports = { StoreProduct, StoreOrder };
