const mongoose = require('mongoose');

const ClueSchema = new mongoose.Schema({
  points: { type: Number, required: true },
  timeLimitSec: { type: Number, default: 20 },
  prompt: { type: String, required: true },
  acceptedAnswers: { type: [String], default: [] },
  media: { type: Object } // { type, url }
});

const CategorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  clues: { type: [ClueSchema], default: [] } // 3–5 levels
});

const GridQuestTaskSchema = new mongoose.Schema({
  subjectId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  title: { type: String, required: true },
  description: { type: String },
  status: { type: String, enum: ['draft','published','closed'], default: 'draft', index: true },
  settings: {
    allowNegativeOnWrong: { type: Boolean, default: true },
    preTimerSec: { type: Number, default: 3 },
    suspenseRevealSec: { type: Number, default: 2 }
  },
  categories: { type: [CategorySchema], default: [] } // 3–7 categories
}, { timestamps: true });

GridQuestTaskSchema.index({ subjectId: 1, status: 1 });

module.exports = mongoose.model('GridQuestTask', GridQuestTaskSchema);



