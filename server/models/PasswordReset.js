const mongoose = require('mongoose');

const passwordResetSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
    index: true
  },
  email: {
    type: String,
    required: true,
    index: true
  },
  otpCode: {
    type: String,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 } // Auto-delete expired documents
  },
  used: {
    type: Boolean,
    default: false,
    index: true
  },
  purpose: {
    type: String,
    enum: ['password_reset', 'email_verification'],
    default: 'password_reset'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  collection: 'password_resets'
});

// Compound index for quick lookups
passwordResetSchema.index({ userId: 1, used: 1 });
passwordResetSchema.index({ email: 1, used: 1, expiresAt: 1 });

const PasswordReset = mongoose.model('PasswordReset', passwordResetSchema, 'password_resets');

module.exports = PasswordReset;



