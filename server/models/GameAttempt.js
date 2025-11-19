const mongoose = require('mongoose');

const AnswerRecordSchema = new mongoose.Schema(
  {
    questionIndex: { type: Number, required: true },
    selectedOption: { type: Number },
    textAnswer: { type: String },
    isCorrect: { type: Boolean, required: true },
    timeTakenSec: { type: Number, default: 0 },
    pointsEarned: { type: Number, default: 0 },
  },
  { _id: false }
);

const ScoringPolicySnapshotSchema = new mongoose.Schema(
  {
    totalPointsPossible: { type: Number, required: true },
    allowRetries: Boolean,
    quickAnswerBonus: Boolean,
    quickAnswerTimeThreshold: Number,
    streakBonus: Boolean,
    streakMultiplier: Number,
    earlySubmissionBonus: Number,
  },
  { _id: false }
);

const GameAttemptSchema = new mongoose.Schema(
  {
    taskId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    sessionId: { type: mongoose.Schema.Types.ObjectId, index: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    category: { type: String, enum: ['solo', 'party'], required: true },
    gameType: { type: String, enum: ['quiz', 'grid_quest', 'flashcard', 'buzzer_battle'], required: true },

    attemptNo: { type: Number, default: 1 },
    startedAt: { type: Date, default: Date.now, index: true },
    endedAt: { type: Date },
    timeSpentSec: { type: Number },

    answers: { type: [AnswerRecordSchema], default: [] },
    scoringPolicy: { type: ScoringPolicySnapshotSchema, required: true },

    totalScore: { type: Number, required: true, index: true },
    bonusPoints: { type: Number, default: 0 },
    finalScore: { type: Number, required: true, index: true },
    accuracyPct: { type: Number },
    streakCount: { type: Number },
    quickAnswerCount: { type: Number },

    status: { type: String, enum: ['completed', 'in_progress', 'abandoned'], default: 'completed', index: true },
    teamId: { type: String },
  },
  { timestamps: true }
);

GameAttemptSchema.index({ taskId: 1, sessionId: 1, studentId: 1 });

module.exports = mongoose.model('GameAttempt', GameAttemptSchema);


