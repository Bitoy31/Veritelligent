const FlashcardAttempt = require('../models/FlashcardAttempt');
const FlashcardTask = require('../models/FlashcardTask');
const GameSession = require('../models/GameSession');
const User = require('../models/User');

/**
 * GET /api/flashcard/analytics/:sessionId
 * Returns comprehensive analytics for a flashcard session
 */
async function getFlashcardAnalytics(req, res) {
  try {
    const { sessionId } = req.params;
    console.log('📊 Fetching flashcard analytics for session:', sessionId);

    // Fetch session
    const session = await GameSession.findById(sessionId)
      .populate('taskId', 'title')
      .populate('subjectId', 'code name')
      .populate('teacherId', 'userFname userLname');

    if (!session) {
      console.log('❌ Session not found:', sessionId);
      return res.status(404).json({ error: 'Session not found' });
    }

    console.log('✅ Session found:', {
      id: session._id,
      gameType: session.gameType,
      taskId: session.taskId,
      status: session.status
    });

    // Fetch task for question details
    const task = await FlashcardTask.findById(session.taskId);
    if (!task) {
      console.log('❌ Task not found:', session.taskId);
      return res.status(404).json({ error: 'Task not found' });
    }

    console.log('✅ Task found:', task.title, 'with', task.questions?.length || 0, 'questions');

    // Fetch all attempts for this session
    const attempts = await FlashcardAttempt.find({ sessionId })
      .populate('studentId', 'userFname userLname userName')
      .populate('helperId', 'userFname userLname userName')
      .sort({ createdAt: 1 });

    console.log('✅ Found', attempts.length, 'attempts for this session');

    // Calculate session duration
    const startedAt = session.startedAt ? new Date(session.startedAt) : null;
    const endedAt = session.endedAt ? new Date(session.endedAt) : null;
    const durationMinutes = startedAt && endedAt 
      ? Math.round((endedAt - startedAt) / 60000) 
      : null;

    // Session metadata
    const metadata = {
      sessionId: session._id,
      roomCode: session.roomCode,
      taskTitle: task.title,
      subjectLabel: `${session.subjectId.code} - ${session.subjectId.name}`,
      teacher: `${session.teacherId.userFname} ${session.teacherId.userLname}`,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      durationMinutes,
      status: session.status
    };

    // Calculate summary statistics
    const uniqueStudents = new Set(attempts.map(a => a.studentId._id.toString()));
    const totalQuestions = attempts.length;
    const correctAnswers = attempts.filter(a => a.isCorrect).length;
    const lifeCardsUsed = {
      callFriend: attempts.filter(a => a.lifeCardUsed === 'call_friend').length,
      hint: attempts.filter(a => a.lifeCardUsed === 'hint').length,
      redraw: attempts.filter(a => a.lifeCardUsed === 'redraw').length
    };

    const summary = {
      totalStudents: uniqueStudents.size,
      totalQuestions,
      correctAnswers,
      incorrectAnswers: totalQuestions - correctAnswers,
      accuracyPct: totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0,
      lifeCardsUsed
    };

    // Per-student statistics
    const studentStats = {};
    
    for (const attempt of attempts) {
      const studentId = attempt.studentId._id.toString();
      if (!studentStats[studentId]) {
        studentStats[studentId] = {
          studentId,
          studentName: `${attempt.studentId.userFname} ${attempt.studentId.userLname}`,
          userName: attempt.studentId.userName,
          turnsTaken: 0,
          correctAnswers: 0,
          incorrectAnswers: 0,
          totalPoints: 0,
          lifeCardsUsed: {
            callFriend: 0,
            hint: 0,
            redraw: 0
          },
          avgTimeSec: 0,
          totalTimeSec: 0,
          helpedOthers: 0,
          helpedCorrectly: 0
        };
      }

      const student = studentStats[studentId];
      student.turnsTaken++;
      if (attempt.isCorrect) student.correctAnswers++;
      else student.incorrectAnswers++;
      student.totalPoints += attempt.pointsEarned || 0;
      
      if (attempt.lifeCardUsed) {
        // Map snake_case to camelCase
        const cardMap = {
          'call_friend': 'callFriend',
          'hint': 'hint',
          'redraw': 'redraw'
        };
        const cardKey = cardMap[attempt.lifeCardUsed];
        if (cardKey) {
          student.lifeCardsUsed[cardKey]++;
        }
      }
      
      if (attempt.timeTakenSec) {
        student.totalTimeSec += attempt.timeTakenSec;
      }
    }

    // Calculate helper stats
    for (const attempt of attempts) {
      if (attempt.helperId) {
        const helperId = attempt.helperId._id.toString();
        if (!studentStats[helperId]) {
          studentStats[helperId] = {
            studentId: helperId,
            studentName: `${attempt.helperId.userFname} ${attempt.helperId.userLname}`,
            userName: attempt.helperId.userName,
            turnsTaken: 0,
            correctAnswers: 0,
            incorrectAnswers: 0,
            totalPoints: 0,
            lifeCardsUsed: { callFriend: 0, hint: 0, redraw: 0 },
            avgTimeSec: 0,
            totalTimeSec: 0,
            helpedOthers: 0,
            helpedCorrectly: 0
          };
        }
        
        studentStats[helperId].helpedOthers++;
        if (attempt.helperCorrect) {
          studentStats[helperId].helpedCorrectly++;
          studentStats[helperId].totalPoints += attempt.helperPointsEarned || 0;
        } else {
          studentStats[helperId].totalPoints -= (attempt.helperPointsEarned || 0);
        }
      }
    }

    // Calculate average times and convert to array
    const studentParticipation = Object.values(studentStats).map(s => {
      s.avgTimeSec = s.turnsTaken > 0 && s.totalTimeSec > 0
        ? Math.round(s.totalTimeSec / s.turnsTaken)
        : null;
      delete s.totalTimeSec;
      return s;
    }).sort((a, b) => b.totalPoints - a.totalPoints);

    // Per-question statistics
    const questionStats = {};
    
    for (const attempt of attempts) {
      const qIdx = attempt.questionIndex;
      if (!questionStats[qIdx]) {
        const question = task.questions[qIdx];
        questionStats[qIdx] = {
          questionIndex: qIdx,
          questionText: question ? question.text : 'Unknown',
          questionType: question ? question.type : 'unknown',
          points: question ? question.points : 0,
          totalAttempts: 0,
          correctAttempts: 0,
          incorrectAttempts: 0,
          accuracyPct: 0,
          avgTimeSec: 0,
          totalTimeSec: 0,
          lifeCardsUsed: {
            callFriend: 0,
            hint: 0,
            redraw: 0
          }
        };
      }

      const qStat = questionStats[qIdx];
      qStat.totalAttempts++;
      if (attempt.isCorrect) qStat.correctAttempts++;
      else qStat.incorrectAttempts++;
      
      if (attempt.timeTakenSec) {
        qStat.totalTimeSec += attempt.timeTakenSec;
      }
      
      if (attempt.lifeCardUsed) {
        qStat.lifeCardsUsed[attempt.lifeCardUsed]++;
      }
    }

    // Calculate question averages
    const questionBreakdown = Object.values(questionStats).map(q => {
      q.accuracyPct = q.totalAttempts > 0 
        ? Math.round((q.correctAttempts / q.totalAttempts) * 100) 
        : 0;
      q.avgTimeSec = q.totalAttempts > 0 && q.totalTimeSec > 0
        ? Math.round(q.totalTimeSec / q.totalAttempts)
        : null;
      delete q.totalTimeSec;
      return q;
    }).sort((a, b) => a.questionIndex - b.questionIndex);

    // Call a Friend success rate
    const callFriendAttempts = attempts.filter(a => a.lifeCardUsed === 'call_friend');
    const callFriendSuccessful = callFriendAttempts.filter(a => a.helperCorrect).length;
    const callFriendSuccessRate = callFriendAttempts.length > 0
      ? Math.round((callFriendSuccessful / callFriendAttempts.length) * 100)
      : null;

    // Response
    const responseData = {
      session: metadata,
      summary: {
        ...summary,
        callFriendSuccessRate
      },
      studentParticipation,
      questionBreakdown
    };

    console.log('✅ Sending analytics response with', studentParticipation.length, 'students and', questionBreakdown.length, 'questions');
    res.json(responseData);

  } catch (error) {
    console.error('❌ Error fetching flashcard analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics', details: error.message });
  }
}

module.exports = {
  getFlashcardAnalytics
};

