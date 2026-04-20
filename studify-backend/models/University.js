const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  courseCode: { type: String, required: true },
  courseName: { type: String, required: true },
  syllabus: { type: String, default: '' },
  lectureSlides: [{ type: String }],
  assignments: [{
    title: String,
    dueDate: Date,
    description: String,
  }],
  lastSyncedAt: { type: Date, default: null },
});

const universitySchema = new mongoose.Schema({
  universityId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  location: { type: String, default: '' },
  affiliatedBoard: { type: String, default: '' },
  courses: [courseSchema],
}, { timestamps: true });

universitySchema.index({ universityId: 1 });
universitySchema.index({ name: 1 });

// Check if model already exists to avoid OverwriteModelError
module.exports = mongoose.models.University || mongoose.model('University', universitySchema);
