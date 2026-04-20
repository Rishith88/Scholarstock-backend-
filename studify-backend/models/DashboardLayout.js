const mongoose = require('mongoose');

const widgetSchema = new mongoose.Schema({
  widgetType: { type: String, required: true },
  gridX: { type: Number, default: 0 },
  gridY: { type: Number, default: 0 },
  gridW: { type: Number, default: 4 },
  gridH: { type: Number, default: 3 },
  config: { type: mongoose.Schema.Types.Mixed, default: {} },
});

const dashboardLayoutSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  widgets: [widgetSchema],
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

dashboardLayoutSchema.index({ userId: 1 });

module.exports = mongoose.model('DashboardLayout', dashboardLayoutSchema);
