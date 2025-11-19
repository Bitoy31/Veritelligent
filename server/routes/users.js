const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { ObjectId } = require('mongodb');

// Get user by ID
router.get('/users/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const user = await mongoose.connection
            .collection('users_tbl')
            .findOne({ _id: new ObjectId(userId) });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch user data' });
    }
});

// Update user profile
router.put('/users/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const updateData = { ...req.body };
        delete updateData._id;

        const result = await mongoose.connection
            .collection('users_tbl')
            .findOneAndUpdate(
                { _id: new ObjectId(userId) },
                { $set: updateData },
                { returnDocument: 'after' }
            );

        if (!result) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: 'Failed to update user' });
    }
});

// Get students for a teacher (enrolled in their subjects)
router.get('/students', async (req, res) => {
    try {
        const { teacherId } = req.query;
        if (!teacherId) {
            return res.status(400).json({ message: 'teacherId is required' });
        }

        // Get subjects taught by this teacher
        const subjects = await mongoose.connection
            .collection('subject_tbl')
            .find({ teacherId: new ObjectId(teacherId) })
            .toArray();

        const subjectIds = subjects.map(s => s._id);

        // Get students enrolled in these subjects
        const enrolledStudents = await mongoose.connection
            .collection('subject_tbl')
            .aggregate([
                { $match: { _id: { $in: subjectIds } } },
                { $unwind: '$enrolledStudents' },
                { $match: { 'enrolledStudents.status': 'enrolled' } },
                { $group: { _id: '$enrolledStudents.studentId' } }
            ]).toArray();

        const studentIds = enrolledStudents.map(s => s._id);

        // Get student details
        const students = await mongoose.connection
            .collection('users_tbl')
            .find({ 
                _id: { $in: studentIds.map(id => new ObjectId(id)) },
                userRole: 'student'
            })
            .project({ _id: 1, userFname: 1, userLname: 1, userName: 1 })
            .toArray();

        res.json(students);
    } catch (error) {
        console.error('Failed to fetch students:', error);
        res.status(500).json({ message: 'Failed to fetch students' });
    }
});

module.exports = router;