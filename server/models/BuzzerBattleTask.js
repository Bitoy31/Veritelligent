const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  type: { type: String, enum: ['text_input', 'multiple_choice'], default: 'text_input' },
  options: [{ text: String }], // Only for multiple_choice
  acceptedAnswers: { type: String, required: true }, // Comma-separated answers for text_input
  points: { type: Number, default: 100 },
  category: { type: String }, // Optional: "Science", "History", etc.
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' }
});

const BuzzerBattleTaskSchema = new mongoose.Schema({
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true },
  description: { type: String },
  
  questions: { type: [QuestionSchema], default: [] },
  
  settings: {
    revealSpeed: { type: Number, default: 1000 }, // ms per word reveal
    allowPartialBuzz: { type: Boolean, default: true }, // Buzz before question finishes
    earlyBuzzBonus: { type: Number, default: 10 }, // Bonus points for buzzing early
    wrongAnswerPenalty: { type: Number, default: -10 },
    stealEnabled: { type: Boolean, default: true },
    maxSteals: { type: Number, default: 5 }, // How many teams can attempt steal
    answerTimeLimit: { type: Number, default: 30 }, // Seconds to answer after buzzing
    streakMultiplier: { type: Number, default: 1.5 },
    freezePenalty: { type: Boolean, default: false } // Freeze team after 3 consecutive wrong
  },
  
  status: { type: String, enum: ['draft', 'published', 'closed'], default: 'draft', index: true }
}, { timestamps: true });

BuzzerBattleTaskSchema.index({ subjectId: 1, status: 1 });
BuzzerBattleTaskSchema.index({ teacherId: 1, status: 1 });

module.exports = mongoose.model('BuzzerBattleTask', BuzzerBattleTaskSchema);

