const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const GameSession = require('../models/GameSession');
const GameAttempt = require('../models/GameAttempt');
const BuzzerBattleAttempt = require('../models/BuzzerBattleAttempt');

// Simple connection check
const checkConnection = () => {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database not connected');
  }
};

// GET /api/analytics/sessions - Get sessions for analytics
router.get('/sessions', async (req, res) => {
  try {
    checkConnection();
    const { teacherId, subjectId, taskId, status, sessionIds } = req.query;
    
    let filter = {};
    if (teacherId) filter.teacherId = teacherId;
    if (subjectId) filter.subjectId = subjectId;
    if (taskId) filter.taskId = taskId;
    if (status) filter.status = status;
    if (sessionIds) {
      const idsArray = Array.isArray(sessionIds)
        ? sessionIds
        : String(sessionIds).split(',').map(s => s.trim()).filter(Boolean);
      const validObjectIds = idsArray
        .filter(id => mongoose.Types.ObjectId.isValid(id))
        .map(id => new mongoose.Types.ObjectId(id));
      if (validObjectIds.length === 0) {
        return res.json([]);
      }
      filter._id = { $in: validObjectIds };
    }
    
    const sessions = await GameSession.find(filter)
      .sort({ startedAt: -1 })
      .lean();
    
    // Manually populate taskId and subjectId since models might not exist
    const populatedSessions = await Promise.all(sessions.map(async (session) => {
      try {
        // Get task details based on gameType
        let task = null;
        const taskId = new mongoose.Types.ObjectId(session.taskId);
        
        // Determine which collection to query based on gameType
        let taskCollection = 'quizzes'; // default
        if (session.gameType === 'grid_quest') {
          taskCollection = 'gridquesttasks';
        } else if (session.gameType === 'flashcard') {
          taskCollection = 'flashcardtasks';
        } else if (session.gameType === 'buzzer_battle') {
          taskCollection = 'buzzerbattletasks';
        }
        
        try {
          task = await mongoose.connection.collection(taskCollection).findOne(
            { _id: taskId },
            { title: 1, taskTopic: 1, taskName: 1, name: 1 }
          );
        } catch (taskErr) {
          console.error(`Error fetching task from ${taskCollection}:`, taskErr);
        }
        
        // Get subject details
        const subject = await mongoose.connection.collection('subject_tbl').findOne(
          { _id: new mongoose.Types.ObjectId(session.subjectId) },
          { name: 1, code: 1 }
        );
        
        // Extract task title from various possible fields
        const taskTitle = task ? (task.title || task.taskTopic || task.taskName || task.name || 'Untitled Task') : null;
        
        return {
          ...session,
          taskId: task && taskTitle ? { _id: task._id, title: taskTitle } : session.taskId,
          subjectId: subject ? { _id: subject._id, name: subject.name, code: subject.code } : session.subjectId
        };
      } catch (err) {
        console.error('Error populating session:', err);
        return session;
      }
    }));
    
    res.json(populatedSessions);
  } catch (err) {
    console.error('GET /api/analytics/sessions error:', err);
    if (err.message === 'Database not connected') {
      res.status(503).json({ message: 'Database service unavailable' });
    } else {
      res.status(500).json({ message: 'Failed to fetch sessions' });
    }
  }
});

// POST /api/sessions - Create a new game session
router.post('/sessions', async (req, res) => {
  try {
    checkConnection();
    const payload = req.body || {};
    
    // Validate required fields
    const required = ['taskId', 'subjectId', 'teacherId', 'category', 'gameType'];
    for (const k of required) {
      if (!payload[k]) {
        return res.status(400).json({ message: `${k} is required` });
      }
    }
    
    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(payload.taskId)) {
      return res.status(400).json({ message: 'Invalid taskId format' });
    }
    if (!mongoose.Types.ObjectId.isValid(payload.subjectId)) {
      return res.status(400).json({ message: 'Invalid subjectId format' });
    }
    if (!mongoose.Types.ObjectId.isValid(payload.teacherId)) {
      return res.status(400).json({ message: 'Invalid teacherId format' });
    }

    // Normalize and apply defaults
    const now = new Date();
    const roomCode = (payload.roomCode || '').toUpperCase();
    const baseDoc = {
      taskId: payload.taskId,
      subjectId: payload.subjectId,
      teacherId: payload.teacherId,
      category: payload.category,
      gameType: payload.gameType,
      roomCode,
      settingsSnapshot: payload.settingsSnapshot || {},
    };

    // Ensure only one active session per roomCode: upsert if one exists
    let doc = await GameSession.findOneAndUpdate(
      { roomCode, status: { $ne: 'ended' } },
      { 
        ...baseDoc,
        status: 'active',
        startedAt: now,
        endedAt: null,
      },
      { new: true }
    );

    if (!doc) {
      // No active session for this room; create a new one
      doc = await GameSession.create({
        ...baseDoc,
        status: 'active',
        startedAt: now,
      });
      console.log('Session created successfully:', doc._id);
    } else {
      console.log('Reusing existing active session for room', roomCode, '->', doc._id.toString());
    }

    // Optional cleanup: discard any ended sessions with the same roomCode
    try {
      await GameSession.deleteMany({ roomCode, _id: { $ne: doc._id }, status: { $ne: 'active' } });
    } catch {}

    res.status(201).json(doc);
  } catch (err) {
    console.error('POST /api/sessions error:', err);
    if (err.message === 'Database not connected') {
      res.status(503).json({ message: 'Database service unavailable' });
    } else {
      res.status(500).json({ message: 'Failed to create session' });
    }
  }
});

// PATCH /api/sessions/:id - Update an existing session
router.patch('/sessions/:id', async (req, res) => {
  try {
    checkConnection();
    const { id } = req.params;
    const updates = req.body || {};
    
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid session ID' });
    }
    
    // Update the session
    const updated = await GameSession.findByIdAndUpdate(
      id, 
      updates, 
      { new: true, runValidators: true }
    );
    
    if (!updated) {
      return res.status(404).json({ message: 'Session not found' });
    }
    
    res.json(updated);
  } catch (err) {
    console.error('PATCH /api/sessions/:id error:', err);
    if (err.message === 'Database not connected') {
      res.status(503).json({ message: 'Database service unavailable' });
    } else {
      res.status(500).json({ message: 'Failed to update session' });
    }
  }
});

// GET /api/analytics/attempts - Get attempts for analytics
router.get('/attempts', async (req, res) => {
  try {
    checkConnection();
    const { sessionId, taskId, subjectId, studentId } = req.query;
    
    console.log('[GET /api/analytics/attempts] Query params:', { sessionId, taskId, subjectId, studentId });
    
    let filter = {};
    if (sessionId) {
      if (!mongoose.Types.ObjectId.isValid(sessionId)) {
        return res.json([]);
      }
      filter.sessionId = new mongoose.Types.ObjectId(sessionId);
    }
    if (taskId) {
      if (!mongoose.Types.ObjectId.isValid(taskId)) {
        return res.json([]);
      }
      filter.taskId = new mongoose.Types.ObjectId(taskId);
    }
    if (subjectId) {
      if (!mongoose.Types.ObjectId.isValid(subjectId)) {
        return res.json([]);
      }
      filter.subjectId = new mongoose.Types.ObjectId(subjectId);
    }
    if (studentId) {
      if (!mongoose.Types.ObjectId.isValid(studentId)) {
        return res.json([]);
      }
      filter.studentId = new mongoose.Types.ObjectId(studentId);
    }
    
    console.log('[GET /api/analytics/attempts] Filter:', JSON.stringify(filter, null, 2));
    
    const attempts = await GameAttempt.find(filter)
      .sort({ startedAt: -1 })
      .lean();
    
    console.log(`[GET /api/analytics/attempts] Found ${attempts.length} attempts`);
    
    // Manually populate studentId, taskId, and subjectId
    const populatedAttempts = await Promise.all(attempts.map(async (attempt) => {
      try {
        // Get student details
        let student = null;
        if (attempt.studentId && mongoose.Types.ObjectId.isValid(attempt.studentId)) {
          student = await mongoose.connection.collection('users_tbl').findOne(
            { _id: new mongoose.Types.ObjectId(attempt.studentId) },
            { userFname: 1, userLname: 1 }
          );
        }
        
        // Get task details - check gameType to determine collection
        let task = null;
        if (attempt.taskId && mongoose.Types.ObjectId.isValid(attempt.taskId)) {
          // Determine which collection to query based on gameType
          let taskCollection = 'quizzes'; // default
          if (attempt.gameType === 'grid_quest') {
            taskCollection = 'gridquesttasks';
          } else if (attempt.gameType === 'flashcard') {
            taskCollection = 'flashcardtasks';
          } else if (attempt.gameType === 'buzzer_battle') {
            taskCollection = 'buzzerbattletasks';
          }
          
          try {
            task = await mongoose.connection.collection(taskCollection).findOne(
              { _id: new mongoose.Types.ObjectId(attempt.taskId) },
              { title: 1, taskTopic: 1, taskName: 1, name: 1 }
            );
          } catch (taskErr) {
            console.error(`Error fetching task from ${taskCollection}:`, taskErr);
          }
        }
        
        // Get subject details
        let subject = null;
        if (attempt.subjectId && mongoose.Types.ObjectId.isValid(attempt.subjectId)) {
          subject = await mongoose.connection.collection('subject_tbl').findOne(
            { _id: new mongoose.Types.ObjectId(attempt.subjectId) },
            { name: 1, code: 1 }
          );
        }
        
        // Extract task title from various possible fields
        const taskTitle = task ? (task.title || task.taskTopic || task.taskName || task.name || 'Untitled Task') : null;
        
        return {
          ...attempt,
          studentId: student ? { _id: student._id, userFname: student.userFname, userLname: student.userLname } : attempt.studentId,
          taskId: task && taskTitle ? { _id: task._id, title: taskTitle } : attempt.taskId,
          subjectId: subject ? { _id: subject._id, name: subject.name, code: subject.code } : attempt.subjectId
        };
      } catch (err) {
        console.error('Error populating attempt:', err);
        return attempt;
      }
    }));
    
    res.json(populatedAttempts);
  } catch (err) {
    console.error('GET /api/analytics/attempts error:', err);
    console.error('Error stack:', err.stack);
    if (err.message === 'Database not connected') {
      res.status(503).json({ message: 'Database service unavailable' });
    } else {
      res.status(500).json({ 
        message: 'Failed to fetch attempts',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  }
});

// POST /api/analytics/attempts - Create a new quiz attempt
router.post('/attempts', async (req, res) => {
  try {
    checkConnection();
    const payload = req.body || {};
    
    // Validate required fields
    const required = ['taskId', 'studentId', 'subjectId', 'sessionId', 'category', 'gameType'];
    for (const k of required) {
      if (!payload[k]) {
        return res.status(400).json({ message: `${k} is required` });
      }
    }
    
    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(payload.taskId)) {
      return res.status(400).json({ message: 'Invalid taskId format' });
    }
    if (!mongoose.Types.ObjectId.isValid(payload.sessionId)) {
      return res.status(400).json({ message: 'Invalid sessionId format' });
    }
    if (!mongoose.Types.ObjectId.isValid(payload.subjectId)) {
      return res.status(400).json({ message: 'Invalid subjectId format' });
    }
    if (!mongoose.Types.ObjectId.isValid(payload.studentId)) {
      return res.status(400).json({ message: 'Invalid studentId format' });
    }
    
    // Set defaults
    payload.startedAt = payload.startedAt || new Date();
    payload.status = payload.status || 'in_progress';
    payload.totalScore = payload.totalScore || 0;
    payload.bonusPoints = payload.bonusPoints || 0;
    payload.finalScore = payload.finalScore || 0;
    payload.answers = payload.answers || [];
    
    console.log('Creating attempt with payload:', payload);
    
    const doc = await GameAttempt.create(payload);
    console.log('Attempt created successfully:', doc._id);
    
    res.status(201).json(doc);
  } catch (err) {
    console.error('POST /api/analytics/attempts error:', err);
    if (err.message === 'Database not connected') {
      res.status(503).json({ message: 'Database service unavailable' });
    } else {
      res.status(500).json({ message: 'Failed to create attempt' });
    }
  }
});

// PATCH /api/analytics/attempts/:id - Update an existing attempt
router.patch('/attempts/:id', async (req, res) => {
  try {
    checkConnection();
    const { id } = req.params;
    const incoming = req.body || {};
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid attempt ID' });
    }
    
    // Fetch the current attempt for context-driven computation
    const attempt = await GameAttempt.findById(id);
    if (!attempt) {
      return res.status(404).json({ message: 'Attempt not found' });
    }

    // Merge answers: prefer incoming.answers if provided
    const answers = Array.isArray(incoming.answers) ? incoming.answers : attempt.answers || [];

    // Derive quiz-based analytics if possible
    let totalQuestions = 0;
    let totalPointsPossible = 0;
    let recalculatedAnswers = [];
    let correctCount = 0;
    try {
      if (attempt.taskId) {
        const quiz = await mongoose.connection.collection('quizzes').findOne({ _id: new mongoose.Types.ObjectId(attempt.taskId) });
        const questions = Array.isArray(quiz?.questions) ? quiz.questions : [];
        totalQuestions = questions.length;
        totalPointsPossible = questions.reduce((sum, q) => sum + (Number(q?.points) || 0), 0);

        recalculatedAnswers = answers.map((ans) => {
          const q = questions[ans.questionIndex] || {};
          const qPoints = Number(q?.points) || 0;
          const opts = Array.isArray(q?.options) ? q.options : [];
          const correctIndices = opts.map((o, idx) => (o?.isCorrect ? idx : -1)).filter((x) => x >= 0);
          const isCorrect = correctIndices.includes(ans.selectedOption);
          const pointsEarned = isCorrect ? qPoints : 0;
          if (isCorrect) correctCount += 1;
          return {
            questionIndex: ans.questionIndex,
            selectedOption: ans.selectedOption,
            textAnswer: ans.textAnswer,
            isCorrect,
            timeTakenSec: Number(ans.timeTakenSec) || Number(ans.timeTaken) || 0,
            pointsEarned
          };
        });
      }
    } catch (calcErr) {
      // Fallback: trust incoming answers as-is if quiz fetch fails
      console.warn('Attempt scoring fallback (quiz fetch failed):', calcErr?.message);
      recalculatedAnswers = answers.map((ans) => ({
        questionIndex: ans.questionIndex,
        selectedOption: ans.selectedOption,
        textAnswer: ans.textAnswer,
        isCorrect: !!ans.isCorrect,
        timeTakenSec: Number(ans.timeTakenSec) || Number(ans.timeTaken) || 0,
        pointsEarned: Number(ans.pointsEarned) || 0,
      }));
      correctCount = recalculatedAnswers.filter(a => a.isCorrect).length;
    }

    // Compute totals
    const totalScore = recalculatedAnswers.reduce((sum, a) => sum + (Number(a.pointsEarned) || 0), 0);
    const bonusPoints = Number(incoming.bonusPoints ?? attempt.bonusPoints ?? 0);
    const finalScore = totalScore + bonusPoints;
    const accuracyPct = (totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : undefined);

    // Compute time spent if not provided
    const now = new Date();
    const startedAt = attempt.startedAt ? new Date(attempt.startedAt) : now;
    const endedAt = incoming.endedAt ? new Date(incoming.endedAt) : (incoming.status === 'completed' ? now : attempt.endedAt);
    const timeSpentSec = Number(incoming.timeSpentSec ?? (endedAt && startedAt ? Math.max(0, Math.round((endedAt - startedAt) / 1000)) : undefined));

    // Prepare update doc: keep unchanged fields intact
    const updateDoc = {
      answers: recalculatedAnswers,
      totalScore,
      bonusPoints,
      finalScore,
      accuracyPct,
      timeSpentSec,
      endedAt,
      status: incoming.status || attempt.status,
    };

    // Ensure scoringPolicy has totalPointsPossible if we could compute it
    if (!attempt.scoringPolicy || typeof attempt.scoringPolicy !== 'object') {
      updateDoc.scoringPolicy = { totalPointsPossible: totalPointsPossible || attempt?.scoringPolicy?.totalPointsPossible || 0 };
    } else if (!attempt.scoringPolicy.totalPointsPossible && totalPointsPossible) {
      updateDoc.scoringPolicy = { ...attempt.scoringPolicy, totalPointsPossible };
    }

    const updated = await GameAttempt.findByIdAndUpdate(id, updateDoc, { new: true, runValidators: true });
    if (!updated) {
      return res.status(404).json({ message: 'Attempt not found' });
    }
    res.json(updated);
  } catch (err) {
    console.error('PATCH /api/analytics/attempts/:id error:', err);
    if (err.message === 'Database not connected') {
      res.status(503).json({ message: 'Database service unavailable' });
    } else {
      res.status(500).json({ message: 'Failed to update attempt' });
    }
  }
});

// GET /api/analytics/leaderboard - Get leaderboard rankings
router.get('/leaderboard', async (req, res) => {
  try {
    checkConnection();
    const { subjectId, category, gameType } = req.query;
    
    if (!subjectId || !mongoose.Types.ObjectId.isValid(subjectId)) {
      return res.status(400).json({ message: 'Valid subjectId is required' });
    }
    
    // Build filter for completed attempts
    const filter = {
      subjectId: new mongoose.Types.ObjectId(subjectId),
      status: 'completed'
    };
    
    if (category && (category === 'solo' || category === 'party')) {
      filter.category = category;
    }
    
    if (gameType && ['quiz', 'grid_quest', 'flashcard', 'buzzer_battle'].includes(gameType)) {
      filter.gameType = gameType;
    }
    
    // Fetch all matching attempts
    const attempts = await GameAttempt.find(filter).lean();
    
    if (attempts.length === 0) {
      return res.json([]);
    }
    
    // Group by studentId
    const studentMap = new Map();
    
    for (const attempt of attempts) {
      let studentId = null;
      if (attempt.studentId) {
        if (mongoose.Types.ObjectId.isValid(attempt.studentId)) {
          studentId = attempt.studentId.toString();
        } else if (typeof attempt.studentId === 'string') {
          studentId = attempt.studentId;
        } else if (attempt.studentId._id) {
          studentId = attempt.studentId._id.toString();
        }
      }
      if (!studentId) continue;
      
      if (!studentMap.has(studentId)) {
        studentMap.set(studentId, {
          studentId,
          attempts: [],
          gameTypeScores: new Map() // Track best score per gameType
        });
      }
      
      const studentData = studentMap.get(studentId);
      studentData.attempts.push(attempt);
      
      // Track best score per gameType
      const gameTypeKey = attempt.gameType;
      const currentBest = studentData.gameTypeScores.get(gameTypeKey) || 0;
      const attemptScore = attempt.finalScore || 0;
      if (attemptScore > currentBest) {
        studentData.gameTypeScores.set(gameTypeKey, attemptScore);
      }
    }
    
    // Calculate scores and aggregate data
    const leaderboardEntries = [];
    
    for (const [studentId, studentData] of studentMap.entries()) {
      let finalScore = 0;
      let totalAccuracy = 0;
      let accuracyCount = 0;
      const gamesPlayed = new Set();
      
      if (gameType) {
        // For specific game type, use best score for that game
        const bestScore = studentData.gameTypeScores.get(gameType) || 0;
        finalScore = bestScore;
        
        // Find best accuracy for this game type
        const gameTypeAttempts = studentData.attempts.filter(a => a.gameType === gameType);
        if (gameTypeAttempts.length > 0) {
          const bestAttempt = gameTypeAttempts.reduce((best, current) => {
            const currentScore = current.finalScore || 0;
            const bestScore = best.finalScore || 0;
            if (currentScore > bestScore) return current;
            if (currentScore === bestScore && (current.accuracyPct || 0) > (best.accuracyPct || 0)) return current;
            return best;
          });
          if (bestAttempt.accuracyPct !== undefined && bestAttempt.accuracyPct !== null) {
            totalAccuracy = bestAttempt.accuracyPct;
            accuracyCount = 1;
          }
        }
        gamesPlayed.add(gameType);
      } else if (category) {
        // For category view, sum best scores for each game type in that category
        const categoryGameTypes = category === 'solo' 
          ? ['quiz', 'flashcard']
          : ['grid_quest', 'buzzer_battle'];
        
        for (const gt of categoryGameTypes) {
          const bestScore = studentData.gameTypeScores.get(gt) || 0;
          finalScore += bestScore;
          if (bestScore > 0) gamesPlayed.add(gt);
        }
        
        // Calculate average accuracy across category games
        const categoryAttempts = studentData.attempts.filter(a => categoryGameTypes.includes(a.gameType));
        for (const att of categoryAttempts) {
          if (att.accuracyPct !== undefined && att.accuracyPct !== null) {
            totalAccuracy += att.accuracyPct;
            accuracyCount++;
          }
        }
        if (accuracyCount > 0) {
          totalAccuracy = totalAccuracy / accuracyCount;
        }
      } else {
        // Overall: sum best scores across all game types
        for (const [gt, score] of studentData.gameTypeScores.entries()) {
          finalScore += score;
          if (score > 0) gamesPlayed.add(gt);
        }
        
        // Calculate average accuracy across all attempts
        for (const att of studentData.attempts) {
          if (att.accuracyPct !== undefined && att.accuracyPct !== null) {
            totalAccuracy += att.accuracyPct;
            accuracyCount++;
          }
        }
        if (accuracyCount > 0) {
          totalAccuracy = totalAccuracy / accuracyCount;
        }
      }
      
      leaderboardEntries.push({
        studentId,
        finalScore,
        accuracyPct: accuracyCount > 0 ? totalAccuracy : undefined,
        gamesPlayed: gamesPlayed.size
      });
    }
    
    // Sort by finalScore desc, then accuracyPct desc
    leaderboardEntries.sort((a, b) => {
      if (b.finalScore !== a.finalScore) {
        return b.finalScore - a.finalScore;
      }
      const aAcc = a.accuracyPct || 0;
      const bAcc = b.accuracyPct || 0;
      return bAcc - aAcc;
    });
    
    // Populate student names and assign ranks
    const populatedEntries = await Promise.all(
      leaderboardEntries.map(async (entry, index) => {
        let student = null;
        if (mongoose.Types.ObjectId.isValid(entry.studentId)) {
          student = await mongoose.connection.collection('users_tbl').findOne(
            { _id: new mongoose.Types.ObjectId(entry.studentId) },
            { userFname: 1, userLname: 1 }
          );
        }
        
        const studentName = student 
          ? `${student.userFname || ''} ${student.userLname || ''}`.trim() || 'Unknown Student'
          : 'Unknown Student';
        
        return {
          rank: index + 1,
          studentId: entry.studentId,
          studentName,
          finalScore: entry.finalScore,
          accuracyPct: entry.accuracyPct,
          gamesPlayed: entry.gamesPlayed
        };
      })
    );
    
    res.json(populatedEntries);
  } catch (err) {
    console.error('GET /api/analytics/leaderboard error:', err);
    if (err.message === 'Database not connected') {
      res.status(503).json({ message: 'Database service unavailable' });
    } else {
      res.status(500).json({ message: 'Failed to fetch leaderboard' });
    }
  }
});

// Debug endpoint to see all data
router.get('/debug', async (req, res) => {
  try {
    checkConnection();
    
    const sessions = await GameSession.find({}).sort({ startedAt: -1 });
    const attempts = await GameAttempt.find({}).sort({ startedAt: -1 });
    
    res.json({
      sessions: {
        count: sessions.length,
        data: sessions
      },
      attempts: {
        count: attempts.length,
        data: attempts
      }
    });
  } catch (err) {
    console.error('GET /api/analytics/debug error:', err);
    res.status(500).json({ message: 'Debug endpoint failed' });
  }
});

// DELETE /api/sessions/bulk - Delete multiple sessions
router.delete('/sessions/bulk', async (req, res) => {
  try {
    checkConnection();
    const { sessionIds } = req.body || {};

    if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
      return res.status(400).json({ message: 'sessionIds array is required' });
    }

    const normalizedIds = sessionIds
      .map((id) => (typeof id === 'string' ? id.trim() : id))
      .filter(Boolean);

    const invalidIds = normalizedIds.filter((id) => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({ message: 'Invalid session IDs provided', invalidIds });
    }

    const sessions = await GameSession.find({ _id: { $in: normalizedIds } }, '_id');
    const foundIds = new Set(sessions.map((s) => s._id.toString()));
    const missingSessionIds = normalizedIds
      .filter((id) => !foundIds.has(id.toString()))
      .map((id) => id.toString());

    if (foundIds.size === 0) {
      return res.status(404).json({ message: 'No matching sessions found to delete' });
    }

    const idsToDelete = Array.from(foundIds);

    const deleteAttemptsResult = await GameAttempt.deleteMany({ sessionId: { $in: idsToDelete } });
    const deleteBuzzerAttemptsResult = await BuzzerBattleAttempt.deleteMany({ sessionId: { $in: idsToDelete } });
    const deleteSessionsResult = await GameSession.deleteMany({ _id: { $in: idsToDelete } });

    res.json({
      message: 'Selected sessions deleted',
      sessionsDeleted: deleteSessionsResult.deletedCount || 0,
      attemptsDeleted: deleteAttemptsResult.deletedCount || 0,
      buzzerAttemptsDeleted: deleteBuzzerAttemptsResult.deletedCount || 0,
      missingSessionIds
    });
  } catch (err) {
    console.error('DELETE /api/sessions/bulk error:', err);
    if (err.message === 'Database not connected') {
      res.status(503).json({ message: 'Database service unavailable' });
    } else {
      res.status(500).json({ message: 'Failed to delete sessions' });
    }
  }
});

// DELETE /api/sessions/:id - Delete a session and its related attempts
router.delete('/sessions/:id', async (req, res) => {
  try {
    checkConnection();
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid session ID' });
    }

    const session = await GameSession.findById(id);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Delete attempts for this session
    const delResult = await GameAttempt.deleteMany({ sessionId: id });
    const buzzerDelResult = await BuzzerBattleAttempt.deleteMany({ sessionId: id });
    // Delete the session itself
    await GameSession.findByIdAndDelete(id);

    res.json({
      message: 'Session and related attempts deleted',
      attemptsDeleted: delResult.deletedCount || 0,
      buzzerAttemptsDeleted: buzzerDelResult.deletedCount || 0
    });
  } catch (err) {
    console.error('DELETE /api/sessions/:id error:', err);
    if (err.message === 'Database not connected') {
      res.status(503).json({ message: 'Database service unavailable' });
    } else {
      res.status(500).json({ message: 'Failed to delete session' });
    }
  }
});

module.exports = router;
