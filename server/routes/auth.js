const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { login } = require('../controllers/authController');
const PasswordReset = require('../models/PasswordReset');
const { sendOTPEmail, sendEmailVerification } = require('../utils/emailService');

// SIGNUP ROUTE
router.post('/signup', async (req, res) => {
    try {
        const {
            userName, userPass, userFname, userMname, userLname,
            userRole, userEmail, userContact, userProfile
        } = req.body;

        // Check if username already exists (case-insensitive)
        const existing = await mongoose.connection
            .collection('users_tbl')
            .findOne({ userName: { $regex: new RegExp(`^${userName}$`, 'i') } });

        if (existing) {
            return res.status(400).json({ message: 'Username already exists' });
        }

        // Prepare user object
        const newUser = {
            userName,
            userPass, // NOT hashed, as requested
            userFname,
            userMname,
            userLname,
            userRole,
            userEmail,
            userContact,
            userProfile: userProfile || '',
            userClasses: '' // default empty, or set as needed
        };

        // Insert into users_tbl
        const result = await mongoose.connection
            .collection('users_tbl')
            .insertOne(newUser);

        // Prepare response user data
        const userData = {
            _id: result.insertedId.toString(),
            userName,
            userFname,
            userMname,
            userLname,
            userRole,
            userEmail,
            userContact,
            userClasses: '',
            userProfile: userProfile || ''
        };

        // Return user and a simple token (for demo, not secure)
        res.status(201).json({
            user: userData,
            token: Buffer.from(userData._id).toString('base64')
        });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Login route is handled by authController.js - no duplicate needed here
router.post('/login', login);

// Middleware to verify JWT
function requireAuth(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Missing token' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

// Change password (plain-text per current schema)
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new passwords are required' });
    }

    const users = mongoose.connection.collection('users_tbl');
    const userId = req.user.userId;
    const user = await users.findOne({ _id: new mongoose.Types.ObjectId(userId) });
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (String(user.userPass) !== String(currentPassword)) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    await users.updateOne(
      { _id: new mongoose.Types.ObjectId(userId) },
      { $set: { userPass: String(newPassword) } }
    );

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ message: 'Failed to change password' });
  }
});

// POST /api/auth/forgot-password - Request password reset OTP
router.post('/forgot-password', async (req, res) => {
  try {
    const { email, userName } = req.body;
    
    if (!email && !userName) {
      return res.status(400).json({ message: 'Email or username is required' });
    }

    // Find user by email or username
    const users = mongoose.connection.collection('users_tbl');
    let user = null;
    
    if (email) {
      user = await users.findOne({ userEmail: email });
    } else if (userName) {
      user = await users.findOne({ userName: userName });
    }

    // Don't reveal if user exists for security
    if (!user || !user.userEmail) {
      return res.json({ 
        message: 'If an account with that email exists, a password reset code has been sent.' 
      });
    }

    // Check if user has a valid email
    if (!user.userEmail || !user.userEmail.includes('@')) {
      return res.status(400).json({ 
        message: 'Email not found. Please contact your teacher/administrator.' 
      });
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Set expiration to 15 minutes
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    // Invalidate any existing unused OTPs for this user
    await PasswordReset.updateMany(
      { userId: user._id, used: false, purpose: 'password_reset' },
      { $set: { used: true } }
    );

    // Create new password reset record
    const passwordReset = new PasswordReset({
      userId: user._id,
      email: user.userEmail,
      otpCode,
      expiresAt,
      purpose: 'password_reset'
    });

    await passwordReset.save();

    // Send OTP email
    try {
      await sendOTPEmail(user.userEmail, otpCode, user.userName || user.userFname);
    } catch (emailError) {
      console.error('Failed to send email:', emailError);
      // Still return success to not reveal if email exists
      return res.json({ 
        message: 'If an account with that email exists, a password reset code has been sent.' 
      });
    }

    res.json({ 
      message: 'If an account with that email exists, a password reset code has been sent.' 
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ message: 'Failed to process password reset request' });
  }
});

// POST /api/auth/verify-otp - Verify OTP code
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, userName, otpCode } = req.body;

    if (!otpCode) {
      return res.status(400).json({ message: 'OTP code is required' });
    }

    if (!email && !userName) {
      return res.status(400).json({ message: 'Email or username is required' });
    }

    // Find user
    const users = mongoose.connection.collection('users_tbl');
    let user = null;
    
    if (email) {
      user = await users.findOne({ userEmail: email });
    } else if (userName) {
      user = await users.findOne({ userName: userName });
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Find valid OTP
    const resetRecord = await PasswordReset.findOne({
      userId: user._id,
      otpCode: otpCode.toString(),
      used: false,
      expiresAt: { $gt: new Date() }
    });

    if (!resetRecord) {
      return res.status(400).json({ message: 'Invalid or expired OTP code' });
    }

    res.json({ 
      message: 'OTP verified successfully',
      verified: true
    });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ message: 'Failed to verify OTP' });
  }
});

// POST /api/auth/reset-password - Reset password with OTP
router.post('/reset-password', async (req, res) => {
  try {
    const { email, userName, otpCode, newPassword } = req.body;

    if (!otpCode || !newPassword) {
      return res.status(400).json({ message: 'OTP code and new password are required' });
    }

    if (!email && !userName) {
      return res.status(400).json({ message: 'Email or username is required' });
    }

    // Find user
    const users = mongoose.connection.collection('users_tbl');
    let user = null;
    
    if (email) {
      user = await users.findOne({ userEmail: email });
    } else if (userName) {
      user = await users.findOne({ userName: userName });
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Find and verify OTP
    const resetRecord = await PasswordReset.findOne({
      userId: user._id,
      otpCode: otpCode.toString(),
      used: false,
      expiresAt: { $gt: new Date() },
      purpose: 'password_reset'
    });

    if (!resetRecord) {
      return res.status(400).json({ message: 'Invalid or expired OTP code' });
    }

    // Update password
    await users.updateOne(
      { _id: user._id },
      { $set: { userPass: String(newPassword) } }
    );

    // Mark OTP as used
    resetRecord.used = true;
    await resetRecord.save();

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ message: 'Failed to reset password' });
  }
});

// POST /api/auth/verify-email - Request email verification OTP
router.post('/verify-email', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const users = mongoose.connection.collection('users_tbl');
    const user = await users.findOne({ _id: new mongoose.Types.ObjectId(userId) });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.userEmail || !user.userEmail.includes('@')) {
      return res.status(400).json({ message: 'Valid email address is required' });
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Set expiration to 15 minutes
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    // Invalidate any existing unused verification OTPs for this user
    await PasswordReset.updateMany(
      { userId: user._id, used: false, purpose: 'email_verification' },
      { $set: { used: true } }
    );

    // Create new email verification record
    const verificationRecord = new PasswordReset({
      userId: user._id,
      email: user.userEmail,
      otpCode,
      expiresAt,
      purpose: 'email_verification'
    });

    await verificationRecord.save();

    // Send verification email
    try {
      await sendEmailVerification(user.userEmail, otpCode, user.userName || user.userFname);
      res.json({ message: 'Verification code sent to your email' });
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      res.status(500).json({ message: 'Failed to send verification email. Please check your email configuration.' });
    }
  } catch (err) {
    console.error('Verify email error:', err);
    res.status(500).json({ message: 'Failed to send verification email' });
  }
});

// POST /api/auth/confirm-email-verification - Confirm email verification with OTP
router.post('/confirm-email-verification', requireAuth, async (req, res) => {
  try {
    const { otpCode } = req.body;
    const userId = req.user.userId;

    if (!otpCode) {
      return res.status(400).json({ message: 'OTP code is required' });
    }

    // Find and verify OTP
    const verificationRecord = await PasswordReset.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      otpCode: otpCode.toString(),
      used: false,
      expiresAt: { $gt: new Date() },
      purpose: 'email_verification'
    });

    if (!verificationRecord) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }

    // Update user's email verification status
    const users = mongoose.connection.collection('users_tbl');
    await users.updateOne(
      { _id: new mongoose.Types.ObjectId(userId) },
      { 
        $set: { 
          emailVerified: true,
          emailVerifiedAt: new Date()
        } 
      }
    );

    // Mark OTP as used
    verificationRecord.used = true;
    await verificationRecord.save();

    res.json({ message: 'Email verified successfully' });
  } catch (err) {
    console.error('Confirm email verification error:', err);
    res.status(500).json({ message: 'Failed to verify email' });
  }
});

module.exports = router;