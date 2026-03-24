const mongoose = require('mongoose');

const NotificationChannelSchema = new mongoose.Schema({
  channel: {
    type: String,
    enum: ['email', 'whatsapp', 'sms', 'telegram', 'discord', 'instagram', 'slack', 'browser'],
    required: true
  },
  contact: { type: String, default: '' }
}, { _id: false });

const TaskSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title:       { type: String, required: true, trim: true, maxlength: 200 },
  desc:        { type: String, default: '', maxlength: 1000 },
  category: {
    type: String,
    enum: ['study','exam','revision','assignment','practice','reading','project','personal','other'],
    default: 'study'
  },
  date:        { type: String, required: true },   // "YYYY-MM-DD"
  time:        { type: String, default: '09:00' }, // "HH:MM"
  duration:    { type: String, default: '1 hour' },
  repeat: {
    type: String,
    enum: ['none','daily','weekly','monthly'],
    default: 'none'
  },
  priority: {
    type: String,
    enum: ['low','med','high'],
    default: 'low'
  },
  reminderMin: { type: Number, default: 30 },      // minutes before due
  channels:    [NotificationChannelSchema],
  done:        { type: Boolean, default: false },
  progress:    { type: Number, default: 0, min: 0, max: 100 },

  // Notification tracking
  reminderSent:   { type: Boolean, default: false },
  reminderSentAt: { type: Date },

  // Repeat tracking
  nextOccurrence: { type: String }, // "YYYY-MM-DD" for next repeat task
}, {
  timestamps: true
});

// Index for scheduler queries — find tasks needing reminders
TaskSchema.index({ date: 1, done: 1, reminderSent: 1 });
TaskSchema.index({ user: 1, date: 1 });

module.exports = mongoose.model('Task', TaskSchema);
