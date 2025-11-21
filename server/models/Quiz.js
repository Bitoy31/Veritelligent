const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true
  },
  questionType: {
    type: String,
    enum: ['single', 'true_false'],
    default: 'single'
  },
  options: [{
    text: String,
    isCorrect: Boolean
  }],
  points: {
    type: Number,
    default: 1
  },
  timeLimit: {
    type: Number, // seconds
    default: 30
  }
});

const quizSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: String,
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
  status: {
    type: String,
    enum: ['draft', 'published', 'closed'],
    default: 'draft'
  },
  questions: [questionSchema],
  settings: {
    shuffleQuestions: {
      type: Boolean,
      default: true
    },
    shuffleOptions: {
      type: Boolean,
      default: true
    },
    showFeedbackAfterEach: {
      type: Boolean,
      default: false
    },
    timeLimit: {
      type: Number, // minutes, 0 means no limit
      default: 0
    },
    passingScore: {
      type: Number,
      default: 60
    },
    allowRetake: {
      type: Boolean,
      default: false
    },
    maxAttempts: {
      type: Number,
      default: 1
    }
  },
  dateCreated: {
    type: Date,
    default: Date.now
  },
  lastModified: {
    type: Date,
    default: Date.now
  }
});

// Update lastModified on save
quizSchema.pre('save', function(next) {
  this.lastModified = new Date();
  next();
});

// Virtual for total points
quizSchema.virtual('totalPoints').get(function() {
  return this.questions.reduce((sum, q) => sum + q.points, 0);
});

module.exports = mongoose.model('Quiz', quizSchema); 