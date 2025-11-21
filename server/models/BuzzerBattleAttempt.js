const mongoose = require('mongoose');

/**
 * BuzzerBattleAttempt Model
 * Records all buzz-in attempts and team performance for analytics
 * Each buzz-in (including steals) creates one record in teamBuzzData
 */

const BuzzerBattleAttemptSchema = new mongoose.Schema(
  {
    // Reference to session
    sessionId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'GameSession', 
      required: true, 
      index: true 
    },
    
    // Reference to task
    taskId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'BuzzerBattleTask', 
      required: true, 
      index: true 
    },
    
    // Subject context
    subjectId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Subject', 
      required: true, 
      index: true 
    },
    
    // Individual buzz-in records
    teamBuzzData: [{
      questionIndex: { type: Number, required: true },
      teamId: { type: String, required: true },
      teamName: { type: String, required: true },
      studentId: { type: String }, // Student who buzzed
      studentName: { type: String }, // Student name who buzzed
      buzzTimeMs: { type: Number, required: true }, // Time from question start to buzz
      sawFullQuestion: { type: Boolean, required: true }, // Did they see full question?
      submittedAnswer: { type: String, required: true },
      isCorrect: { type: Boolean, required: true },
      pointsAwarded: { type: Number, required: true }, // Can be positive or negative
      wasSteal: { type: Boolean, default: false }, // Was this a steal attempt?
      responseTimeSec: { type: Number }, // Time taken to answer after buzzing
      answeredBy: { type: String }, // Student ID who actually submitted the answer
      answeredByName: { type: String }, // Student name who actually submitted the answer
      timestamp: { type: Date, default: Date.now }
    }],
    
    // Aggregate team statistics
    teamStats: [{
      teamId: { type: String, required: true },
      teamName: { type: String, required: true },
      memberIds: [{ type: String }], // Student IDs
      memberNames: [{ type: String }], // For easier reporting
      finalScore: { type: Number, default: 0 },
      questionsAnswered: { type: Number, default: 0 }, // How many they buzzed for
      correctAnswers: { type: Number, default: 0 },
      wrongAnswers: { type: Number, default: 0 },
      stealsAttempted: { type: Number, default: 0 },
      stealsSuccessful: { type: Number, default: 0 },
      averageBuzzTimeSec: { type: Number }, // Average time to buzz
      longestStreak: { type: Number, default: 0 },
      timesFrozen: { type: Number, default: 0 } // How many times frozen due to consecutive wrong
    }],
    
    status: { type: String, enum: ['completed', 'abandoned'], default: 'completed' },
    startedAt: { type: Date },
    endedAt: { type: Date }
  },
  { timestamps: true }
);

// Compound indexes for efficient queries
BuzzerBattleAttemptSchema.index({ sessionId: 1, 'teamStats.teamId': 1 });
BuzzerBattleAttemptSchema.index({ taskId: 1, status: 1 });
BuzzerBattleAttemptSchema.index({ subjectId: 1, createdAt: -1 });

module.exports = mongoose.model('BuzzerBattleAttempt', BuzzerBattleAttemptSchema);

