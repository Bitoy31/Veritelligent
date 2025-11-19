const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const router = express.Router();

// Debug: Log all requests to this router
router.use((req, res, next) => {
  console.log(`[subjectJoin] ${req.method} ${req.path}`);
  next();
});

function requireAuth(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) {
      console.log('[requireAuth] Missing token');
      return res.status(401).json({ message: 'Missing token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded;
    console.log('[requireAuth] Token verified for user:', decoded.userId);
    next();
  } catch (err) {
    console.log('[requireAuth] Token verification failed:', err.message);
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired. Please log in again.' });
    }
    return res.status(401).json({ message: 'Invalid token' });
  }
}

// Get enrolled subjects for a student
router.get('/enrolled/:studentId', requireAuth, async (req, res) => {
  try {
    const { studentId } = req.params;
    console.log('Fetching enrolled subjects for student:', studentId);
    
    // Find all subjects where this student is enrolled
    const subjects = await mongoose.connection
      .collection('subject_tbl')
      .find({
        'enrolledStudents.studentId': studentId
      })
      .toArray();

    console.log('Found subjects:', subjects.length);
    console.log('Subjects:', subjects.map(s => ({ id: s._id, name: s.name, enrolledStudents: s.enrolledStudents })));

    if (!subjects || subjects.length === 0) {
      return res.json([]);
    }

    res.json(subjects);
  } catch (err) {
    console.error('Error fetching enrolled subjects:', err);
    res.status(500).json({ message: 'Failed to fetch enrolled subjects' });
  }
});

// Join by subject ObjectId
router.post('/join-by-id', requireAuth, async (req, res) => {
  try {
    const { subjectId } = req.body || {};
    if (!subjectId) return res.status(400).json({ message: 'Subject ID is required' });

    const subjects = mongoose.connection.collection('subject_tbl');

    const subject = await subjects.findOne({ _id: new mongoose.Types.ObjectId(subjectId) });
    if (!subject) return res.status(404).json({ message: 'Subject not found' });

    const studentId = String(req.user.userId);
    const existing = (subject.enrolledStudents || []).find(s => String(s.studentId) === studentId);
    if (existing) {
      return res.status(200).json({
        message: 'You are already in this class',
        status: existing.status || 'enrolled',
        subjectId: subject._id
      });
    }

    await subjects.updateOne(
      { _id: new mongoose.Types.ObjectId(subjectId) },
      { $push: { enrolledStudents: { studentId, status: 'pending' } } }
    );

    const updated = await subjects.findOne({ _id: new mongoose.Types.ObjectId(subjectId) });

    res.status(200).json({
      message: 'Successfully joined class',
      subject: {
        _id: updated._id,
        code: updated.code,
        name: updated.name,
        teacher: updated.teacher,
        enrolledStudents: updated.enrolledStudents
      }
    });
  } catch (err) {
    console.error('Join by ID error:', err);
    res.status(500).json({ message: 'Failed to join class' });
  }
});

router.get('/by-code/:code', requireAuth, async (req, res) => {
  try {
    const subject = await mongoose.connection
      .collection('subject_tbl')
      .findOne({ code: req.params.code });

    if (!subject) return res.status(404).json({ message: 'Subject not found' });
    res.json({
      _id: subject._id,
      code: subject.code,
      name: subject.name,
      teacher: subject.teacher,
      enrolledCount: Array.isArray(subject.enrolledStudents) ? subject.enrolledStudents.length : 0
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch subject' });
  }
});

router.post('/join', requireAuth, async (req, res) => {
  try {
    const { code } = req.body || {};
    if (!code) return res.status(400).json({ message: 'Class code is required' });

    const subjects = mongoose.connection.collection('subject_tbl');

    const subject = await subjects.findOne({ code });
    if (!subject) return res.status(404).json({ message: 'Subject not found' });

    const studentId = String(req.user.userId);
    const existing = (subject.enrolledStudents || []).find(s => String(s.studentId) === studentId);
    if (existing) {
      return res.status(200).json({
        message: 'You are already in this class',
        status: existing.status || 'enrolled',
        subjectId: subject._id
      });
    }

    await subjects.updateOne(
      { _id: subject._id },
      { $push: { enrolledStudents: { studentId, status: 'pending' } } }
    );

    const updated = await subjects.findOne({ _id: subject._id });

    res.status(200).json({
      message: 'Join request submitted (pending approval)',
      subject: {
        _id: updated._id,
        code: updated.code,
        name: updated.name,
        teacher: updated.teacher,
        enrolledStudents: updated.enrolledStudents
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to join class' });
  }
});

// Teacher-only: approve a pending request -> set status to 'enrolled'

// Remove the current student from a subject's enrolledStudents
// Can be used for both: Drop (if enrolled) and Cancel Request (if pending)
router.delete('/enrolled/:subjectId', requireAuth, async (req, res) => {
  try {
    const { subjectId } = req.params;
    if (!subjectId) return res.status(400).json({ message: 'Subject ID is required' });

    const subjects = mongoose.connection.collection('subject_tbl');
    const subject = await subjects.findOne({ _id: new mongoose.Types.ObjectId(subjectId) });
    if (!subject) return res.status(404).json({ message: 'Subject not found' });

    const studentId = String(req.user.userId);
    const before = Array.isArray(subject.enrolledStudents) ? subject.enrolledStudents.length : 0;

    await subjects.updateOne(
      { _id: new mongoose.Types.ObjectId(subjectId) },
      { $pull: { enrolledStudents: { studentId } } }
    );

    const updated = await subjects.findOne({ _id: new mongoose.Types.ObjectId(subjectId) });
    const after = Array.isArray(updated?.enrolledStudents) ? updated.enrolledStudents.length : 0;

    const removed = before !== after;
    if (!removed) {
      return res.status(200).json({ message: 'No enrollment/request to remove', subjectId });
    }

    res.json({
      message: 'Removed enrollment/request successfully',
      subject: {
        _id: updated._id,
        code: updated.code,
        name: updated.name,
        teacher: updated.teacher,
        enrolledStudents: updated.enrolledStudents || []
      }
    });
  } catch (err) {
    console.error('Error removing enrollment:', err);
    res.status(500).json({ message: 'Failed to remove enrollment' });
  }
});

module.exports = router;



