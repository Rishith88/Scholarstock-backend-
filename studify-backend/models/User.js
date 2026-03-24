// studify-backend/models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a name'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: [6, 'Password must be at least 6 characters']
  },
  username: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    lowercase: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [20, 'Username cannot exceed 20 characters']
  },
  phone: { type: String, default: '', trim: true },
  isActive: { type: Boolean, default: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  createdAt: { type: Date, default: Date.now },
  lastLogin: { type: Date },

  // ── REFERRAL SYSTEM ──
  referredByUsername: {
    type: String,      // username of whoever referred this user
    default: null
  },
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  referralCount: {
    type: Number,
    default: 0         // how many people signed up using this user's username
  },
  referralBalance: {
    type: Number,
    default: 0         // ₹ wallet balance from referrals
  },
  referralCashbackGiven: {
    type: Boolean,
    default: false     // true once referee made first rental (triggers cashback)
  }
}, { timestamps: true });

userSchema.index({ email: 1 });
userSchema.index({ username: 1 });

module.exports = mongoose.model('User', userSchema);
