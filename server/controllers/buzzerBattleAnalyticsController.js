const GameSession = require('../models/GameSession');
const BuzzerBattleAttempt = require('../models/BuzzerBattleAttempt');
const BuzzerBattleTask = require('../models/BuzzerBattleTask');
const User = require('../models/User');
const ExcelJS = require('exceljs');

/**
 * Get comprehensive analytics for a Buzzer Battle session
 * GET /api/buzzerbattle/sessions/:sessionId/analytics
 */
exports.getSessionAnalytics = async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Fetch the session
    const session = await GameSession.findById(sessionId)
      .populate('teacherId', 'userFname userLname userEmail')
      .populate('taskId');

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.gameType !== 'buzzer_battle') {
      return res.status(400).json({ error: 'Session is not a Buzzer Battle game' });
    }

    // Fetch the attempt record for this session
    const attempt = await BuzzerBattleAttempt.findOne({ sessionId }).sort({ createdAt: -1 });

    if (!attempt) {
      return res.status(404).json({ error: 'No attempt data found for this session' });
    }

    // Calculate session-level analytics
    const analytics = {
      // Session metadata
      session: {
        sessionId: session._id.toString(),
        roomCode: session.roomCode,
        taskId: session.taskId?._id?.toString(),
        taskTitle: session.taskId?.title || 'Unknown Task',
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        durationMinutes: session.endedAt && session.startedAt
          ? Math.round((new Date(session.endedAt) - new Date(session.startedAt)) / 60000)
          : null,
        status: session.status,
        teacher: session.teacherId
          ? `${session.teacherId.userFname} ${session.teacherId.userLname}`
          : 'Unknown'
      },

      // Game summary
      summary: {
        totalQuestions: attempt.teamBuzzData.length > 0
          ? Math.max(...attempt.teamBuzzData.map(b => b.questionIndex)) + 1
          : 0,
        totalBuzzes: attempt.teamBuzzData.length,
        totalTeams: attempt.teamStats.length,
        totalPlayers: attempt.teamStats.reduce((sum, t) => sum + (t.memberIds?.length || 0), 0),
        stealsAttempted: attempt.teamStats.reduce((sum, t) => sum + (t.stealsAttempted || 0), 0),
        stealsSuccessful: attempt.teamStats.reduce((sum, t) => sum + (t.stealsSuccessful || 0), 0),
        teamsFrozen: attempt.teamStats.filter(t => t.timesFrozen > 0).length
      },

      // Team performance
      teams: attempt.teamStats.map(team => ({
        teamId: team.teamId,
        teamName: team.teamName,
        finalScore: team.finalScore,
        members: team.memberNames || team.memberIds || [],
        memberCount: team.memberIds?.length || 0,
        statistics: {
          questionsAnswered: team.questionsAnswered,
          correctAnswers: team.correctAnswers,
          wrongAnswers: team.wrongAnswers,
          accuracyPct: team.questionsAnswered > 0
            ? Math.round((team.correctAnswers / team.questionsAnswered) * 100)
            : 0,
          avgBuzzTimeSec: team.averageBuzzTimeSec
            ? Math.round(team.averageBuzzTimeSec * 10) / 10
            : null,
          stealsAttempted: team.stealsAttempted || 0,
          stealsSuccessful: team.stealsSuccessful || 0,
          stealSuccessRate: team.stealsAttempted > 0
            ? Math.round((team.stealsSuccessful / team.stealsAttempted) * 100)
            : 0,
          longestStreak: team.longestStreak || 0,
          timesFrozen: team.timesFrozen || 0
        }
      })),

      // Question-by-question breakdown
      questionBreakdown: []
    };

    // Group buzz data by question
    const questionMap = new Map();
    
    attempt.teamBuzzData.forEach(buzz => {
      if (!questionMap.has(buzz.questionIndex)) {
        questionMap.set(buzz.questionIndex, []);
      }
      questionMap.get(buzz.questionIndex).push(buzz);
    });

    // Create question breakdown
    const task = await BuzzerBattleTask.findById(attempt.taskId);
    
    questionMap.forEach((buzzes, questionIndex) => {
      const question = task?.questions?.[questionIndex];
      const firstBuzz = buzzes[0]; // First buzz for this question
      const correctBuzzes = buzzes.filter(b => b.isCorrect);
      const wrongBuzzes = buzzes.filter(b => !b.isCorrect);
      
      analytics.questionBreakdown.push({
        questionIndex,
        questionText: question?.text || 'Unknown question',
        points: question?.points || 0,
        difficulty: question?.difficulty || 'medium',
        category: question?.category || null,
        acceptedAnswers: question?.acceptedAnswers || '',
        
        // Stats
        totalBuzzes: buzzes.length,
        correctBuzzes: correctBuzzes.length,
        wrongBuzzes: wrongBuzzes.length,
        wasStolen: buzzes.some(b => b.wasSteal && b.isCorrect),
        
        // Buzz details
        firstBuzzTeam: firstBuzz?.teamName || 'Unknown',
        firstBuzzTimeMs: firstBuzz?.buzzTimeMs || 0,
        firstBuzzWasPartial: !firstBuzz?.sawFullQuestion,
        firstBuzzCorrect: firstBuzz?.isCorrect || false,
        
        // Team attempts
        teamAttempts: buzzes.map(b => ({
          teamName: b.teamName,
          teamId: b.teamId,
          studentId: b.studentId, // Who buzzed
          studentName: b.studentName,
          answeredBy: b.answeredBy, // Who actually answered
          answeredByName: b.answeredByName,
          buzzTimeMs: b.buzzTimeMs,
          sawFullQuestion: b.sawFullQuestion,
          submittedAnswer: b.submittedAnswer,
          isCorrect: b.isCorrect,
          pointsAwarded: b.pointsAwarded,
          wasSteal: b.wasSteal,
          responseTimeSec: b.responseTimeSec
        })),
        
        // Who answered this question (the final correct answer or last attempt)
        answeredBy: correctBuzzes.length > 0 
          ? correctBuzzes[0].answeredByName || correctBuzzes[0].answeredBy || 'Unknown'
          : (buzzes.length > 0 ? (buzzes[buzzes.length - 1].answeredByName || buzzes[buzzes.length - 1].answeredBy || 'Unknown') : 'No answer')
      });
    });

    // Sort questions by index
    analytics.questionBreakdown.sort((a, b) => a.questionIndex - b.questionIndex);

    res.json(analytics);
  } catch (error) {
    console.error('Error fetching Buzzer Battle analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
};

/**
 * Get list of Buzzer Battle sessions for a teacher
 * GET /api/buzzerbattle/sessions?teacherId=...
 */
exports.getTeacherSessions = async (req, res) => {
  try {
    const { teacherId, subjectId, status } = req.query;
    
    const query = {
      gameType: 'buzzer_battle'
    };
    
    if (teacherId) query.teacherId = teacherId;
    if (subjectId) query.subjectId = subjectId;
    if (status) query.status = status;

    const sessions = await GameSession.find(query)
      .populate('taskId', 'title description')
      .populate('subjectId', 'name code')
      .sort({ startedAt: -1 })
      .limit(100);

    res.json(sessions);
  } catch (error) {
    console.error('Error fetching Buzzer Battle sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
};

/**
 * Export session analytics to Excel
 * GET /api/buzzerbattle/sessions/:sessionId/export
 */
exports.exportSessionToExcel = async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Fetch analytics data
    const analyticsResponse = await exports.getSessionAnalytics(req, { json: () => {} });
    
    // Re-fetch the data properly
    const session = await GameSession.findById(sessionId).populate('taskId');
    const attempt = await BuzzerBattleAttempt.findOne({ sessionId });
    
    if (!session || !attempt) {
      return res.status(404).json({ error: 'Session or attempt not found' });
    }

    const workbook = new ExcelJS.Workbook();
    
    // Sheet 1: Session Summary
    const summarySheet = workbook.addWorksheet('Session Summary');
    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 40 }
    ];
    
    summarySheet.addRows([
      { metric: 'Session ID', value: session._id.toString() },
      { metric: 'Room Code', value: session.roomCode },
      { metric: 'Task Title', value: session.taskId?.title || 'Unknown' },
      { metric: 'Started At', value: session.startedAt },
      { metric: 'Ended At', value: session.endedAt },
      { metric: 'Total Questions', value: attempt.teamBuzzData.length > 0 ? Math.max(...attempt.teamBuzzData.map(b => b.questionIndex)) + 1 : 0 },
      { metric: 'Total Buzzes', value: attempt.teamBuzzData.length },
      { metric: 'Total Teams', value: attempt.teamStats.length },
      { metric: 'Steals Attempted', value: attempt.teamStats.reduce((sum, t) => sum + (t.stealsAttempted || 0), 0) },
      { metric: 'Steals Successful', value: attempt.teamStats.reduce((sum, t) => sum + (t.stealsSuccessful || 0), 0) }
    ]);

    // Sheet 2: Team Performance
    const teamsSheet = workbook.addWorksheet('Team Performance');
    teamsSheet.columns = [
      { header: 'Team Name', key: 'teamName', width: 20 },
      { header: 'Final Score', key: 'finalScore', width: 15 },
      { header: 'Questions Answered', key: 'questionsAnswered', width: 20 },
      { header: 'Correct', key: 'correct', width: 12 },
      { header: 'Wrong', key: 'wrong', width: 12 },
      { header: 'Accuracy %', key: 'accuracy', width: 15 },
      { header: 'Avg Buzz Time (s)', key: 'avgBuzzTime', width: 18 },
      { header: 'Steals Attempted', key: 'stealsAttempted', width: 18 },
      { header: 'Steals Successful', key: 'stealsSuccessful', width: 18 },
      { header: 'Longest Streak', key: 'longestStreak', width: 18 },
      { header: 'Times Frozen', key: 'timesFrozen', width: 15 }
    ];
    
    attempt.teamStats.forEach(team => {
      teamsSheet.addRow({
        teamName: team.teamName,
        finalScore: team.finalScore,
        questionsAnswered: team.questionsAnswered,
        correct: team.correctAnswers,
        wrong: team.wrongAnswers,
        accuracy: team.questionsAnswered > 0 
          ? Math.round((team.correctAnswers / team.questionsAnswered) * 100) 
          : 0,
        avgBuzzTime: team.averageBuzzTimeSec || 'N/A',
        stealsAttempted: team.stealsAttempted || 0,
        stealsSuccessful: team.stealsSuccessful || 0,
        longestStreak: team.longestStreak || 0,
        timesFrozen: team.timesFrozen || 0
      });
    });

    // Sheet 3: All Buzz Details
    const buzzSheet = workbook.addWorksheet('Buzz Details');
    buzzSheet.columns = [
      { header: 'Question #', key: 'questionIndex', width: 15 },
      { header: 'Team', key: 'teamName', width: 20 },
      { header: 'Buzz Time (ms)', key: 'buzzTimeMs', width: 18 },
      { header: 'Saw Full Question', key: 'sawFullQuestion', width: 20 },
      { header: 'Answer', key: 'answer', width: 30 },
      { header: 'Correct', key: 'isCorrect', width: 12 },
      { header: 'Points', key: 'pointsAwarded', width: 12 },
      { header: 'Was Steal', key: 'wasSteal', width: 12 },
      { header: 'Response Time (s)', key: 'responseTimeSec', width: 18 }
    ];
    
    attempt.teamBuzzData.forEach(buzz => {
      buzzSheet.addRow({
        questionIndex: buzz.questionIndex + 1,
        teamName: buzz.teamName,
        buzzTimeMs: buzz.buzzTimeMs,
        sawFullQuestion: buzz.sawFullQuestion ? 'Yes' : 'No',
        answer: buzz.submittedAnswer,
        isCorrect: buzz.isCorrect ? 'Yes' : 'No',
        pointsAwarded: buzz.pointsAwarded,
        wasSteal: buzz.wasSteal ? 'Yes' : 'No',
        responseTimeSec: buzz.responseTimeSec || 'N/A'
      });
    });

    // Set response headers for download
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=buzzer-battle-session-${sessionId}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting Buzzer Battle session:', error);
    res.status(500).json({ error: 'Failed to export session' });
  }
};

