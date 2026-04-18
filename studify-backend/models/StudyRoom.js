const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String, required: true },
  text: { type: String, default: '' },
  type: { type: String, enum: ['text', 'system', 'file', 'whiteboard'], default: 'text' },
  fileUrl: { type: String, default: null },
  fileName: { type: String, default: null },
}, { timestamps: true });

const annotationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: { type: String },
  x: Number, y: Number,
  width: Number, height: Number,
  color: { type: String, default: '#3b82f6' },
  text: { type: String, default: '' },
  page: { type: Number, default: 1 },
}, { timestamps: true });

const studyRoomSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, default: '', maxlength: 500 },
  subject: { type: String, default: '' },
  examCategory: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdByName: { type: String, required: true },

  // Access control
  isPrivate: { type: Boolean, default: false },
  inviteCode: { type: String, unique: true, sparse: true },
  maxMembers: { type: Number, default: 10 },

  // Members
  members: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: { type: String },
    role: { type: String, enum: ['owner', 'moderator', 'member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now },
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },
  }],

  // Shared document
  sharedMaterialId: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', default: null },
  sharedMaterialTitle: { type: String, default: null },
  currentPage: { type: Number, default: 1 },

  // Chat messages (last 200 stored in DB, rest in memory/socket)
  messages: { type: [messageSchema], default: [] },

  // Annotations on shared doc
  annotations: { type: [annotationSchema], default: [] },

  // Whiteboard data (JSON string of canvas state)
  whiteboardData: { type: String, default: null },

  // Notes (shared notepad)
  sharedNotes: { type: String, default: '' },

  // Status
  status: { type: String, enum: ['active', 'archived'], default: 'active' },
  lastActivity: { type: Date, default: Date.now },
}, { timestamps: true });

studyRoomSchema.index({ createdBy: 1 });
studyRoomSchema.index({ inviteCode: 1 });
studyRoomSchema.index({ status: 1, lastActivity: -1 });
studyRoomSchema.index({ 'members.userId': 1 });

module.exports = mongoose.model('StudyRoom', studyRoomSchema);
