const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Quiz = require('../models/Quiz');

// Get quizzes for a specific student (only from enrolled subjects)
router.get('/student/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;

    // Get subjects where the student is enrolled (not pending)
    const enrolledSubjects = await mongoose.connection
      .collection('subject_tbl')
      .find({
        'enrolledStudents.studentId': studentId,
        'enrolledStudents.status': 'enrolled'
      })
      .toArray();

    // Extract subject IDs
    const enrolledSubjectIds = enrolledSubjects.map(subject => subject._id);

    // Get published quizzes for enrolled subjects only
    const quizzes = await Quiz.find({ 
      status: 'published',
      subjectId: { $in: enrolledSubjectIds }
    })
    .select('-questions.options.isCorrect') // Don't send correct answers
    .sort({ lastModified: -1 });

    res.json(quizzes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get available quizzes for a student
router.get('/student/available-quizzes/:studentId', async (req, res) => {
  try {
    const quizzes = await Quiz.find({ 
      status: 'published'
    })
    .select('-questions.options.isCorrect') // Don't send correct answers
    .sort({ lastModified: -1 });
    res.json(quizzes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all quizzes for a teacher
router.get('/teacher/:teacherId', async (req, res) => {
  try {
    const quizzes = await Quiz.find({ teacherId: req.params.teacherId })
      .select('-questions.options.isCorrect') // Don't send correct answers
      .sort({ lastModified: -1 });
    res.json(quizzes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get a single quiz by ID
router.get('/:id', async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }
    res.json(quiz);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a new quiz
router.post('/', async (req, res) => {
  try {
    const quiz = new Quiz(req.body);
    const savedQuiz = await quiz.save();
    res.status(201).json(savedQuiz);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update a quiz
router.put('/:id', async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }
    
    // Don't allow updating certain fields if quiz is published
    if (quiz.status === 'published') {
      const protectedFields = ['questions', 'settings.timeLimit', 'settings.passingScore'];
      for (const field of protectedFields) {
        if (field.includes('.')) {
          const [parent, child] = field.split('.');
          if (req.body[parent]?.[child] !== undefined) {
            return res.status(400).json({ 
              message: `Cannot modify ${field} after quiz is published` 
            });
          }
        } else if (req.body[field] !== undefined) {
          return res.status(400).json({ 
            message: `Cannot modify ${field} after quiz is published` 
          });
        }
      }
    }

    Object.assign(quiz, req.body);
    const updatedQuiz = await quiz.save();
    res.json(updatedQuiz);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete a quiz
router.delete('/:id', async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }
    
    if (quiz.status === 'published') {
      return res.status(400).json({ 
        message: 'Cannot delete a published quiz' 
      });
    }
    
    await Quiz.findByIdAndDelete(req.params.id);
    res.json({ message: 'Quiz deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update quiz status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['draft', 'published', 'closed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    // Additional validation for publishing
    if (status === 'published') {
      if (quiz.questions.length === 0) {
        return res.status(400).json({ 
          message: 'Cannot publish quiz with no questions' 
        });
      }
      
      // Validate all questions have at least one correct answer
      const invalidQuestions = quiz.questions.filter(q => 
        !q.options.some(o => o.isCorrect)
      );
      
      if (invalidQuestions.length > 0) {
        return res.status(400).json({ 
          message: 'All questions must have at least one correct answer' 
        });
      }
    }

    quiz.status = status;
    await quiz.save();
    res.json(quiz);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router; 