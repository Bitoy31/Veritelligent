const mongoose = require('mongoose');

const flashcardAttemptSchema = new mongoose.Schema({
  sessionId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'GameSession', 
    required: true 
  },
  taskId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'FlashcardTask', 
    required: true 
  },
  subjectId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Subject', 
    required: true 
  },
  studentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  questionIndex: { type: Number, required: true },
  selectedOption: { type: Number }, // for multiple_choice
  textAnswer: { type: String }, // for text_input
  isCorrect: { type: Boolean, required: true },
  pointsEarned: { type: Number, required: true },
  timeTakenSec: { type: Number },
  lifeCardUsed: { 
    type: String, 
    enum: ['call_friend', 'hint', 'redraw', null],
    default: null
  },
  helperId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User'
  },
  helperAnswer: { type: String },
  helperCorrect: { type: Boolean },
  helperPointsEarned: { type: Number },
  revealedHint: { type: String }
}, { 
  timestamps: true 
});

module.exports = mongoose.model('FlashcardAttempt', flashcardAttemptSchema);

