const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
    questionIndex: {
        type: Number,
        required: true
    },
    selectedOption: {
        type: Number,
        required: true
    },
    isCorrect: {
        type: Boolean,
        required: true
    },
    timeTaken: {
        type: Number, // seconds
        required: true
    },
    pointsEarned: {
        type: Number,
        required: true
    }
});

const quizAttemptSchema = new mongoose.Schema({
    quizId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TaskQuiz',
        required: true
    },
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    subjectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subject',
        required: true
    },
    answers: [answerSchema],
    startTime: {
        type: Date,
        required: true
    },
    endTime: {
        type: Date,
        required: true
    },
    totalScore: {
        type: Number,
        required: true
    },
    bonusPoints: {
        type: Number,
        default: 0
    },
    finalScore: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['completed', 'in_progress', 'abandoned'],
        default: 'in_progress'
    }
});

// Create compound indexes for efficient querying
quizAttemptSchema.index({ quizId: 1, studentId: 1 }, { unique: true }); // One attempt per student
quizAttemptSchema.index({ subjectId: 1, studentId: 1 }); // For finding student's attempts in a subject
quizAttemptSchema.index({ quizId: 1, status: 1 }); // For finding all attempts of a quiz

// Calculate final score before saving
quizAttemptSchema.pre('save', function(next) {
    this.finalScore = this.totalScore + this.bonusPoints;
    next();
});

const QuizAttempt = mongoose.model('QuizAttempt', quizAttemptSchema);

module.exports = QuizAttempt; 