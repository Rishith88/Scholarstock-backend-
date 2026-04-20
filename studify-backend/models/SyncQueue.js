const mongoose = require('mongoose');

const syncQueueSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  operationType: { type: String, enum: ['create', 'update', 'delete'], required: true },
  entityType: { type: String, required: true },
  entityId: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  timestamp: { type: Date, default: Date.now },
  synced: { type: Boolean, default: false },
  conflictResolved: { type: Boolean, default: false },
}, { timestamps: true });

syncQueueSchema.index({ userId: 1, synced: 1 });
syncQueueSchema.index({ timestamp: 1 });

// Check if model already exists to avoid OverwriteModelError
module.exports = mongoose.models.SyncQueue || mongoose.model('SyncQueue', syncQueueSchema);
