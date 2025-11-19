const express = require('express');
const router = express.Router();
const FlashcardTask = require('../models/FlashcardTask');
const GameSession = require('../models/GameSession');
const { getFlashcardAnalytics } = require('../controllers/flashcardAnalyticsController');

// GET /api/flashcard/tasks - List all flashcard tasks
router.get('/tasks', async (req, res) => {
  try {
    const { teacherId, status, subjectId } = req.query;
    const filter = {};
    
    if (teacherId) filter.teacherId = teacherId;
    if (status) filter.status = status;
    if (subjectId) filter.subjectId = subjectId;

    console.log('Fetching flashcard tasks with filter:', filter);
    const tasks = await FlashcardTask.find(filter).sort({ createdAt: -1 });
    console.log('Found tasks:', tasks.length);

    res.json(tasks);
  } catch (error) {
    console.error('Error fetching flashcard tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks', details: error.message });
  }
});

// GET /api/flashcard/tasks/:id - Get single task
router.get('/tasks/:id', async (req, res) => {
  try {
    const task = await FlashcardTask.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(task);
  } catch (error) {
    console.error('Error fetching flashcard task:', error);
    res.status(500).json({ error: 'Failed to fetch task', details: error.message });
  }
});

// POST /api/flashcard/tasks - Create new task
router.post('/tasks', async (req, res) => {
  try {
    console.log('Received flashcard task creation request:', req.body);
    const { subjectId, teacherId, title, description, questions, settings, status } = req.body;

    // Validate required fields
    if (!subjectId || !teacherId || !title || !questions || questions.length === 0) {
      console.log('Validation failed:', { subjectId, teacherId, title, questionsCount: questions?.length });
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate questions
    for (const q of questions) {
      if (!q.text || !q.type || q.points == null) {
        return res.status(400).json({ error: 'Invalid question format' });
      }
      
      if (q.type === 'multiple_choice') {
        if (!q.options || q.options.length < 2 || q.options.length > 4) {
          return res.status(400).json({ error: 'Multiple choice questions must have 2-4 options' });
        }
        const correctCount = q.options.filter(o => o.isCorrect).length;
        if (correctCount !== 1) {
          return res.status(400).json({ error: 'Multiple choice questions must have exactly one correct answer' });
        }
      } else if (q.type === 'text_input') {
        if (!q.acceptedAnswers || q.acceptedAnswers.trim() === '') {
          return res.status(400).json({ error: 'Text input questions must have accepted answers' });
        }
      }
    }

    const task = new FlashcardTask({
      subjectId,
      teacherId,
      title,
      description,
      questions,
      settings: settings || {},
      status: status || 'draft'
    });

    await task.save();
    console.log('Task created successfully:', task._id);
    
    res.status(201).json(task);
  } catch (error) {
    console.error('Error creating flashcard task:', error);
    res.status(500).json({ error: 'Failed to create task', details: error.message });
  }
});

// PUT /api/flashcard/tasks/:id - Update task
router.put('/tasks/:id', async (req, res) => {
  try {
    console.log('Updating flashcard task:', req.params.id, 'with data:', req.body);
    const { title, description, questions, settings, status } = req.body;

    const task = await FlashcardTask.findById(req.params.id);
    if (!task) {
      console.log('Task not found:', req.params.id);
      return res.status(404).json({ error: 'Task not found' });
    }

    // Validate questions if provided
    if (questions) {
      for (const q of questions) {
        if (!q.text || !q.type || q.points == null) {
          return res.status(400).json({ error: 'Invalid question format' });
        }
        
        if (q.type === 'multiple_choice') {
          if (!q.options || q.options.length < 2 || q.options.length > 4) {
            return res.status(400).json({ error: 'Multiple choice questions must have 2-4 options' });
          }
          const correctCount = q.options.filter(o => o.isCorrect).length;
          if (correctCount !== 1) {
            return res.status(400).json({ error: 'Multiple choice questions must have exactly one correct answer' });
          }
        } else if (q.type === 'text_input') {
          if (!q.acceptedAnswers || q.acceptedAnswers.trim() === '') {
            return res.status(400).json({ error: 'Text input questions must have accepted answers' });
          }
        }
      }
    }

    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (questions !== undefined) task.questions = questions;
    if (settings !== undefined) task.settings = { ...task.settings, ...settings };
    if (status !== undefined) task.status = status;

    await task.save();
    console.log('Task updated successfully:', task._id);
    
    res.json(task);
  } catch (error) {
    console.error('Error updating flashcard task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// DELETE /api/flashcard/tasks/:id - Delete task
router.delete('/tasks/:id', async (req, res) => {
  try {
    const task = await FlashcardTask.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check if there are active sessions for this task
    const activeSessions = await GameSession.find({
      taskId: req.params.id,
      status: 'active'
    });

    if (activeSessions.length > 0) {
      return res.status(400).json({ error: 'Cannot delete task with active sessions' });
    }

    await FlashcardTask.findByIdAndDelete(req.params.id);
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting flashcard task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// GET /api/flashcard/analytics/:sessionId - Get session analytics
router.get('/analytics/:sessionId', getFlashcardAnalytics);

module.exports = router;

