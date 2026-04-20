const mongoose = require('mongoose');

const annotationSchema = new mongoose.Schema({
  annotationId: { type: String, required: true, unique: true },
  materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true },
  pageNumber: { type: Number, default: 1 },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudyRoom', default: null },
  type: { type: String, enum: ['highlight', 'comment', 'drawing'], default: 'highlight' },
  content: { type: String, default: '' },
  color: { type: String, default: '#3b82f6' },
  position: {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
  },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

annotationSchema.index({ materialId: 1, userId: 1 });
annotationSchema.index({ roomId: 1 });
annotationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Annotation', annotationSchema);
