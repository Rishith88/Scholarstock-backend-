const mongoose = require('mongoose');

const sharedNoteSchema = new mongoose.Schema({
  noteId: { type: String, required: true, unique: true },
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudyRoom', required: true },
  content: { type: String, default: '' },
  lastEditedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastEditedAt: { type: Date, default: Date.now },
  version: { type: Number, default: 1 },
}, { timestamps: true });

sharedNoteSchema.index({ roomId: 1 });
sharedNoteSchema.index({ lastEditedAt: -1 });

module.exports = mongoose.model('SharedNote', sharedNoteSchema);
