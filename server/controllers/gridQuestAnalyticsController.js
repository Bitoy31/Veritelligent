const GameSession = require('../models/GameSession');
const GridQuestAttempt = require('../models/GridQuestAttempt');
const GridQuestTask = require('../models/GridQuestTask');
const User = require('../models/User');
const ExcelJS = require('exceljs');

/**
 * Get comprehensive analytics for a Grid Quest session
 * GET /api/gridquest/sessions/:sessionId/analytics
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

    if (session.gameType !== 'grid_quest') {
      return res.status(400).json({ error: 'Session is not a Grid Quest game' });
    }

    // Fetch all attempts for this session
    const attempts = await GridQuestAttempt.find({ sessionId }).sort({ roundNumber: 1, createdAt: 1 });

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
        totalRounds: session.gridQuestData?.totalRounds || attempts.length,
        cluesCompleted: session.gridQuestData?.cluesCompleted || attempts.length,
        totalTeams: session.gridQuestData?.teams?.length || 0,
        totalPlayers: session.gridQuestData?.teams
          ? session.gridQuestData.teams.reduce((sum, t) => sum + (t.memberIds?.length || 0), 0)
          : 0,
        offlinePlayerCount: session.gridQuestData?.offlinePlayerCount || 0,
        manualScoreAdjustments: session.gridQuestData?.manualScoreAdjustments || 0
      },

      // Team performance
      teams: [],

      // Per-clue breakdown
      clueBreakdown: [],

      // Student participation
      studentParticipation: [],

      // Category performance (which categories were easier/harder)
      categoryPerformance: []
    };

    // Process team data
    if (session.gridQuestData?.teams) {
      analytics.teams = session.gridQuestData.teams.map(team => {
        const teamAttempts = attempts.filter(a => a.team.teamId === team.teamId);
        const correctCount = teamAttempts.filter(a => a.isCorrect).length;
        const wrongCount = teamAttempts.length - correctCount;
        const totalResponseTime = teamAttempts
          .filter(a => a.responseTime !== null)
          .reduce((sum, a) => sum + (a.responseTime || 0), 0);
        const avgResponseTime = teamAttempts.filter(a => a.responseTime !== null).length > 0
          ? totalResponseTime / teamAttempts.filter(a => a.responseTime !== null).length
          : null;

        return {
          teamId: team.teamId,
          teamName: team.name,
          finalScore: team.finalScore || 0,
          members: team.memberNames || team.memberIds || [],
          memberCount: team.memberIds?.length || 0,
          statistics: {
            cluesAnswered: teamAttempts.length,
            correctAnswers: correctCount,
            wrongAnswers: wrongCount,
            accuracyPct: teamAttempts.length > 0 ? Math.round((correctCount / teamAttempts.length) * 100) : 0,
            avgResponseTimeSec: avgResponseTime ? Math.round(avgResponseTime * 10) / 10 : null,
            totalPointsEarned: teamAttempts.reduce((sum, a) => sum + Math.max(0, a.pointsAwarded), 0),
            totalPointsLost: Math.abs(teamAttempts.reduce((sum, a) => sum + Math.min(0, a.pointsAwarded), 0))
          }
        };
      });

      // Sort teams by final score
      analytics.teams.sort((a, b) => b.finalScore - a.finalScore);
    }

    // Process per-clue breakdown
    const clueMap = new Map();
    attempts.forEach(attempt => {
      const clueKey = `${attempt.clue.catIdx}-${attempt.clue.clueIdx}`;
      if (!clueMap.has(clueKey)) {
        clueMap.set(clueKey, {
          categoryName: attempt.clue.categoryName,
          catIdx: attempt.clue.catIdx,
          clueIdx: attempt.clue.clueIdx,
          prompt: attempt.clue.prompt,
          points: attempt.clue.points,
          roundNumber: attempt.roundNumber,
          teamAttempts: []
        });
      }
      clueMap.get(clueKey).teamAttempts.push({
        teamName: attempt.team.teamName,
        teamId: attempt.team.teamId,
        studentName: attempt.choosenStudent.studentName,
        studentId: attempt.choosenStudent.studentId,
        isOffline: attempt.choosenStudent.isOffline,
        submittedAnswer: attempt.submittedAnswer,
        isCorrect: attempt.isCorrect,
        pointsAwarded: attempt.pointsAwarded,
        responseTimeSec: attempt.responseTime,
        wasAutoSubmitted: attempt.wasAutoSubmitted
      });
    });

    analytics.clueBreakdown = Array.from(clueMap.values()).sort((a, b) => a.roundNumber - b.roundNumber);

    // Calculate accuracy per clue
    analytics.clueBreakdown = analytics.clueBreakdown.map(clue => {
      const correctCount = clue.teamAttempts.filter(a => a.isCorrect).length;
      const totalCount = clue.teamAttempts.length;
      return {
        ...clue,
        accuracyPct: totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0,
        correctCount,
        wrongCount: totalCount - correctCount
      };
    });

    // Process student participation
    const studentMap = new Map();
    attempts.forEach(attempt => {
      const studentId = attempt.choosenStudent.studentId;
      if (!studentMap.has(studentId)) {
        studentMap.set(studentId, {
          studentId,
          studentName: attempt.choosenStudent.studentName,
          isOffline: attempt.choosenStudent.isOffline,
          teamName: attempt.team.teamName,
          timesChosen: 0,
          correctAnswers: 0,
          wrongAnswers: 0,
          totalPointsContributed: 0
        });
      }
      const student = studentMap.get(studentId);
      student.timesChosen++;
      if (attempt.isCorrect) {
        student.correctAnswers++;
      } else {
        student.wrongAnswers++;
      }
      student.totalPointsContributed += attempt.pointsAwarded;
    });

    analytics.studentParticipation = Array.from(studentMap.values()).sort((a, b) => b.timesChosen - a.timesChosen);

    // Process category performance
    const categoryMap = new Map();
    attempts.forEach(attempt => {
      const catName = attempt.clue.categoryName;
      if (!categoryMap.has(catName)) {
        categoryMap.set(catName, {
          categoryName: catName,
          cluesAttempted: 0,
          correctCount: 0,
          wrongCount: 0
        });
      }
      const cat = categoryMap.get(catName);
      cat.cluesAttempted++;
      if (attempt.isCorrect) {
        cat.correctCount++;
      } else {
        cat.wrongCount++;
      }
    });

    analytics.categoryPerformance = Array.from(categoryMap.values()).map(cat => ({
      ...cat,
      accuracyPct: cat.cluesAttempted > 0 ? Math.round((cat.correctCount / cat.cluesAttempted) * 100) : 0
    }));

    res.json(analytics);
  } catch (error) {
    console.error('Error fetching Grid Quest analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
};

/**
 * Get list of all Grid Quest sessions for a teacher
 * GET /api/gridquest/sessions?teacherId=xxx
 */
exports.getTeacherSessions = async (req, res) => {
  try {
    const { teacherId } = req.query;

    if (!teacherId) {
      return res.status(400).json({ error: 'teacherId is required' });
    }

    const sessions = await GameSession.find({
      teacherId,
      gameType: 'grid_quest',
      status: 'ended'
    })
      .sort({ endedAt: -1 })
      .limit(50)
      .populate('taskId', 'title')
      .select('_id roomCode taskId startedAt endedAt gridQuestData');

    const sessionList = sessions.map(session => ({
      sessionId: session._id.toString(),
      roomCode: session.roomCode,
      taskTitle: session.taskId?.title || 'Unknown Task',
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      totalRounds: session.gridQuestData?.totalRounds || 0,
      totalTeams: session.gridQuestData?.teams?.length || 0,
      totalPlayers: session.gridQuestData?.teams
        ? session.gridQuestData.teams.reduce((sum, t) => sum + (t.memberIds?.length || 0), 0)
        : 0
    }));

    res.json(sessionList);
  } catch (error) {
    console.error('Error fetching teacher sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
};

/**
 * Export session analytics to Excel
 * GET /api/gridquest/sessions/:sessionId/export
 */
exports.exportSessionToExcel = async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Reuse the analytics function to get data
    const session = await GameSession.findById(sessionId)
      .populate('teacherId', 'userFname userLname userEmail')
      .populate('taskId');

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.gameType !== 'grid_quest') {
      return res.status(400).json({ error: 'Session is not a Grid Quest game' });
    }

    const attempts = await GridQuestAttempt.find({ sessionId }).sort({ roundNumber: 1, createdAt: 1 });

    // Create a new workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Veritelligent';
    workbook.created = new Date();

    // ====================
    // Sheet 1: Session Summary
    // ====================
    const summarySheet = workbook.addWorksheet('Session Summary');
    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 40 }
    ];

    // Style header row
    summarySheet.getRow(1).font = { bold: true, size: 12 };
    summarySheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF9B45' }
    };

    // Add session metadata
    summarySheet.addRows([
      { metric: 'Session ID', value: session._id.toString() },
      { metric: 'Room Code', value: session.roomCode },
      { metric: 'Task Title', value: session.taskId?.title || 'Unknown' },
      { metric: 'Teacher', value: session.teacherId ? `${session.teacherId.userFname} ${session.teacherId.userLname}` : 'Unknown' },
      { metric: 'Started At', value: session.startedAt ? new Date(session.startedAt).toLocaleString() : 'N/A' },
      { metric: 'Ended At', value: session.endedAt ? new Date(session.endedAt).toLocaleString() : 'N/A' },
      { metric: 'Duration (minutes)', value: session.endedAt && session.startedAt ? Math.round((new Date(session.endedAt) - new Date(session.startedAt)) / 60000) : 'N/A' },
      { metric: '', value: '' }, // Empty row
      { metric: 'Total Rounds', value: session.gridQuestData?.totalRounds || attempts.length },
      { metric: 'Total Teams', value: session.gridQuestData?.teams?.length || 0 },
      { metric: 'Total Players', value: session.gridQuestData?.teams ? session.gridQuestData.teams.reduce((sum, t) => sum + (t.memberIds?.length || 0), 0) : 0 },
      { metric: 'Offline Players', value: session.gridQuestData?.offlinePlayerCount || 0 },
      { metric: 'Manual Score Adjustments', value: session.gridQuestData?.manualScoreAdjustments || 0 }
    ]);

    // ====================
    // Sheet 2: Team Performance
    // ====================
    const teamsSheet = workbook.addWorksheet('Team Performance');
    teamsSheet.columns = [
      { header: 'Rank', key: 'rank', width: 8 },
      { header: 'Team Name', key: 'teamName', width: 20 },
      { header: 'Final Score', key: 'finalScore', width: 12 },
      { header: 'Clues Answered', key: 'cluesAnswered', width: 15 },
      { header: 'Correct Answers', key: 'correctAnswers', width: 15 },
      { header: 'Wrong Answers', key: 'wrongAnswers', width: 15 },
      { header: 'Accuracy %', key: 'accuracyPct', width: 12 },
      { header: 'Avg Response Time (s)', key: 'avgResponseTime', width: 20 },
      { header: 'Members', key: 'members', width: 40 }
    ];

    // Style header
    teamsSheet.getRow(1).font = { bold: true, size: 12 };
    teamsSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF9B45' }
    };

    // Process teams
    if (session.gridQuestData?.teams) {
      const teamsData = session.gridQuestData.teams.map((team, index) => {
        const teamAttempts = attempts.filter(a => a.team.teamId === team.teamId);
        const correctCount = teamAttempts.filter(a => a.isCorrect).length;
        const wrongCount = teamAttempts.length - correctCount;
        const totalResponseTime = teamAttempts
          .filter(a => a.responseTime !== null)
          .reduce((sum, a) => sum + (a.responseTime || 0), 0);
        const avgResponseTime = teamAttempts.filter(a => a.responseTime !== null).length > 0
          ? Math.round((totalResponseTime / teamAttempts.filter(a => a.responseTime !== null).length) * 10) / 10
          : null;

        return {
          rank: index + 1,
          teamName: team.name,
          finalScore: team.finalScore || 0,
          cluesAnswered: teamAttempts.length,
          correctAnswers: correctCount,
          wrongAnswers: wrongCount,
          accuracyPct: teamAttempts.length > 0 ? Math.round((correctCount / teamAttempts.length) * 100) : 0,
          avgResponseTime: avgResponseTime || 'N/A',
          members: (team.memberNames || team.memberIds || []).join(', ')
        };
      }).sort((a, b) => b.finalScore - a.finalScore);

      teamsData.forEach(team => teamsSheet.addRow(team));
    }

    // ====================
    // Sheet 3: Per-Clue Breakdown
    // ====================
    const cluesSheet = workbook.addWorksheet('Per-Clue Breakdown');
    cluesSheet.columns = [
      { header: 'Round #', key: 'roundNumber', width: 10 },
      { header: 'Category', key: 'categoryName', width: 20 },
      { header: 'Clue Prompt', key: 'prompt', width: 50 },
      { header: 'Points', key: 'points', width: 10 },
      { header: 'Correct', key: 'correctCount', width: 10 },
      { header: 'Wrong', key: 'wrongCount', width: 10 },
      { header: 'Accuracy %', key: 'accuracyPct', width: 12 }
    ];

    // Style header
    cluesSheet.getRow(1).font = { bold: true, size: 12 };
    cluesSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF9B45' }
    };

    // Process clues
    const clueMap = new Map();
    attempts.forEach(attempt => {
      const clueKey = `${attempt.clue.catIdx}-${attempt.clue.clueIdx}`;
      if (!clueMap.has(clueKey)) {
        clueMap.set(clueKey, {
          categoryName: attempt.clue.categoryName,
          catIdx: attempt.clue.catIdx,
          clueIdx: attempt.clue.clueIdx,
          prompt: attempt.clue.prompt,
          points: attempt.clue.points,
          roundNumber: attempt.roundNumber,
          correctCount: 0,
          wrongCount: 0
        });
      }
      const clue = clueMap.get(clueKey);
      if (attempt.isCorrect) {
        clue.correctCount++;
      } else {
        clue.wrongCount++;
      }
    });

    const cluesData = Array.from(clueMap.values())
      .sort((a, b) => a.roundNumber - b.roundNumber)
      .map(clue => ({
        ...clue,
        accuracyPct: (clue.correctCount + clue.wrongCount) > 0
          ? Math.round((clue.correctCount / (clue.correctCount + clue.wrongCount)) * 100)
          : 0
      }));

    cluesData.forEach(clue => cluesSheet.addRow(clue));

    // ====================
    // Sheet 4: Detailed Attempts
    // ====================
    const attemptsSheet = workbook.addWorksheet('Detailed Attempts');
    attemptsSheet.columns = [
      { header: 'Round #', key: 'roundNumber', width: 10 },
      { header: 'Category', key: 'categoryName', width: 20 },
      { header: 'Clue Prompt', key: 'prompt', width: 40 },
      { header: 'Team Name', key: 'teamName', width: 20 },
      { header: 'Student Name', key: 'studentName', width: 25 },
      { header: 'Offline?', key: 'isOffline', width: 10 },
      { header: 'Submitted Answer', key: 'submittedAnswer', width: 30 },
      { header: 'Correct?', key: 'isCorrect', width: 10 },
      { header: 'Points Awarded', key: 'pointsAwarded', width: 15 },
      { header: 'Response Time (s)', key: 'responseTime', width: 18 },
      { header: 'Auto-Submitted?', key: 'wasAutoSubmitted', width: 16 }
    ];

    // Style header
    attemptsSheet.getRow(1).font = { bold: true, size: 12 };
    attemptsSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF9B45' }
    };

    // Add all attempts
    attempts.forEach(attempt => {
      attemptsSheet.addRow({
        roundNumber: attempt.roundNumber,
        categoryName: attempt.clue.categoryName,
        prompt: attempt.clue.prompt,
        teamName: attempt.team.teamName,
        studentName: attempt.choosenStudent.studentName,
        isOffline: attempt.choosenStudent.isOffline ? 'Yes' : 'No',
        submittedAnswer: attempt.submittedAnswer || '(no answer)',
        isCorrect: attempt.isCorrect ? 'Yes' : 'No',
        pointsAwarded: attempt.pointsAwarded,
        responseTime: attempt.responseTime !== null ? Math.round(attempt.responseTime * 10) / 10 : 'N/A',
        wasAutoSubmitted: attempt.wasAutoSubmitted ? 'Yes' : 'No'
      });
    });

    // ====================
    // Sheet 5: Student Participation
    // ====================
    const studentsSheet = workbook.addWorksheet('Student Participation');
    studentsSheet.columns = [
      { header: 'Student Name', key: 'studentName', width: 25 },
      { header: 'Team Name', key: 'teamName', width: 20 },
      { header: 'Offline?', key: 'isOffline', width: 10 },
      { header: 'Times Chosen', key: 'timesChosen', width: 15 },
      { header: 'Correct Answers', key: 'correctAnswers', width: 16 },
      { header: 'Wrong Answers', key: 'wrongAnswers', width: 15 },
      { header: 'Total Points Contributed', key: 'totalPointsContributed', width: 22 }
    ];

    // Style header
    studentsSheet.getRow(1).font = { bold: true, size: 12 };
    studentsSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF9B45' }
    };

    // Process student participation
    const studentMap = new Map();
    attempts.forEach(attempt => {
      const studentId = attempt.choosenStudent.studentId;
      if (!studentMap.has(studentId)) {
        studentMap.set(studentId, {
          studentName: attempt.choosenStudent.studentName,
          isOffline: attempt.choosenStudent.isOffline,
          teamName: attempt.team.teamName,
          timesChosen: 0,
          correctAnswers: 0,
          wrongAnswers: 0,
          totalPointsContributed: 0
        });
      }
      const student = studentMap.get(studentId);
      student.timesChosen++;
      if (attempt.isCorrect) {
        student.correctAnswers++;
      } else {
        student.wrongAnswers++;
      }
      student.totalPointsContributed += attempt.pointsAwarded;
    });

    const studentsData = Array.from(studentMap.values())
      .sort((a, b) => b.timesChosen - a.timesChosen)
      .map(student => ({
        ...student,
        isOffline: student.isOffline ? 'Yes' : 'No'
      }));

    studentsData.forEach(student => studentsSheet.addRow(student));

    // Generate Excel file
    const filename = `GridQuest_Analytics_${session.roomCode || sessionId}_${new Date().toISOString().split('T')[0]}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error exporting Grid Quest analytics to Excel:', error);
    res.status(500).json({ error: 'Failed to export to Excel' });
  }
};

