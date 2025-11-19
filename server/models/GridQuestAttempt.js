const mongoose = require('mongoose');

/**
 * GridQuestAttempt Model
 * Records each clue attempt in Grid Quest for detailed analytics
 * Each team's answer to each clue creates one record
 */

const GridQuestAttemptSchema = new mongoose.Schema(
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
      ref: 'GridQuestTask', 
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
    
    // Clue information
    clue: {
      catIdx: { type: Number, required: true },
      clueIdx: { type: Number, required: true },
      categoryName: { type: String, required: true },
      prompt: { type: String, required: true },
      points: { type: Number, required: true },
      acceptedAnswers: [{ type: String }]
    },
    
    // Team information
    team: {
      teamId: { type: String, required: true, index: true },
      teamName: { type: String, required: true },
      memberIds: [{ type: String }],  // All team members at time of attempt
      memberNames: [{ type: String }] // For easier reporting
    },
    
    // Chosen student (the one who answered)
    choosenStudent: {
      studentId: { type: String, required: true, index: true },
      studentName: { type: String, required: true },
      isOffline: { type: Boolean, default: false } // Track offline players
    },
    
    // Answer data
    submittedAnswer: { type: String, default: '' },
    isCorrect: { type: Boolean, required: true },
    pointsAwarded: { type: Number, required: true }, // Can be negative
    
    // Timing data
    clueStartedAt: { type: Date, required: true },
    submittedAt: { type: Date },
    responseTime: { type: Number }, // Seconds (null if no submission)
    
    // Metadata
    wasAutoSubmitted: { type: Boolean, default: false }, // Timer ran out
    wasManuallyAdjusted: { type: Boolean, default: false },
    manualAdjustmentAmount: { type: Number, default: 0 },
    
    // Round/turn tracking
    roundNumber: { type: Number, required: true }, // Which clue in the game (1, 2, 3...)
    
  },
  { timestamps: true }
);

// Compound indexes for efficient queries
GridQuestAttemptSchema.index({ sessionId: 1, teamId: 1 });
GridQuestAttemptSchema.index({ sessionId: 1, 'choosenStudent.studentId': 1 });
GridQuestAttemptSchema.index({ taskId: 1, 'clue.catIdx': 1, 'clue.clueIdx': 1 });

module.exports = mongoose.model('GridQuestAttempt', GridQuestAttemptSchema);

