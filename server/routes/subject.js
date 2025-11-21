const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { ObjectId } = require('mongodb');

// POST /api/subjects - Add a subject
router.post('/', async (req, res) => {
  try {
    const { code, name, teacher, DateCreated } = req.body;
    if (!code || !name || !teacher || !teacher._id || !teacher.name) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    const result = await mongoose.connection.collection('subject_tbl').insertOne({
      code,
      name,
      teacher,
      DateCreated: DateCreated || new Date().toISOString(),
      enrolledStudents: [], // Always initialize!
    });
    res.status(201).json({
      _id: result.insertedId,
      code,
      name,
      teacher,
      DateCreated,
      enrolledStudents: [],
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/subjects?teacherId=... - List subjects for a teacher
router.get('/', async (req, res) => {
  try {
    const { teacherId } = req.query;
    if (!teacherId) return res.status(400).json({ message: 'Missing teacherId' });
    const subjects = await mongoose.connection
      .collection('subject_tbl')
      .find({ 'teacher._id': teacherId })
      .toArray();
    res.json(subjects);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/subjects/:id - Delete a subject
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await mongoose.connection.collection('subject_tbl').deleteOne({ _id: new mongoose.Types.ObjectId(id) });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Enroll a student (request enrollment)
router.post('/:subjectId/enroll', async (req, res) => {
  const { subjectId } = req.params;
  const { studentId } = req.body;
  if (!studentId) return res.status(400).json({ message: 'Missing studentId' });

  // Check for existing enrollment
  const subject = await mongoose.connection.collection('subject_tbl').findOne(
    { _id: new mongoose.Types.ObjectId(subjectId), "enrolledStudents.studentId": studentId }
  );
  if (subject) {
    return res.status(409).json({ message: 'Student already enrolled or pending in this subject.' });
  }

  // Add to enrolledStudents if not present
  await mongoose.connection.collection('subject_tbl').updateOne(
    { _id: new mongoose.Types.ObjectId(subjectId) },
    { $addToSet: { enrolledStudents: { studentId, status: 'pending' } } }
  );
  res.json({ success: true });
});

// Student joins a subject (add to enrolledStudents as 'pending')
router.post('/:id/enroll', async (req, res) => {
  const { id } = req.params;
  const { studentId } = req.body;
  if (!studentId) return res.status(400).json({ message: 'Missing studentId' });

  // Prevent duplicate join
  const result = await mongoose.connection.collection('subject_tbl').updateOne(
    { _id: new mongoose.Types.ObjectId(id), "enrolledStudents.studentId": { $ne: studentId } },
    { $push: { enrolledStudents: { studentId, status: 'pending' } } }
  );

  if (result.modifiedCount === 0) {
    return res.status(400).json({ message: 'Already joined or subject not found.' });
  }

  res.json({ success: true });
});

// Get enrolled students with details for a subject
router.get('/:subjectId/enrolled', async (req, res) => {
  const { subjectId } = req.params;
  const subject = await mongoose.connection.collection('subject_tbl').findOne(
    { _id: new mongoose.Types.ObjectId(subjectId) }
  );
  if (!subject) return res.status(404).json({ message: 'Subject not found' });
  const enrolled = subject.enrolledStudents || [];
  if (enrolled.length === 0) return res.json([]);
  // Fetch student details from users collection
  const ids = enrolled.map(e => new mongoose.Types.ObjectId(e.studentId));
  const students = await mongoose.connection.collection('users_tbl').find({ _id: { $in: ids } }).toArray();
  // Merge details
  const result = enrolled.map(e => {
    const user = students.find(s => String(s._id) === String(e.studentId));
    return {
      ...e,
      name: user ? `${user.userFname} ${user.userMname ? user.userMname[0] + '.' : ''} ${user.userLname}` : 'Unknown',
      class: user?.userClass || {},
    };
  });
  res.json(result);
});

// Approve or update enrollment status
router.patch('/:subjectId/enrolled/:studentId', async (req, res) => {
  const { subjectId, studentId } = req.params;
  const { status } = req.body;
  await mongoose.connection.collection('subject_tbl').updateOne(
    { _id: new mongoose.Types.ObjectId(subjectId), "enrolledStudents.studentId": studentId },
    { $set: { "enrolledStudents.$.status": status } }
  );
  res.json({ success: true });
});

// PATCH /api/subjects/:id - Update subject code or name
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { code, name } = req.body;
  const update = {};
  if (code) update.code = code;
  if (name) update.name = name;
  if (!code && !name) return res.status(400).json({ message: 'Nothing to update' });
  await mongoose.connection.collection('subject_tbl').updateOne(
    { _id: new mongoose.Types.ObjectId(id) },
    { $set: update }
  );
  res.json({ success: true });
});

// Remove a student from a subject
router.delete('/:subjectId/enrolled/:studentId', async (req, res) => {
  const { subjectId, studentId } = req.params;
  await mongoose.connection.collection('subject_tbl').updateOne(
    { _id: new mongoose.Types.ObjectId(subjectId) },
    { $pull: { enrolledStudents: { studentId } } }
  );
  res.json({ success: true });
});

// GET /api/subjects/student/:studentId/classes
router.get('/student/:studentId/classes', async (req, res) => {
  const { studentId } = req.params;
  // Only return subjects where the student is enrolled
  const subjects = await mongoose.connection.collection('subject_tbl').find({
    'enrolledStudents': { $elemMatch: { studentId, status: 'enrolled' } }
  }).toArray();

  // Add a top-level status property for the current student
  const result = subjects.map(subject => {
    const enrollment = subject.enrolledStudents.find(e => e.studentId === studentId);
    return {
      ...subject,
      status: enrollment ? enrollment.status : undefined
    };
  });

  res.json(result);
});

// GET /api/subjects/student/:studentId/all - subjects where the student has any status (pending or enrolled)
router.get('/student/:studentId/all', async (req, res) => {
  const { studentId } = req.params;
  try {
    const subjects = await mongoose.connection.collection('subject_tbl').find({
      'enrolledStudents.studentId': studentId
    }).toArray();

    const result = subjects.map(subject => {
      const enrollment = (subject.enrolledStudents || []).find(e => String(e.studentId) === String(studentId));
      return {
        ...subject,
        status: enrollment ? enrollment.status : undefined
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/subjects/join-by-code - student joins by class code (pending)
router.post('/join-by-code', async (req, res) => {
  try {
    const { code, studentId } = req.body || {};
    if (!code || !studentId) return res.status(400).json({ message: 'code and studentId are required' });

    const subjects = mongoose.connection.collection('subject_tbl');
    const subject = await subjects.findOne({ code });
    if (!subject) return res.status(404).json({ message: 'Subject not found' });

    const existing = (subject.enrolledStudents || []).find(s => String(s.studentId) === String(studentId));
    if (existing) {
      return res.status(200).json({ message: 'Already joined or pending', status: existing.status || 'pending', subjectId: subject._id });
    }

    await subjects.updateOne(
      { _id: subject._id },
      { $push: { enrolledStudents: { studentId: String(studentId), status: 'pending' } } }
    );

    const updated = await subjects.findOne({ _id: subject._id });
    res.json({ message: 'Join request submitted (pending approval)', subject: updated });
  } catch (err) {
    res.status(500).json({ message: 'Failed to join class' });
  }
});

// GET /api/subjects/:id - Get subject info by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const subject = await mongoose.connection.collection('subject_tbl').findOne({ _id: new mongoose.Types.ObjectId(id) });
    if (!subject) return res.status(404).json({ message: 'Subject not found.' });
    res.json(subject);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;