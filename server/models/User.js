const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    userName: String,
    userPass: String,
    userFname: String,
    userMname: String,
    userLname: String,
    userEmail: String,
    userRole: String,
    userContact: String,
    userAddress: String,
    userProfilePic: String,
    userClasses: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class'
    }],
    emailVerified: {
        type: Boolean,
        default: false
    },
    emailVerifiedAt: {
        type: Date
    },
    dateCreated: {
        type: Date,
        default: Date.now
    }
}, {
    collection: 'users_tbl'  // Explicitly specify the collection name
});

// Add a pre-save middleware to log user data before saving
userSchema.pre('save', function(next) {
    console.log('Saving user:', {
        userName: this.userName,
        userRole: this.userRole,
        userFname: this.userFname,
        userLname: this.userLname
    });
    next();
});

// Task Score Schema - No longer used, using GameAttempt instead
// const taskScoreSchema = new mongoose.Schema({
//     taskId: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'Task',
//         required: true
//     },
//     studentId: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'User',
//         required: true
//     },
//     subjectId: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'Subject',
//         required: true
//     },
//     score: {
//         type: Number,
//         required: true,
//         default: 0
//     },
//     streakCount: {
//         type: Number,
//         default: 0
//     },
//     quickAnswers: {
//         type: Number,
//         default: 0
//     },
//     completedAt: {
//         type: Date,
//         default: Date.now
//     },
//     timeSpent: {
//         type: Number,  // in seconds
//         required: true
//     },
//     status: {
//         type: String,
//         enum: ['completed', 'in_progress', 'abandoned'],
//         required: true
//     },
//     answers: [{
//         questionIndex: Number,
//         answer: String,
//         isCorrect: Boolean,
//         timeTaken: Number,  // time taken for this question in seconds
//         points: Number      // points earned for this question
//     }]
// });

// Create indexes for faster queries
// taskScoreSchema.index({ taskId: 1, studentId: 1 }, { unique: true });
// taskScoreSchema.index({ studentId: 1, status: 1 });
// taskScoreSchema.index({ subjectId: 1, status: 1 });

const User = mongoose.model('User', userSchema, 'users_tbl');
// const TaskScore = mongoose.model('TaskScore', taskScoreSchema, 'task_score_tbl');

module.exports = { User };