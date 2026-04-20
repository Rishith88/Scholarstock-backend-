const mongoose = require('mongoose');

const courseSyncRecordSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  universityId: { type: String, required: true },
  courseCode: { type: String, required: true },
  syncedAt: { type: Date, default: Date.now },
  topicCount: { type: Number, default: 0 },
  matchedMaterialIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Material' }],
  taskIdsCreated: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }],
}, { timestamps: true });

courseSyncRecordSchema.index({ userId: 1, universityId: 1, courseCode: 1 });
courseSyncRecordSchema.index({ syncedAt: -1 });

// Check if model already exists to avoid OverwriteModelError
module.exports = mongoose.models.CourseSyncRecord || mongoose.model('CourseSyncRecord', courseSyncRecordSchema);
