const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['multiple_choice', 'text_input'], 
    required: true 
  },
  options: [{
    text: String,
    isCorrect: Boolean
  }],
  acceptedAnswers: { type: String }, // comma-separated for text_input
  points: { type: Number, required: true, default: 1 },
  hasTimer: { type: Boolean, default: false },
  timeLimitSec: { type: Number, default: 30 }
});

const flashcardTaskSchema = new mongoose.Schema({
  subjectId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Subject', 
    required: true 
  },
  teacherId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  title: { type: String, required: true },
  description: { type: String },
  status: { 
    type: String, 
    enum: ['draft', 'published', 'closed'], 
    default: 'draft' 
  },
  questions: [questionSchema],
  settings: {
    allowRepeatedStudents: { type: Boolean, default: false }
  }
}, { 
  timestamps: true 
});

module.exports = mongoose.model('FlashcardTask', flashcardTaskSchema);

