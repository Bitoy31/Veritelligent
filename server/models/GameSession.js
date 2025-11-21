const mongoose = require('mongoose');

const GameSessionSchema = new mongoose.Schema(
  {
    taskId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    category: { type: String, enum: ['solo', 'party'], required: true },
    gameType: { type: String, enum: ['quiz', 'grid_quest', 'flashcard', 'buzzer_battle'], required: true },
    roomCode: { type: String, index: true },
    status: { type: String, enum: ['scheduled', 'active', 'ended', 'archived'], default: 'active', index: true },
    settingsSnapshot: { type: Object },
    isTeamBased: { type: Boolean, default: false },
    startedAt: { type: Date, default: Date.now, index: true },
    endedAt: { type: Date },
    
    // Grid Quest specific data
    gridQuestData: {
      teams: [{
        teamId: String,
        name: String,
        memberIds: [String],
        memberNames: [String],
        finalScore: Number
      }],
      totalRounds: { type: Number, default: 0 },
      cluesCompleted: { type: Number, default: 0 },
      manualScoreAdjustments: { type: Number, default: 0 },
      offlinePlayerCount: { type: Number, default: 0 }
    }
  },
  { timestamps: true }
);

GameSessionSchema.index({ taskId: 1, status: 1 });

module.exports = mongoose.model('GameSession', GameSessionSchema);


