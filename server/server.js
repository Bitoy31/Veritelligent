const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const GameSession = require('./models/GameSession');
const GridQuestAttempt = require('./models/GridQuestAttempt');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// In-memory room store (sufficient for prototype/dev)
// roomCode -> {
//   hostSocketId: string | null,
//   students: Map<socketId, student>,
//   responses: Map<studentId, optionIndex>,
//   meta?: { title: string; totalQuestions: number; totalPoints: number; totalTime: number }
// }
const rooms = new Map();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '20mb' })); // Increase payload limit
app.use(express.urlencoded({ limit: '20mb', extended: true }));

// Routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

const usersRoutes = require('./routes/users');
app.use('/api', usersRoutes);

const subjectsRoutes = require('./routes/subject');
app.use('/api/subjects', subjectsRoutes);

const quizRoutes = require('./routes/quiz');
app.use('/api/quiz', quizRoutes);

// Grid Quest routes
const gridQuestRoutes = require('./routes/gridquest');
app.use('/api/gridquest', gridQuestRoutes);

// Flashcard routes
const flashcardRoutes = require('./routes/flashcard');
app.use('/api/flashcard', flashcardRoutes);

// Buzzer Battle routes
const buzzerBattleRoutes = require('./routes/buzzerbattle');
app.use('/api/buzzerbattle', buzzerBattleRoutes);

// Analytics (sessions, attempts)
const analyticsRoutes = require('./routes/analytics');
app.use('/api/analytics', analyticsRoutes);

// Subject join/enrolled endpoints
const subjectJoinRoutes = require('./routes/subjectJoin');
app.use('/api/join', subjectJoinRoutes);

// Test route
app.get('/', (req, res) => {
  res.json({ message: '🎮 Game Server is Ready!' });
});

// Socket.IO event handlers
io.on('connection', (socket) => {
  // Host registers for a room
  socket.on('host_register', ({ roomCode }) => {
    const code = (roomCode || '').toUpperCase();
    if (!rooms.has(code)) {
      rooms.set(code, { hostSocketId: socket.id, students: new Map(), responses: new Map(), meta: undefined });
    } else {
      const room = rooms.get(code);
      room.hostSocketId = socket.id;
    }
    socket.join(code);
    socket.emit('host_registered', { roomCode: code });
  });

  // Student joins room
  socket.on('join_room', ({ roomCode, student }) => {
    const code = (roomCode || '').toUpperCase();
    // Require an existing room with a connected host
    if (!rooms.has(code) || !rooms.get(code)?.hostSocketId) {
      socket.emit('room_error', { code: 'ROOM_NOT_FOUND', message: 'Room not found or host is not present' });
      return;
    }
    const room = rooms.get(code);
    room.students.set(socket.id, { ...student, socketId: socket.id, isReady: !!student.isReady });
    
    // Store studentId in socket.data for easy lookup
    socket.data = socket.data || {};
    socket.data.studentId = student.id;
    socket.data.roomCode = code;
    
    socket.join(code);
    // Notify lobby update to host and students
    const unique = new Map();
    for (const s of room.students.values()) {
      // Deduplicate by stable student id (not socket id)
      unique.set(s.id, s);
    }
    const students = Array.from(unique.values());
    io.to(code).emit('lobby_update', { students });
    // Send quiz meta to the just-joined student if available
    if (room.meta) {
      socket.emit('quiz_meta', { roomCode: code, meta: room.meta });
    }
  });

  // Student toggles ready state
  socket.on('set_ready', ({ roomCode, isReady }) => {
    const code = (roomCode || '').toUpperCase();
    const room = rooms.get(code);
    if (!room) return;
    const student = room.students.get(socket.id);
    if (!student) return;
    student.isReady = !!isReady;
    const unique = new Map();
    for (const s of room.students.values()) {
      unique.set(s.id, s);
    }
    const students = Array.from(unique.values());
    io.to(code).emit('lobby_update', { students });
  });

  // Student leaves
  const handleLeaveAllRooms = () => {
    const joinedRooms = Array.from(socket.rooms);
    // First element is the socket id itself; skip it
    for (const roomCode of joinedRooms) {
      if (roomCode === socket.id) continue;
      const room = rooms.get(roomCode);
      if (!room) continue;
      room.students.delete(socket.id);
      const students = Array.from(room.students.values());
      io.to(roomCode).emit('lobby_update', { students });
    }
  };

  socket.on('leave_room', handleLeaveAllRooms);

  // Student submits answer
  socket.on('submit_answer', ({ roomCode, studentId, optionIndex }) => {
    const code = (roomCode || '').toUpperCase();
    const room = rooms.get(code);
    if (!room) return;
    room.responses.set(studentId, optionIndex);
    io.to(code).emit('answer_received', { studentId });
  });

  // Host broadcasts lifecycle events (server relays)
  socket.on('start_game', ({ roomCode }) => {
    io.to((roomCode || '').toUpperCase()).emit('start_game');
  });

  socket.on('question_start', ({ roomCode, index, timeLimit, question }) => {
    const code = (roomCode || '').toUpperCase();
    // Reset responses store for new question
    const room = rooms.get(code);
    if (room) room.responses = new Map();
    io.to(code).emit('question_start', { index, timeLimit, question });
  });

  socket.on('timer_tick', ({ roomCode, timeLeft }) => {
    io.to((roomCode || '').toUpperCase()).emit('timer_tick', { timeLeft });
  });

  // Relay pause/resume so students stay in sync
  socket.on('pause_timer', ({ roomCode, timeLeft }) => {
    io.to((roomCode || '').toUpperCase()).emit('pause_timer', { timeLeft });
  });
  socket.on('resume_timer', ({ roomCode }) => {
    io.to((roomCode || '').toUpperCase()).emit('resume_timer', {});
  });

  socket.on('countdown_update', ({ roomCode, value }) => {
    io.to((roomCode || '').toUpperCase()).emit('countdown_update', { value });
  });

  socket.on('show_results', ({ roomCode, correctIndex }) => {
    const code = (roomCode || '').toUpperCase();
    const room = rooms.get(code);
    const responses = room ? Object.fromEntries(room.responses) : {};
    io.to(code).emit('results', { responses, correctIndex });
  });

  // Host provides quiz metadata (title, total questions/points/time)
  socket.on('quiz_meta', ({ roomCode, meta }) => {
    const code = (roomCode || '').toUpperCase();
    if (!rooms.has(code)) {
      rooms.set(code, { hostSocketId: null, students: new Map(), responses: new Map(), meta });
    } else {
      const room = rooms.get(code);
      room.meta = meta;
    }
    // Send the full payload structure that the client expects
    io.to(code).emit('quiz_meta', { roomCode: code, meta });
  });

  // Student confirms metadata receipt
  socket.on('metadata_confirmed', ({ roomCode }) => {
    const code = (roomCode || '').toUpperCase();
    const room = rooms.get(code);
    if (room) {
      console.log(`Student ${socket.id} confirmed metadata receipt for room ${code}`);
      // You could track this to ensure all students have received metadata
    }
  });

  socket.on('finish_game', async ({ roomCode }) => {
    const code = (roomCode || '').toUpperCase();
    console.log(`🎯 Host ${socket.id} requested finish_game for room ${code}`);
    
    const gq = ensureGq(code);
    
    // Finalize Grid Quest session with analytics data
    if (gq && gq.sessionId) {
      try {
        // Get team member names for storage
        const room = rooms.get(code);
        const teamsWithNames = (gq.teams || []).map(team => {
          const memberNames = team.memberIds.map(mid => {
            if (room && room.students) {
              const st = Array.from(room.students.values()).find(s => s.id === mid);
              return st ? st.name : mid;
            }
            return mid;
          });
          
          return {
            teamId: team.teamId,
            name: team.name,
            memberIds: team.memberIds,
            memberNames: memberNames,
            finalScore: gq.scores[team.teamId] || 0
          };
        });

        await GameSession.findByIdAndUpdate(
          gq.sessionId,
          {
            status: 'ended',
            endedAt: new Date(),
            gridQuestData: {
              teams: teamsWithNames,
              totalRounds: gq.roundNumber || 0,
              cluesCompleted: gq.roundNumber || 0,
              manualScoreAdjustments: gq.manualAdjustmentCount || 0,
              offlinePlayerCount: (gq.offlinePlayerIds || []).length
            }
          },
          { new: true }
        );
        
        console.log(`📊 Finalized Grid Quest session ${gq.sessionId}: ${gq.roundNumber} rounds, ${gq.manualAdjustmentCount || 0} manual adjustments`);
      } catch (err) {
        console.error('❌ Failed to finalize Grid Quest session:', err);
      }
    }
    
    io.to(code).emit('game_finished');
    console.log(`📤 Emitted game_finished to room ${code}`);
    
    // Also mark session ended by roomCode if exists (fallback)
    try {
      GameSession.findOneAndUpdate(
        { roomCode: code, status: { $ne: 'ended' } },
        { status: 'ended', endedAt: new Date() },
        { new: true }
      ).then((doc) => {
        if (doc) {
          console.log('Session ended via socket finish_game for room', code, '->', doc._id.toString());
        }
      }).catch(() => {});
    } catch {}
  });

  // Host requests a restart: keep same room, reset state on clients
  socket.on('restart_game', ({ roomCode }) => {
    const code = (roomCode || '').toUpperCase();
    console.log(`🔁 Host ${socket.id} requested restart_game for room ${code}`);
    // Clear transient room state
    const room = rooms.get(code);
    if (room) {
      room.responses = new Map();
      // Keep students and meta, hostSocketId remains
    }
    io.to(code).emit('game_restarted');
  });

  // Grid Quest specific relays and lightweight room state
  const ensureGq = (code) => {
    if (!rooms.has(code)) return null;
    const room = rooms.get(code);
    if (!room.gq) {
      room.gq = { 
        teams: [], 
        scores: {}, 
        representatives: {}, 
        choosenStudents: {},  // Track chosen students per team
        currentTeamIdx: 0, 
        answers: new Map(),
        // Analytics tracking
        sessionId: null,  // Will be set when session is created
        taskId: null,
        subjectId: null,
        roundNumber: 0,   // Track which clue we're on
        clueStartTime: null, // Track when current clue started
        currentClue: null,  // Store current clue data
        manualAdjustmentCount: 0,
        offlinePlayerIds: [] // Track offline players
      };
    }
    return room.gq;
  };

  // Handle board phase start
  socket.on('gq_board_started', ({ roomCode, categories = [], grid = [] }) => {
    const code = (roomCode || '').toUpperCase();
    if (!rooms.has(code)) return;
    const gq = ensureGq(code);
    gq.phase = 'board';
    gq.categories = categories;
    gq.grid = grid;
    io.to(code).emit('gq_board_started', { categories, grid });
  });


  // Initialize Grid Quest session with task/subject info
  socket.on('gq_init_session', async ({ roomCode, taskId, subjectId, teacherId, offlinePlayerIds = [] }) => {
    const code = (roomCode || '').toUpperCase();
    const gq = ensureGq(code);
    if (!gq) return;

    try {
      // Create database session
      const session = await GameSession.create({
        taskId,
        subjectId,
        teacherId,
        category: 'party',
        gameType: 'grid_quest',
        roomCode: code,
        status: 'active',
        isTeamBased: true,
        startedAt: new Date()
      });

      gq.sessionId = session._id;
      gq.taskId = taskId;
      gq.subjectId = subjectId;
      gq.offlinePlayerIds = offlinePlayerIds;

      console.log(`📊 Created Grid Quest session: ${session._id} for room ${code}`);
      socket.emit('gq_session_created', { sessionId: session._id.toString() });
    } catch (err) {
      console.error('❌ Failed to create Grid Quest session:', err);
    }
  });

  socket.on('gq_team_setup', ({ roomCode, teams = [], representatives = {} }) => {
    const code = (roomCode || '').toUpperCase();
    if (!rooms.has(code)) return;
    const gq = ensureGq(code);
    gq.teams = teams;
    gq.representatives = representatives || {};
    // Initialize scores to 0 for each team
    const scores = {};
    for (const t of teams) scores[t.teamId] = 0;
    gq.scores = scores;
    io.to(code).emit('gq_team_setup', { teams, representatives: gq.representatives });
    io.to(code).emit('gq_score_update', { scores: gq.scores });
  });

  socket.on('gq_set_representatives', ({ roomCode, representatives = {} }) => {
    const code = (roomCode || '').toUpperCase();
    if (!rooms.has(code)) return;
    const gq = ensureGq(code);
    gq.representatives = representatives || {};
    io.to(code).emit('gq_representatives', { representatives: gq.representatives });
  });

  // Handle chosen students selection
  socket.on('gq_choosen_selected', ({ roomCode, choosenStudents = {}, choosenOne = null }) => {
    const code = (roomCode || '').toUpperCase();
    if (!rooms.has(code)) return;
    const gq = ensureGq(code);
    gq.choosenStudents = choosenStudents;
    console.log(`📝 Chosen students updated for room ${code}:`, choosenStudents);
    io.to(code).emit('gq_choosen_selected', { choosenStudents, choosenOne });
  });

  // Handle real-time typing from chosen students (broadcast to team members only)
  socket.on('gq_answer_typing', ({ roomCode, studentId, text }) => {
    const code = (roomCode || '').toUpperCase();
    const gq = ensureGq(code);
    if (!gq) return;

    // Find which team this student belongs to
    const team = (gq.teams || []).find(t => t.memberIds.includes(studentId));
    if (!team) return;

    // Broadcast to all team members EXCEPT the typer
    team.memberIds.forEach(memberId => {
      if (memberId !== studentId) {
        // Find socket for this team member
        const memberSockets = Array.from(io.sockets.sockets.values())
          .filter(s => s.data?.studentId === memberId);
        
        memberSockets.forEach(memberSocket => {
          memberSocket.emit('gq_answer_typing', { text, typingStudentId: studentId });
        });
      }
    });
  });

  socket.on('gq_select_clue', ({ roomCode, catIdx, clueIdx }) => {
    const code = (roomCode || '').toUpperCase();
    io.to(code).emit('gq_select_clue', { catIdx, clueIdx });
  });

  socket.on('gq_clue_reveal', ({ roomCode, payload }) => {
    const code = (roomCode || '').toUpperCase();
    const gq = ensureGq(code);
    if (gq) {
      // Track clue start for analytics
      gq.roundNumber += 1;
      gq.clueStartTime = new Date();
      gq.currentClue = payload;
      console.log(`📊 Round ${gq.roundNumber} started: ${payload.prompt?.substring(0, 50)}...`);
    }
    io.to(code).emit('gq_clue_reveal', payload);
  });

  socket.on('gq_answer_submit', ({ roomCode, studentId, text }) => {
    const code = (roomCode || '').toUpperCase();
    const gq = ensureGq(code);
    if (!gq) return;

    // Find which team this student belongs to
    const team = (gq.teams || []).find(t => t.memberIds.includes(studentId));
    if (!team) {
      console.log(`⚠️ Answer submit: Student ${studentId} not found in any team`);
      return;
    }

    // Check if this student is the chosen one for their team
    const chosenStudent = gq.choosenStudents[team.teamId];
    if (chosenStudent !== studentId) {
      console.log(`⚠️ Answer submit rejected: ${studentId} is not the chosen student for ${team.name}. Chosen: ${chosenStudent}`);
      return;
    }

    console.log(`✅ Answer accepted from chosen student ${studentId} (${team.name}): "${text}"`);
    gq.answers.set(studentId, { text, at: Date.now() });
    io.to(code).emit('gq_answer_received', { studentId });
  });

  socket.on('gq_award_points', ({ roomCode, teamId, delta }) => {
    const code = (roomCode || '').toUpperCase();
    const gq = ensureGq(code);
    if (!gq) return;
    const prev = gq.scores[teamId] || 0;
    gq.scores[teamId] = prev + (Number(delta) || 0);
    
    // Track manual adjustments for analytics
    gq.manualAdjustmentCount = (gq.manualAdjustmentCount || 0) + 1;
    console.log(`📊 Manual score adjustment #${gq.manualAdjustmentCount}: ${teamId} ${delta > 0 ? '+' : ''}${delta}`);
    
    io.to(code).emit('gq_score_update', { scores: gq.scores });
  });

  socket.on('gq_next_turn', ({ roomCode, teamId }) => {
    const code = (roomCode || '').toUpperCase();
    const gq = ensureGq(code);
    if (!gq) return;
    gq.currentTeamIdx = Math.max(0, (gq.teams || []).findIndex(t => t.teamId === teamId));
    io.to(code).emit('gq_next_turn', { teamId });
  });

  // Handle reveal phase transition
  socket.on('gq_reveal_phase', ({ roomCode }) => {
    const code = (roomCode || '').toUpperCase();
    console.log(`Server received gq_reveal_phase for room: ${code}`);
    if (!rooms.has(code)) {
      console.log(`Server: Room ${code} not found, cannot send reveal phase`);
      return;
    }
    const gq = ensureGq(code);
    gq.phase = 'reveal';
    console.log(`Server sending gq_reveal_phase to all clients in room: ${code}`);
    io.to(code).emit('gq_reveal_phase');
  });

  socket.on('gq_finalize_clue', async ({ roomCode, acceptedAnswers = [], points = 0, allowNegative = true }) => {
    const code = (roomCode || '').toUpperCase();
    const gq = ensureGq(code);
    if (!gq) return;

    const norm = (s) => (String(s || '')).trim().toLowerCase().replace(/\s+/g, ' ');
    const normalizedAnswers = (acceptedAnswers || []).map(norm);

    console.log('Grid Quest Finalize Clue Debug:');
    console.log('Accepted Answers:', acceptedAnswers);
    console.log('Normalized Accepted Answers:', normalizedAnswers);

    const submittedAt = new Date();
    const clueStartTime = gq.clueStartTime || submittedAt;

    // Process all teams' answers
    const results = [];
    const attemptRecords = [];
    
    for (const team of gq.teams || []) {
      // Check ALL team members' answers, not just the representative
      // Use the most recent answer submitted by any team member
      let latestAnswer = null;
      let latestTime = 0;
      let submittingStudentId = null;
      
      for (const memberId of team.memberIds || []) {
        const answerData = gq.answers.get(memberId);
        if (answerData && answerData.at > latestTime) {
          latestAnswer = answerData.text;
          latestTime = answerData.at;
          submittingStudentId = memberId;
        }
      }

      const submission = latestAnswer || '';
      const normalizedSubmission = norm(submission);
      const correct = normalizedAnswers.includes(normalizedSubmission);

      console.log(`Team ${team.teamId} (${team.name}):`);
      console.log('  Team members:', team.memberIds);
      console.log('  Submission:', submission);
      console.log('  Normalized Submission:', normalizedSubmission);
      console.log('  Correct:', correct);

      const delta = correct ? Number(points) || 0 : (allowNegative ? -(Number(points) || 0) : 0);
      const prev = gq.scores[team.teamId] || 0;
      gq.scores[team.teamId] = prev + delta;

      results.push({
        teamId: team.teamId,
        correct,
        pointsAwarded: delta,
        submittedText: submission
      });

      // Get chosen student for this team
      const choosenStudentId = gq.choosenStudents[team.teamId] || submittingStudentId;
      const isOffline = gq.offlinePlayerIds.includes(choosenStudentId);
      
      // Get student name from room students
      const room = rooms.get(code);
      let choosenStudentName = 'Unknown';
      if (room && room.students) {
        const studentData = Array.from(room.students.values()).find(s => s.id === choosenStudentId);
        if (studentData) choosenStudentName = studentData.name;
      }

      // Get all member names
      const memberNames = team.memberIds.map(mid => {
        if (room && room.students) {
          const st = Array.from(room.students.values()).find(s => s.id === mid);
          return st ? st.name : mid;
        }
        return mid;
      });

      // Calculate response time
      const responseTime = latestTime ? (latestTime - clueStartTime.getTime()) / 1000 : null;

      // Prepare attempt record for database (will be saved if session exists)
      if (gq.sessionId && gq.currentClue) {
        attemptRecords.push({
          sessionId: gq.sessionId,
          taskId: gq.taskId,
          subjectId: gq.subjectId,
          clue: {
            catIdx: gq.currentClue.catIdx || 0,
            clueIdx: gq.currentClue.clueIdx || 0,
            categoryName: gq.currentClue.categoryName || 'Unknown',
            prompt: gq.currentClue.prompt || '',
            points: Number(points) || 0,
            acceptedAnswers: acceptedAnswers || []
          },
          team: {
            teamId: team.teamId,
            teamName: team.name,
            memberIds: team.memberIds,
            memberNames: memberNames
          },
          choosenStudent: {
            studentId: choosenStudentId || 'none',
            studentName: choosenStudentName,
            isOffline: isOffline
          },
          submittedAnswer: submission,
          isCorrect: correct,
          pointsAwarded: delta,
          clueStartedAt: clueStartTime,
          submittedAt: latestTime ? new Date(latestTime) : null,
          responseTime: responseTime,
          wasAutoSubmitted: !latestTime, // No submission means auto-submit
          roundNumber: gq.roundNumber || 0
        });
      }
    }

    // Save attempt records to database
    if (attemptRecords.length > 0 && gq.sessionId) {
      try {
        await GridQuestAttempt.insertMany(attemptRecords);
        console.log(`📊 Saved ${attemptRecords.length} attempt records for round ${gq.roundNumber}`);
      } catch (err) {
        console.error('❌ Failed to save Grid Quest attempts:', err);
      }
    }

    // Clear stored answers for next clue
    gq.answers = new Map();

    // Emit results for each team
    for (const result of results) {
      io.to(code).emit('gq_answer_result', result);
    }

    io.to(code).emit('gq_score_update', { scores: gq.scores });
  });

  // ============================================================
  // FLASHCARD GAME SOCKET EVENTS
  // ============================================================
  
  const ensureFc = (code) => {
    if (!rooms.has(code)) return null;
    const room = rooms.get(code);
    if (!room.fc) {
      room.fc = {
        sessionId: null,
        taskId: null,
        subjectId: null,
        questions: [],
        studentsInRoom: [], // { id, name, hasBeenCalled, lifeCards: { callFriend, hint, redraw } }
        questionsPool: [], // indices of available questions
        currentTurnStudentId: null,
        currentQuestionIndex: null,
        currentQuestionStartTime: null,
        currentAnswerData: null, // store answer being processed
        phase: 'lobby', // 'lobby' | 'draw-student' | 'draw-question' | 'answering' | 'reveal' | 'finished'
        allowRepeatedStudents: false
      };
    }
    return room.fc;
  };

  // Flashcard: Create room and initialize session
  socket.on('flashcard:create-room', async ({ roomCode, taskId, subjectId, teacherId }) => {
    const code = (roomCode || '').toUpperCase();
    const fc = ensureFc(code);
    if (!fc) return;

    try {
      const FlashcardTask = require('./models/FlashcardTask');
      const task = await FlashcardTask.findById(taskId);
      
      if (!task) {
        socket.emit('flashcard:error', { message: 'Task not found' });
        return;
      }

      // Create database session
      const session = await GameSession.create({
        taskId,
        subjectId,
        teacherId,
        category: 'solo',
        gameType: 'flashcard',
        roomCode: code,
        status: 'active',
        isTeamBased: false,
        startedAt: new Date()
      });

      fc.sessionId = session._id;
      fc.taskId = taskId;
      fc.subjectId = subjectId;
      fc.questions = task.questions;
      fc.questionsPool = task.questions.map((_, idx) => idx);
      fc.allowRepeatedStudents = task.settings?.allowRepeatedStudents || false;

      console.log(`🃏 Created Flashcard session: ${session._id} for room ${code}`);
      socket.emit('flashcard:session-created', { 
        sessionId: session._id.toString(),
        totalQuestions: task.questions.length
      });
    } catch (err) {
      console.error('❌ Failed to create Flashcard session:', err);
      socket.emit('flashcard:error', { message: 'Failed to create session' });
    }
  });

  // Flashcard: Student joins
  socket.on('flashcard:join', ({ roomCode, student }) => {
    const code = (roomCode || '').toUpperCase();
    
    if (!rooms.has(code)) {
      socket.emit('flashcard:error', { message: 'Room not found' });
      return;
    }

    const fc = ensureFc(code);
    if (!fc) {
      socket.emit('flashcard:error', { message: 'Room not initialized' });
      return;
    }

    // Check if student already in room
    const existing = fc.studentsInRoom.find(s => s.id === student.id);
    if (!existing) {
      fc.studentsInRoom.push({
        id: student.id,
        name: student.name,
        socketId: socket.id,
        hasBeenCalled: false,
        lifeCards: {
          callFriend: true,
          hint: true,
          redraw: true
        }
      });
    } else {
      // Update socket id for reconnection
      existing.socketId = socket.id;
    }

    socket.join(code);
    socket.data.studentId = student.id;
    socket.data.flashcardRoom = code;

    // Notify everyone
    io.to(code).emit('flashcard:student-joined', { 
      students: fc.studentsInRoom.map(s => ({
        id: s.id,
        name: s.name,
        hasBeenCalled: s.hasBeenCalled
      }))
    });

    console.log(`🃏 Student ${student.name} joined Flashcard room ${code}`);
  });

  // Flashcard: Start game
  socket.on('flashcard:start-game', ({ roomCode }) => {
    const code = (roomCode || '').toUpperCase();
    const fc = ensureFc(code);
    if (!fc) return;

    fc.phase = 'draw-student';
    io.to(code).emit('flashcard:game-started', {
      totalStudents: fc.studentsInRoom.length,
      totalQuestions: fc.questions.length
    });

    console.log(`🃏 Flashcard game started in room ${code}`);
  });

  // Flashcard: Draw student card
  socket.on('flashcard:draw-student-card', ({ roomCode }) => {
    const code = (roomCode || '').toUpperCase();
    const fc = ensureFc(code);
    if (!fc) return;

    // Filter available students
    let availableStudents = fc.studentsInRoom.filter(s => !s.hasBeenCalled);
    
    // If no available students and repeated allowed, reset all
    if (availableStudents.length === 0 && fc.allowRepeatedStudents) {
      fc.studentsInRoom.forEach(s => s.hasBeenCalled = false);
      availableStudents = fc.studentsInRoom;
      console.log(`🃏 All students called, resetting pool in room ${code}`);
    }

    if (availableStudents.length === 0) {
      io.to(code).emit('flashcard:no-students-available');
      return;
    }

    // Pick random student
    const randomIndex = Math.floor(Math.random() * availableStudents.length);
    const selectedStudent = availableStudents[randomIndex];
    selectedStudent.hasBeenCalled = true;
    fc.currentTurnStudentId = selectedStudent.id;
    fc.phase = 'draw-question';

    // Emit with slight delay for animation
    setTimeout(() => {
      io.to(code).emit('flashcard:student-selected', {
        studentId: selectedStudent.id,
        studentName: selectedStudent.name,
        availableCount: availableStudents.length - 1
      });

      // Also send available questions immediately
      if (fc.questionsPool.length === 0) {
        io.to(code).emit('flashcard:no-questions-available');
        fc.phase = 'finished';
      } else {
        const availableQuestions = fc.questionsPool.map(qIdx => {
          const q = fc.questions[qIdx];
          return {
            questionIndex: qIdx,
            text: q.text,
            type: q.type,
            points: q.points,
            hasTimer: q.hasTimer
          };
        });
        fc.phase = 'draw-question';
        io.to(code).emit('flashcard:questions-available', { 
          questions: availableQuestions,
          totalAvailable: fc.questionsPool.length
        });
      }
    }, 500);

    console.log(`🃏 Selected student ${selectedStudent.name} in room ${code}`);
  });

  // Flashcard: Request available questions for selection
  socket.on('flashcard:request-questions', ({ roomCode }) => {
    const code = (roomCode || '').toUpperCase();
    const fc = ensureFc(code);
    if (!fc) return;

    if (fc.questionsPool.length === 0) {
      io.to(code).emit('flashcard:no-questions-available');
      fc.phase = 'finished';
      return;
    }

    // Send all available questions (preview only - no answers)
    const availableQuestions = fc.questionsPool.map(qIdx => {
      const q = fc.questions[qIdx];
      return {
        questionIndex: qIdx,
        text: q.text,
        type: q.type,
        points: q.points,
        hasTimer: q.hasTimer
      };
    });

    fc.phase = 'selecting-question';
    io.to(code).emit('flashcard:questions-available', { 
      questions: availableQuestions,
      totalAvailable: fc.questionsPool.length
    });

    console.log(`🃏 Sent ${availableQuestions.length} available questions to room ${code}`);
  });

  // Flashcard: Select a specific question
  socket.on('flashcard:select-question', ({ roomCode, questionIndex }) => {
    const code = (roomCode || '').toUpperCase();
    const fc = ensureFc(code);
    if (!fc) return;

    // Verify question is in pool
    const poolIndex = fc.questionsPool.indexOf(questionIndex);
    if (poolIndex === -1) {
      socket.emit('flashcard:error', { message: 'Question not available' });
      return;
    }

    // Remove from pool
    fc.questionsPool.splice(poolIndex, 1);
    
    const question = fc.questions[questionIndex];
    fc.currentQuestionIndex = questionIndex;
    fc.currentQuestionStartTime = new Date();
    fc.phase = 'answering';
    
    // Reset currentAnswerData for the new question, but preserve redrawUsed flag
    const wasRedraw = fc.currentAnswerData?.redrawUsed || false;
    fc.currentAnswerData = {};
    if (wasRedraw) {
      fc.currentAnswerData.redrawUsed = true;
      console.log('🔄 Question selected after redraw, preserving redrawUsed flag');
    }

    // Emit full question data (hide correct answer)
    const questionData = {
      questionIndex,
      text: question.text,
      type: question.type,
      options: question.type === 'multiple_choice' 
        ? question.options.map(o => ({ text: o.text })) 
        : undefined,
      points: question.points,
      hasTimer: question.hasTimer,
      timeLimitSec: question.timeLimitSec,
      remainingQuestions: fc.questionsPool.length
    };

    setTimeout(() => {
      io.to(code).emit('flashcard:question-selected', questionData);
    }, 500);

    console.log(`🃏 Question ${questionIndex + 1} selected in room ${code}`);
  });

  // Flashcard: Use life card - Hint
  socket.on('flashcard:use-hint', ({ roomCode, studentId }) => {
    const code = (roomCode || '').toUpperCase();
    const fc = ensureFc(code);
    if (!fc) return;

    const student = fc.studentsInRoom.find(s => s.id === studentId);
    if (!student || !student.lifeCards.hint) {
      socket.emit('flashcard:error', { message: 'Hint not available' });
      return;
    }

    // Mark hint as used
    student.lifeCards.hint = false;

    // Generate hint
    const question = fc.questions[fc.currentQuestionIndex];
    let hint = '';

    if (question.type === 'text_input') {
      const answers = question.acceptedAnswers.split(',').map(a => a.trim());
      const firstAnswer = answers[0];
      // Generate fill-in-the-blank: show first, last, hide middle
      if (firstAnswer.length <= 2) {
        hint = firstAnswer;
      } else {
        const first = firstAnswer[0];
        const last = firstAnswer[firstAnswer.length - 1];
        const middle = ' _ '.repeat(firstAnswer.length - 2);
        hint = `${first}${middle}${last}`;
      }
    } else {
      hint = 'Hint: Eliminate one wrong answer'; // For MCQ, could filter options
    }

    // Store hint usage in currentAnswerData for database recording
    if (!fc.currentAnswerData) fc.currentAnswerData = {};
    fc.currentAnswerData.hintUsed = true;
    fc.currentAnswerData.revealedHint = hint;

    console.log(`💡 Hint used by ${student.name} in room ${code}, stored in currentAnswerData:`, fc.currentAnswerData);

    io.to(code).emit('flashcard:hint-revealed', {
      studentId,
      hint
    });

    console.log(`🃏 Hint revealed to room ${code}`);
  });

  // Flashcard: Use life card - Re-draw
  socket.on('flashcard:use-redraw', ({ roomCode, studentId }) => {
    const code = (roomCode || '').toUpperCase();
    const fc = ensureFc(code);
    if (!fc) return;

    const student = fc.studentsInRoom.find(s => s.id === studentId);
    if (!student || !student.lifeCards.redraw) {
      socket.emit('flashcard:error', { message: 'Re-draw not available' });
      return;
    }

    // Mark redraw as used
    student.lifeCards.redraw = false;

    // Store redraw usage in currentAnswerData for database recording
    if (!fc.currentAnswerData) fc.currentAnswerData = {};
    fc.currentAnswerData.redrawUsed = true;

    console.log(`🔄 Re-draw used by ${student.name} in room ${code}, stored in currentAnswerData:`, fc.currentAnswerData);

    // Put current question back in pool
    fc.questionsPool.push(fc.currentQuestionIndex);

    io.to(code).emit('flashcard:redraw-used', { studentId });

    // Auto-trigger request new questions
    setTimeout(() => {
      socket.emit('flashcard:request-questions', { roomCode });
    }, 1000);

    console.log(`🃏 Re-draw complete, new questions will be shown`);
  });

  // Flashcard: Use life card - Call a Friend
  socket.on('flashcard:use-call-friend', ({ roomCode, studentId, helperId }) => {
    const code = (roomCode || '').toUpperCase();
    const fc = ensureFc(code);
    if (!fc) return;

    const student = fc.studentsInRoom.find(s => s.id === studentId);
    if (!student || !student.lifeCards.callFriend) {
      socket.emit('flashcard:error', { message: 'Call a Friend not available' });
      return;
    }

    const helper = fc.studentsInRoom.find(s => s.id === helperId);
    if (!helper) {
      socket.emit('flashcard:error', { message: 'Helper not found' });
      return;
    }

    // Mark call friend as used
    student.lifeCards.callFriend = false;

    // Store helper info
    fc.currentAnswerData = {
      ...fc.currentAnswerData,
      helperId,
      helperName: helper.name
    };

    // Notify everyone
    io.to(code).emit('flashcard:call-friend-used', {
      studentId,
      helperId,
      helperName: helper.name
    });

    // Notify helper specifically
    const helperSocket = Array.from(io.sockets.sockets.values())
      .find(s => s.data?.studentId === helperId);
    
    if (helperSocket) {
      const question = fc.questions[fc.currentQuestionIndex];
      const questionData = {
        text: question.text,
        type: question.type,
        options: question.type === 'multiple_choice' 
          ? question.options.map(o => ({ text: o.text })) 
          : undefined
      };
      helperSocket.emit('flashcard:friend-help-request', questionData);
    }

    console.log(`🃏 ${student.name} called ${helper.name} for help in room ${code}`);
  });

  // Flashcard: Helper submits answer
  socket.on('flashcard:friend-answer', async ({ roomCode, helperId, answer, selectedOption }) => {
    const code = (roomCode || '').toUpperCase();
    const fc = ensureFc(code);
    if (!fc) return;

    if (!fc.currentAnswerData) {
      fc.currentAnswerData = {};
    }

    fc.currentAnswerData.helperAnswer = answer;
    fc.currentAnswerData.helperSelectedOption = selectedOption;

    console.log(`🤝 Helper ${helperId} submitted answer in room ${code}, auto-submitting for original student`);

    // When friend answers, automatically submit for the original student
    // The friend's answer becomes the student's answer for Call a Friend mechanic
    const FlashcardAttempt = require('./models/FlashcardAttempt');
    const question = fc.questions[fc.currentQuestionIndex];
    const student = fc.studentsInRoom.find(s => s.id === fc.currentTurnStudentId);
    
    if (!student || !question) return;

    // Calculate time taken
    const timeTaken = fc.currentQuestionStartTime 
      ? Math.floor((new Date() - fc.currentQuestionStartTime) / 1000)
      : null;

    // Check if helper's answer is correct
    let helperCorrect = false;
    if (question.type === 'multiple_choice') {
      helperCorrect = question.options[selectedOption]?.isCorrect || false;
    } else if (question.type === 'text_input') {
      const acceptedAnswers = question.acceptedAnswers.split(',').map(a => a.trim().toLowerCase());
      helperCorrect = acceptedAnswers.includes((answer || '').trim().toLowerCase());
    }

    // Adjust points: answerer gets 50% if correct, helper gets 100%
    let pointsEarned, helperPointsEarned;
    if (helperCorrect) {
      pointsEarned = Math.floor(question.points * 0.5);
      helperPointsEarned = question.points;
    } else {
      pointsEarned = -question.points;
      helperPointsEarned = -question.points;
    }

    // Save attempt to database
    try {
      const attemptData = {
        sessionId: fc.sessionId,
        taskId: fc.taskId,
        subjectId: fc.subjectId,
        studentId: fc.currentTurnStudentId,
        questionIndex: fc.currentQuestionIndex,
        selectedOption: question.type === 'multiple_choice' ? selectedOption : undefined,
        textAnswer: question.type === 'text_input' ? answer : undefined,
        isCorrect: helperCorrect,
        pointsEarned,
        timeTakenSec: timeTaken,
        lifeCardUsed: 'call_friend',
        helperId,
        helperAnswer: answer,
        helperCorrect,
        helperPointsEarned,
        revealedHint: null
      };
      
      console.log('💾 Saving FlashcardAttempt with Call a Friend:', {
        studentId: fc.currentTurnStudentId,
        helperId,
        helperCorrect,
        questionIndex: fc.currentQuestionIndex
      });
      
      await FlashcardAttempt.create(attemptData);
      console.log(`🃏 Saved attempt for student ${fc.currentTurnStudentId} with Call a Friend in room ${code}`);
    } catch (err) {
      console.error('❌ Failed to save Flashcard attempt:', err);
    }

    // Send reveal data
    const revealData = {
      question: {
        text: question.text,
        type: question.type,
        correctAnswer: question.type === 'multiple_choice' 
          ? question.options.findIndex(o => o.isCorrect)
          : question.acceptedAnswers
      },
      studentAnswer: answer,
      selectedOption,
      isCorrect: helperCorrect,
      pointsEarned,
      studentId: fc.currentTurnStudentId,
      studentName: student.name,
      usedCallFriend: true,
      helperName: fc.studentsInRoom.find(s => s.id === helperId)?.name,
      helperAnswer: answer,
      helperCorrect,
      helperPointsEarned
    };

    fc.phase = 'reveal';
    io.to(code).emit('flashcard:reveal', revealData);

    console.log(`🃏 Reveal phase started in room ${code} after Call a Friend`);
  });

  // Flashcard: Student submits answer
  socket.on('flashcard:submit-answer', async ({ roomCode, studentId, answer, selectedOption }) => {
    const code = (roomCode || '').toUpperCase();
    const fc = ensureFc(code);
    if (!fc) return;

    const FlashcardAttempt = require('./models/FlashcardAttempt');
    const question = fc.questions[fc.currentQuestionIndex];
    const student = fc.studentsInRoom.find(s => s.id === studentId);
    
    if (!student || !question) return;

    // Calculate time taken
    const timeTaken = fc.currentQuestionStartTime 
      ? Math.floor((new Date() - fc.currentQuestionStartTime) / 1000)
      : null;

    // Check if answer is correct
    let isCorrect = false;
    if (question.type === 'multiple_choice') {
      isCorrect = question.options[selectedOption]?.isCorrect || false;
    } else if (question.type === 'text_input') {
      const acceptedAnswers = question.acceptedAnswers.split(',').map(a => a.trim().toLowerCase());
      isCorrect = acceptedAnswers.includes((answer || '').trim().toLowerCase());
    }

    // Calculate points
    let pointsEarned = isCorrect ? question.points : -question.points;
    
    // Handle Call a Friend logic
    let helperCorrect = null;
    let helperPointsEarned = 0;
    let lifeCardUsed = null;

    if (fc.currentAnswerData?.helperId) {
      lifeCardUsed = 'call_friend';
      const helperAnswer = fc.currentAnswerData.helperAnswer;
      const helperOption = fc.currentAnswerData.helperSelectedOption;

      // Check helper's answer
      if (question.type === 'multiple_choice') {
        helperCorrect = question.options[helperOption]?.isCorrect || false;
      } else {
        const acceptedAnswers = question.acceptedAnswers.split(',').map(a => a.trim().toLowerCase());
        helperCorrect = acceptedAnswers.includes((helperAnswer || '').trim().toLowerCase());
      }

      // Adjust points: answerer gets 50% if correct, helper gets 100%
      if (helperCorrect) {
        pointsEarned = Math.floor(question.points * 0.5);
        helperPointsEarned = question.points;
      } else {
        pointsEarned = -question.points;
        helperPointsEarned = -question.points;
      }
    } else {
      // Check if hint or redraw was used (stored earlier)
      if (fc.currentAnswerData?.hintUsed) lifeCardUsed = 'hint';
      if (fc.currentAnswerData?.redrawUsed) lifeCardUsed = 'redraw';
    }

    // Save attempt to database
    try {
      const attemptData = {
        sessionId: fc.sessionId,
        taskId: fc.taskId,
        subjectId: fc.subjectId,
        studentId,
        questionIndex: fc.currentQuestionIndex,
        selectedOption: question.type === 'multiple_choice' ? selectedOption : undefined,
        textAnswer: question.type === 'text_input' ? answer : undefined,
        isCorrect,
        pointsEarned,
        timeTakenSec: timeTaken,
        lifeCardUsed,
        helperId: fc.currentAnswerData?.helperId,
        helperAnswer: fc.currentAnswerData?.helperAnswer,
        helperCorrect,
        helperPointsEarned,
        revealedHint: fc.currentAnswerData?.revealedHint
      };
      
      console.log('💾 Saving FlashcardAttempt:', {
        studentId,
        questionIndex: fc.currentQuestionIndex,
        isCorrect,
        lifeCardUsed,
        hintUsed: fc.currentAnswerData?.hintUsed,
        redrawUsed: fc.currentAnswerData?.redrawUsed
      });
      
      await FlashcardAttempt.create(attemptData);

      console.log(`🃏 Saved attempt for student ${studentId} in room ${code}`);
    } catch (err) {
      console.error('❌ Failed to save Flashcard attempt:', err);
    }

    // Prepare reveal data
    fc.phase = 'reveal';
    const correctAnswer = question.type === 'multiple_choice'
      ? question.options.findIndex(o => o.isCorrect)
      : question.acceptedAnswers;

    const revealData = {
      questionIndex: fc.currentQuestionIndex,
      correctAnswer,
      studentAnswer: question.type === 'multiple_choice' ? selectedOption : answer,
      isCorrect,
      pointsEarned,
      helperData: fc.currentAnswerData?.helperId ? {
        helperId: fc.currentAnswerData.helperId,
        helperName: fc.currentAnswerData.helperName,
        helperAnswer: question.type === 'multiple_choice' 
          ? fc.currentAnswerData.helperSelectedOption 
          : fc.currentAnswerData.helperAnswer,
        helperCorrect,
        helperPointsEarned
      } : null
    };

    io.to(code).emit('flashcard:reveal', revealData);

    // Reset current answer data
    fc.currentAnswerData = null;

    console.log(`🃏 Answer revealed in room ${code}: ${isCorrect ? 'Correct' : 'Wrong'}`);
  });

  // Flashcard: Next turn
  socket.on('flashcard:next-turn', ({ roomCode }) => {
    const code = (roomCode || '').toUpperCase();
    const fc = ensureFc(code);
    if (!fc) return;

    fc.currentTurnStudentId = null;
    fc.currentQuestionIndex = null;
    fc.currentQuestionStartTime = null;
    fc.currentAnswerData = null;

    // Check if game should end
    if (fc.questionsPool.length === 0) {
      fc.phase = 'finished';
      io.to(code).emit('flashcard:game-finished');
      
      // Update session status
      GameSession.findOneAndUpdate(
        { roomCode: code, status: 'active' },
        { status: 'ended', endedAt: new Date() }
      ).catch(err => console.error('Failed to end session:', err));
      
      console.log(`🃏 Flashcard game finished in room ${code}`);
    } else {
      fc.phase = 'draw-student';
      io.to(code).emit('flashcard:next-turn', {
        remainingQuestions: fc.questionsPool.length
      });
      console.log(`🃏 Next turn ready in room ${code}`);
    }
  });

  // Flashcard: End game (teacher manually ends)
  socket.on('flashcard:end-game', async ({ roomCode }) => {
    const code = (roomCode || '').toUpperCase();
    const fc = ensureFc(code);
    if (!fc) return;

    fc.phase = 'finished';
    
    // Update session status
    try {
      await GameSession.findOneAndUpdate(
        { roomCode: code, status: 'active' },
        { status: 'ended', endedAt: new Date() }
      );
    } catch (err) {
      console.error('Failed to end session:', err);
    }

    io.to(code).emit('flashcard:game-finished');
    console.log(`🃏 Flashcard game ended by teacher in room ${code}`);
  });

  // Flashcard: Student leaves
  socket.on('flashcard:leave', ({ roomCode, studentId }) => {
    const code = (roomCode || '').toUpperCase();
    const fc = ensureFc(code);
    if (!fc) return;

    fc.studentsInRoom = fc.studentsInRoom.filter(s => s.id !== studentId);
    
    io.to(code).emit('flashcard:student-left', {
      studentId,
      remainingStudents: fc.studentsInRoom.length
    });

    socket.leave(code);
    console.log(`🃏 Student ${studentId} left room ${code}`);
  });

  // ============================================================
  // BUZZER BATTLE GAME SOCKET EVENTS
  // ============================================================
  
  const ensureBb = (code) => {
    if (!rooms.has(code)) return null;
    const room = rooms.get(code);
    if (!room.bb) {
      room.bb = {
        sessionId: null,
        taskId: null,
        subjectId: null,
        teams: [], // { teamId, name, memberIds, score, streak, longestStreak, frozen, consecutiveWrong, timesFrozen }
        settings: {},
        currentQuestion: null, // { index, text, fullText, startTime, revealedWords, totalWords, revealInterval }
        buzzState: null, // { buzzedTeam, buzzTime, buzzQueue, isAnswering, stealAttempts }
        phase: 'lobby', // 'lobby' | 'question' | 'answering' | 'results' | 'finished'
        globalCorrectAnsweredStudents: [], // Track which students have answered CORRECTLY across all questions
        disabledBuzzers: new Map() // Map of studentId -> teamId for students who buzzed correctly and can't buzz again until teammates answer correctly
      };
    }
    // Ensure these exist even if bb was created before
    if (!room.bb.globalCorrectAnsweredStudents) {
      room.bb.globalCorrectAnsweredStudents = [];
    }
    if (!room.bb.disabledBuzzers) {
      room.bb.disabledBuzzers = new Map();
    }
    return room.bb;
  };

  // Buzzer Battle: Create room and initialize session
  socket.on('bb:create-room', async ({ taskId, subjectId, teacherId }) => {
    console.log('📥 Received bb:create-room event:', { taskId, subjectId, teacherId });
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    try {
      console.log('📡 Loading BuzzerBattleTask model...');
      const BuzzerBattleTask = require('./models/BuzzerBattleTask');
      console.log('📡 Finding task with ID:', taskId);
      const task = await BuzzerBattleTask.findById(taskId);
      
      if (!task) {
        console.error('❌ Task not found:', taskId);
        socket.emit('bb:error', { message: 'Task not found' });
        return;
      }

      console.log('✅ Task found:', task.title);

      // Create database session
      console.log('📡 Creating game session...');
      const session = await GameSession.create({
        taskId,
        subjectId,
        teacherId,
        category: 'party',
        gameType: 'buzzer_battle',
        roomCode: code,
        status: 'active',
        isTeamBased: true,
        startedAt: new Date()
      });

      console.log('✅ Session created:', session._id.toString());

      // Create room with bb object
      console.log('📡 Creating room and bb object...');
      const room = {
        hostSocketId: socket.id,
        students: new Map(),
        responses: new Map(),
        bb: {
          sessionId: session._id,
          taskId: taskId,
          subjectId: subjectId,
          teams: [],
          settings: task.settings || {},
          currentQuestion: null,
          buzzState: null,
          phase: 'lobby',
          globalCorrectAnsweredStudents: [], // Track which students have answered CORRECTLY across all questions
          disabledBuzzers: new Map() // Map of studentId -> teamId for students who buzzed correctly and can't buzz again until teammates answer correctly
        }
      };
      rooms.set(code, room);

      socket.join(code);
      socket.emit('bb:room-created', { roomCode: code, sessionId: session._id.toString() });
      console.log(`✅ Created Buzzer Battle room ${code} with session ${session._id}`);
    } catch (err) {
      console.error('❌ Failed to create Buzzer Battle room:', err);
      console.error('❌ Error details:', err.message, err.stack);
      socket.emit('bb:error', { message: 'Failed to create room: ' + err.message });
    }
  });

  // Buzzer Battle: Student joins
  socket.on('bb:join-room', ({ roomCode, studentId, studentName }) => {
    const code = (roomCode || '').toUpperCase();
    if (!rooms.has(code)) {
      socket.emit('bb:error', { message: 'Room not found' });
      return;
    }

    const room = rooms.get(code);
    const bb = ensureBb(code);
    if (!bb) return;

    socket.join(code);
    room.students.set(socket.id, { id: studentId, name: studentName, teamId: null, socketId: socket.id });

    const students = Array.from(room.students.values());
    io.to(code).emit('bb:lobby-update', { students, teams: bb.teams });
    console.log(`🔔 Student ${studentName} joined Buzzer Battle room ${code}`);
  });

  // Buzzer Battle: Create teams
  socket.on('bb:create-teams', ({ roomCode, teams }) => {
    const code = (roomCode || '').toUpperCase();
    const bb = ensureBb(code);
    if (!bb) return;

    bb.teams = teams.map(t => ({
      ...t,
      score: 0,
      streak: 0,
      longestStreak: 0, // Track the maximum streak value
      frozen: false,
      consecutiveWrong: 0,
      timesFrozen: 0 // Track how many times the team was frozen
    }));

    // Assign students to teams
    const room = rooms.get(code);
    teams.forEach(team => {
      team.memberIds.forEach(memberId => {
        for (const [socketId, student] of room.students.entries()) {
          if (student.id === memberId) {
            student.teamId = team.teamId;
          }
        }
      });
    });

    io.to(code).emit('bb:teams-created', { teams: bb.teams });
    console.log(`🔔 Teams created in room ${code}: ${bb.teams.length} teams`);
  });

  // Buzzer Battle: Start game
  socket.on('bb:start-game', async ({ roomCode }) => {
    const code = (roomCode || '').toUpperCase();
    const bb = ensureBb(code);
    if (!bb) return;

    // Create attempt record when game starts
    try {
      const BuzzerBattleAttempt = require('./models/BuzzerBattleAttempt');
      let attempt = await BuzzerBattleAttempt.findOne({ sessionId: bb.sessionId });
      
      if (!attempt) {
        attempt = await BuzzerBattleAttempt.create({
          sessionId: bb.sessionId,
          taskId: bb.taskId,
          subjectId: bb.subjectId,
          teamBuzzData: [],
          teamStats: [],
          status: 'completed',
          startedAt: new Date()
        });
        console.log(`✅ Created BuzzerBattleAttempt record for session ${bb.sessionId}`);
      }
    } catch (err) {
      console.error('❌ Failed to create attempt record:', err);
    }

    bb.phase = 'question';
    io.to(code).emit('bb:game-started');
    console.log(`🔔 Buzzer Battle game started in room ${code}`);
  });

  // Buzzer Battle: Start question with word-by-word reveal
  socket.on('bb:start-question', async ({ roomCode, questionIndex }) => {
    const code = (roomCode || '').toUpperCase();
    const bb = ensureBb(code);
    if (!bb) return;

    try {
      const BuzzerBattleTask = require('./models/BuzzerBattleTask');
      const task = await BuzzerBattleTask.findById(bb.taskId);
      const question = task.questions[questionIndex];

      // Reset frozen teams that were frozen for previous question
      bb.teams.forEach(team => {
        if (team.frozen && team.frozenUntilQuestion === questionIndex) {
          team.frozen = false;
        }
      });

      // Clear any existing reveal interval from previous question
      if (bb.currentQuestion && bb.currentQuestion.revealInterval) {
        clearInterval(bb.currentQuestion.revealInterval);
        console.log(`🧹 Cleared previous reveal interval before starting new question`);
      }

      bb.currentQuestion = {
        index: questionIndex,
        fullText: question.text,
        startTime: Date.now(),
        revealedWords: [],
        totalWords: question.text.split(' ').length,
        revealInterval: null
      };

      bb.buzzState = {
        buzzedTeam: null,
        buzzedStudentId: null, // Student who buzzed
        buzzedStudentName: null,
        buzzTime: null,
        buzzQueue: [],
        isAnswering: false,
        currentAnsweringStudentId: null, // Currently answering student
        currentAnsweringStudentName: null,
        answeredStudents: [], // Track which students have answered for this question
        stealAttempts: 0,
        wrongTeamId: null // Reset wrong team ID for new question
      };

      // Initialize per-question scoring
      bb.currentQuestion.pointsRemaining = typeof question.points === 'number' ? question.points : 0;
      // Start word-by-word reveal
      const words = question.text.split(' ');
      let index = 0;

      const revealSpeed = bb.settings.revealSpeed || 200;
      console.log(`🔔 Starting word reveal with speed: ${revealSpeed}ms, total words: ${words.length}`);

      bb.currentQuestion.revealInterval = setInterval(() => {
        if (index >= words.length || bb.buzzState.buzzedTeam) {
          clearInterval(bb.currentQuestion.revealInterval);
          console.log(`✅ Word reveal complete or buzzed. Revealed ${index}/${words.length} words`);
          return;
        }

        const currentWord = words[index];
        bb.currentQuestion.revealedWords.push(currentWord);
        console.log(`📤 Emitting word ${index + 1}/${words.length}: "${currentWord}"`);
        
        io.to(code).emit('bb:word-revealed', {
          word: currentWord,
          index,
          totalWords: words.length
        });

        index++;
      }, revealSpeed);

      console.log(`🔔 Question ${questionIndex} started in room ${code}`);
    } catch (err) {
      console.error('❌ Failed to start question:', err);
    }
  });

  // Buzzer Battle: Team buzzes in
  socket.on('bb:buzz-in', ({ roomCode, teamId, studentId, studentName }) => {
    const code = (roomCode || '').toUpperCase();
    const bb = ensureBb(code);
    if (!bb || !bb.currentQuestion) return;

    // Check if team is frozen
    const team = bb.teams.find(t => t.teamId === teamId);
    if (!team) {
      socket.emit('bb:error', { message: 'Team not found!' });
      return;
    }
    if (team.frozen) {
      socket.emit('bb:error', { message: 'Your team is frozen!' });
      return;
    }

    // NEW RULE: Check if this student's buzzer is disabled
    if (bb.disabledBuzzers && bb.disabledBuzzers.has(studentId)) {
      socket.emit('bb:error', { message: 'You cannot buzz yet! All your teammates must answer first.' });
      return;
    }

    // Prevent the team that got the wrong answer from stealing
    if (bb.buzzState.wrongTeamId && bb.buzzState.wrongTeamId === teamId) {
      socket.emit('bb:error', { message: 'Your team cannot steal after answering incorrectly!' });
      return;
    }

    // First buzz wins
    if (!bb.buzzState.buzzedTeam) {
      const buzzTime = Date.now() - bb.currentQuestion.startTime;
      const sawFullQuestion = bb.currentQuestion.revealedWords.length === bb.currentQuestion.totalWords;

      // Get student name from room if not provided
      const room = rooms.get(code);
      let actualStudentName = studentName;
      if (!actualStudentName && room) {
        for (const [sid, student] of room.students.entries()) {
          if (student.id === studentId) {
            actualStudentName = student.name;
            break;
          }
        }
      }

      bb.buzzState.buzzedTeam = teamId;
      bb.buzzState.buzzedStudentId = studentId;
      bb.buzzState.buzzedStudentName = actualStudentName || 'Unknown';
      bb.buzzState.buzzTime = buzzTime;
      bb.buzzState.isAnswering = true;
      bb.buzzState.answeredStudents = []; // Reset answered students for new question
      
      // Note: We will disable the buzzer ONLY if the answer is CORRECT (done in submit-answer handler)

      // Stop reveal
      if (bb.currentQuestion.revealInterval) {
        clearInterval(bb.currentQuestion.revealInterval);
      }

      // Start answer timeout countdown
      try {
        const limitSec = Number(bb.settings?.answerTimeLimit) > 0 ? Number(bb.settings.answerTimeLimit) : 30;
        if (bb.currentQuestion.answerTimeout) {
          clearTimeout(bb.currentQuestion.answerTimeout);
        }
        bb.currentQuestion.answerDeadline = Date.now() + limitSec * 1000;
        bb.currentQuestion.answerTimeout = setTimeout(async () => {
          // If still answering and same team hasn't answered, auto-mark wrong and proceed to steal or result
          const stillAnswering = bb && bb.buzzState && bb.buzzState.isAnswering && bb.buzzState.buzzedTeam === teamId;
          if (!stillAnswering) return;
          const BuzzerBattleTask = require('./models/BuzzerBattleTask');
          const BuzzerBattleAttempt = require('./models/BuzzerBattleAttempt');
          try {
            const task = await BuzzerBattleTask.findById(bb.taskId);
            const qIdx = bb?.currentQuestion?.index ?? 0;
            const question = task?.questions?.[qIdx] || { acceptedAnswers: '' };
            const teamRef = bb.teams.find(t => t.teamId === teamId);
            if (!teamRef) return;
            // apply wrong answer effects
            teamRef.streak = 0;
            teamRef.consecutiveWrong = (teamRef.consecutiveWrong || 0) + 1;
            let pointsAwarded = bb.settings.wrongAnswerPenalty || -10;
            teamRef.score += pointsAwarded;
            // decrease per-question remaining by 10 (min 0)
            if (bb.currentQuestion) {
              const startBase = (typeof question.points === 'number' ? question.points : 0);
              const prevRem = (typeof bb.currentQuestion.pointsRemaining === 'number') ? bb.currentQuestion.pointsRemaining : startBase;
              bb.currentQuestion.pointsRemaining = Math.max(0, prevRem - 10);
            }
            // persist attempt
            const attempt = await BuzzerBattleAttempt.findOne({ sessionId: bb.sessionId });
            if (attempt) {
              attempt.teamBuzzData.push({
                questionIndex: qIdx,
                teamId,
                teamName: teamRef.name,
                studentId: bb.buzzState.buzzedStudentId,
                studentName: bb.buzzState.buzzedStudentName || 'Unknown',
                buzzTimeMs: bb.buzzState.buzzTime || 0,
                sawFullQuestion: (bb.currentQuestion.revealedWords?.length || 0) === (bb.currentQuestion.totalWords || 0),
                submittedAnswer: '',
                isCorrect: false,
                pointsAwarded,
                wasSteal: false,
                responseTimeSec: limitSec,
                answeredBy: bb.buzzState.buzzedStudentId,
                answeredByName: bb.buzzState.buzzedStudentName || 'Unknown'
              });
              await attempt.save();
            }
            // re-enable any disabled buzzers if conditions met
            const reEnabledBuzzersWrong = [];
            if (bb.disabledBuzzers && bb.disabledBuzzers.size > 0) {
              for (const [disabledStudentId, disabledTeamId] of bb.disabledBuzzers.entries()) {
                const disabledTeam = bb.teams.find(t => t.teamId === disabledTeamId);
                if (disabledTeam) {
                  const teamMemberIds = disabledTeam.memberIds || [];
                  const otherTeammates = teamMemberIds.filter(mid => mid !== disabledStudentId);
                  const allTeammatesAnsweredCorrectly = otherTeammates.length === 0 ||
                    otherTeammates.every(mid => bb.globalCorrectAnsweredStudents.includes(mid));
                  if (allTeammatesAnsweredCorrectly) {
                    bb.disabledBuzzers.delete(disabledStudentId);
                    reEnabledBuzzersWrong.push(disabledStudentId);
                  }
                }
              }
            }
            const disabledBuzzersListWrong = bb.disabledBuzzers ? Array.from(bb.disabledBuzzers.keys()) : [];
            // clear answering state for steal phase
            bb.buzzState.isAnswering = false;
            bb.buzzState.currentAnsweringStudentId = null;
            bb.buzzState.currentAnsweringStudentName = null;
            bb.buzzState.answeredStudents = [];
            // Steal or end
            if (bb.settings.stealEnabled && bb.buzzState.stealAttempts < bb.settings.maxSteals) {
              bb.buzzState.buzzedTeam = null;
              bb.buzzState.buzzedStudentId = null;
              bb.buzzState.buzzedStudentName = null;
              bb.buzzState.stealAttempts++;
              bb.buzzState.wrongTeamId = teamId;
              io.to(code).emit('bb:steal-phase', {
                wrongTeamId: teamId,
                wrongTeamName: teamRef.name,
                remainingSteals: bb.settings.maxSteals - bb.buzzState.stealAttempts,
                disabledBuzzers: disabledBuzzersListWrong,
                reEnabledBuzzers: reEnabledBuzzersWrong
              });
            } else {
              io.to(code).emit('bb:answer-result', {
                teamId,
                isCorrect: false,
                correctAnswer: question.acceptedAnswers,
                pointsAwarded,
                newScore: teamRef.score,
                noMoreSteals: true,
                answeredBy: bb.buzzState.buzzedStudentId,
                answeredByName: bb.buzzState.buzzedStudentName || 'Unknown',
                disabledBuzzers: disabledBuzzersListWrong,
                reEnabledBuzzers: reEnabledBuzzersWrong
              });
            }
          } catch (e) {
            console.error('bb answer timeout handling failed:', e);
          }
        }, limitSec * 1000);
      } catch (e) {
        console.error('Failed to start answer timeout:', e);
      }

      // Show full question and inform clients of answer deadline for countdown UI
      const disabledBuzzersList = Array.from(bb.disabledBuzzers.keys());
      io.to(code).emit('bb:team-buzzed', {
        teamId,
        teamName: team.name,
        studentId,
        studentName: actualStudentName || 'Unknown',
        buzzTime,
        sawFullQuestion,
        fullQuestion: bb.currentQuestion.fullText,
        disabledBuzzers: disabledBuzzersList,
        answerDeadline: bb.currentQuestion.answerDeadline || null,
        answerTimeLimit: bb.settings?.answerTimeLimit || 30
      });

      console.log(`🔔 Team ${team.name} buzzed in room ${code} at ${buzzTime}ms by ${actualStudentName || studentId}`);
    }
  });

  // Buzzer Battle: Submit answer
  socket.on('bb:submit-answer', async ({ roomCode, teamId, answer, studentId, studentName }) => {
    const code = (roomCode || '').toUpperCase();
    const bb = ensureBb(code);
    if (!bb || bb.buzzState.buzzedTeam !== teamId) return;
    // Clear any running answer timeout
    if (bb.currentQuestion && bb.currentQuestion.answerTimeout) {
      try { clearTimeout(bb.currentQuestion.answerTimeout); } catch (e) {}
      bb.currentQuestion.answerTimeout = null;
      bb.currentQuestion.answerDeadline = null;
    }

    // Get student name from room if not provided
    const room = rooms.get(code);
    let actualStudentName = studentName;
    if (!actualStudentName && room && studentId) {
      for (const [sid, student] of room.students.entries()) {
        if (student.id === studentId) {
          actualStudentName = student.name;
          break;
        }
      }
    }

    // Get team members
    const team = bb.teams.find(t => t.teamId === teamId);
    if (!team) return;

    // Check if this student is the buzzer
    const isBuzzer = bb.buzzState.buzzedStudentId === studentId;
    
    // NEW RULE: Only the buzzer can submit answers - teammates cannot answer at all
    if (!isBuzzer) {
      socket.emit('bb:error', { 
        message: 'Only the student who buzzed in can submit the answer!' 
      });
      return;
    }
    
    // This is the buzzer - they can answer immediately (no need to wait for teammates)
    // Track that the buzzer has answered
    if (studentId && !bb.buzzState.answeredStudents.includes(studentId)) {
      bb.buzzState.answeredStudents.push(studentId);
    }
    
    // Note: We will add to globalCorrectAnsweredStudents ONLY if the answer is CORRECT (done after answer check)

    // Update who is currently answering
    bb.buzzState.currentAnsweringStudentId = studentId;
    bb.buzzState.currentAnsweringStudentName = actualStudentName || 'Unknown';

    // Emit who is answering to all spectators
    io.to(code).emit('bb:student-answering', {
      studentId,
      studentName: actualStudentName || 'Unknown',
      teamId,
      teamName: team.name
    });

    try {
      const BuzzerBattleTask = require('./models/BuzzerBattleTask');
      const BuzzerBattleAttempt = require('./models/BuzzerBattleAttempt');
      
      const task = await BuzzerBattleTask.findById(bb.taskId);
      const question = task.questions[bb.currentQuestion.index];

      // Check answer
      const acceptedAnswers = question.acceptedAnswers.split(',').map(a => a.trim().toLowerCase());
      const isCorrect = acceptedAnswers.includes(answer.trim().toLowerCase());

      let pointsAwarded = 0;
      let basePointsAwarded = 0;
      let earlyBonusAwarded = 0;
      const buzzTimeMs = bb.buzzState.buzzTime;
      const sawFullQuestion = bb.currentQuestion.revealedWords.length === bb.currentQuestion.totalWords;
      const wasSteal = !!bb.buzzState.wrongTeamId; // This is a steal attempt if there's a wrongTeamId

      if (isCorrect) {
        team.consecutiveWrong = 0;
        team.streak++;
        // Update longest streak if current streak is higher
        if (team.streak > (team.longestStreak || 0)) {
          team.longestStreak = team.streak;
        }

        // Base points from remaining for this question (fallback to question.points)
        const remainingBase = (bb.currentQuestion && typeof bb.currentQuestion.pointsRemaining === 'number')
          ? bb.currentQuestion.pointsRemaining
          : (typeof question.points === 'number' ? question.points : 0);
        basePointsAwarded = remainingBase;
        pointsAwarded = remainingBase;

        // Early buzz bonus
        if (!sawFullQuestion && bb.settings.allowPartialBuzz) {
          earlyBonusAwarded = bb.settings.earlyBuzzBonus || 10;
          pointsAwarded += earlyBonusAwarded;
        }

        // Streak multiplier
        if (team.streak >= 3) {
          const multiplier = 1 + ((team.streak - 2) * 0.5);
          pointsAwarded = Math.floor(pointsAwarded * multiplier);
        }

        team.score += pointsAwarded;

        // Save buzz data
        const attempt = await BuzzerBattleAttempt.findOne({ sessionId: bb.sessionId });
        if (attempt) {
          attempt.teamBuzzData.push({
            questionIndex: bb.currentQuestion.index,
            teamId,
            teamName: team.name,
            studentId: bb.buzzState.buzzedStudentId,
            studentName: bb.buzzState.buzzedStudentName,
            buzzTimeMs,
            sawFullQuestion,
            submittedAnswer: answer,
            isCorrect: true,
            pointsAwarded,
            wasSteal: wasSteal,
            responseTimeSec: (Date.now() - bb.currentQuestion.startTime - buzzTimeMs) / 1000,
            answeredBy: studentId,
            answeredByName: actualStudentName || 'Unknown'
          });
          await attempt.save();
        }

        // Clear wrongTeamId on successful answer (whether it's a steal or not)
        if (wasSteal) {
          bb.buzzState.wrongTeamId = null;
        }

        // NEW RULE: Disable the buzzer ONLY if the answer is CORRECT
        // Add to globalCorrectAnsweredStudents
        if (!bb.globalCorrectAnsweredStudents) {
          bb.globalCorrectAnsweredStudents = [];
        }
        if (studentId && !bb.globalCorrectAnsweredStudents.includes(studentId)) {
          bb.globalCorrectAnsweredStudents.push(studentId);
        }
        
        // First, check and re-enable disabled buzzers whose teammates have all answered CORRECTLY
        // (Do this BEFORE disabling the current buzzer)
        const reEnabledBuzzers = [];
        if (bb.disabledBuzzers && bb.disabledBuzzers.size > 0) {
          for (const [disabledStudentId, disabledTeamId] of bb.disabledBuzzers.entries()) {
            // Skip the current student - we'll disable them after this check
            if (disabledStudentId === studentId) continue;
            
            const disabledTeam = bb.teams.find(t => t.teamId === disabledTeamId);
            if (disabledTeam) {
              const teamMemberIds = disabledTeam.memberIds || [];
              const otherTeammates = teamMemberIds.filter(mid => mid !== disabledStudentId);
              // Check if all other teammates have answered CORRECTLY at least once
              // Include the current student in the check if they're on the same team
              const teammatesToCheck = disabledTeamId === teamId 
                ? [...otherTeammates, studentId] // Include current student if same team
                : otherTeammates;
              
              const allTeammatesAnsweredCorrectly = teammatesToCheck.length === 0 || 
                teammatesToCheck.every(mid => bb.globalCorrectAnsweredStudents.includes(mid));
              
              if (allTeammatesAnsweredCorrectly) {
                bb.disabledBuzzers.delete(disabledStudentId);
                reEnabledBuzzers.push(disabledStudentId);
              }
            }
          }
        }
        
        // Now disable this student's buzzer (they answered correctly)
        // If team has only one member, do NOT disable (no teammates to wait for)
        const teamSize = (team.memberIds && team.memberIds.length) ? team.memberIds.length : 1;
        if (teamSize > 1) {
          if (!bb.disabledBuzzers) {
            bb.disabledBuzzers = new Map();
          }
          bb.disabledBuzzers.set(studentId, teamId);
        }

        const disabledBuzzersList = bb.disabledBuzzers ? Array.from(bb.disabledBuzzers.keys()) : [];
        io.to(code).emit('bb:answer-result', {
          teamId,
          isCorrect: true,
          correctAnswer: question.acceptedAnswers,
          pointsAwarded,
          basePointsAwarded,
          earlyBonusAwarded,
          newScore: team.score,
          streak: team.streak,
          answeredBy: studentId,
          answeredByName: actualStudentName || 'Unknown',
          disabledBuzzers: disabledBuzzersList,
          reEnabledBuzzers: reEnabledBuzzers
        });

        console.log(`🔔 Team ${team.name} answered correctly in room ${code}: +${pointsAwarded} points`);

      } else {
        // Wrong answer
        team.streak = 0;
        team.consecutiveWrong++;
        pointsAwarded = bb.settings.wrongAnswerPenalty || -10;
        team.score += pointsAwarded;
        // Decrease per-question remaining base by 10 (min 0)
        if (bb.currentQuestion) {
          const startBase = (typeof question.points === 'number' ? question.points : 0);
          const prevRem = (typeof bb.currentQuestion.pointsRemaining === 'number') ? bb.currentQuestion.pointsRemaining : startBase;
          bb.currentQuestion.pointsRemaining = Math.max(0, prevRem - 10);
        }

        // Freeze penalty removed

        // Save buzz data
        const attempt = await BuzzerBattleAttempt.findOne({ sessionId: bb.sessionId });
        if (attempt) {
          attempt.teamBuzzData.push({
            questionIndex: bb.currentQuestion.index,
            teamId,
            teamName: team.name,
            studentId: bb.buzzState.buzzedStudentId,
            studentName: bb.buzzState.buzzedStudentName,
            buzzTimeMs,
            sawFullQuestion,
            submittedAnswer: answer,
            isCorrect: false,
            pointsAwarded,
            wasSteal: wasSteal,
            responseTimeSec: (Date.now() - bb.currentQuestion.startTime - buzzTimeMs) / 1000,
            answeredBy: studentId,
            answeredByName: actualStudentName || 'Unknown'
          });
          await attempt.save();
        }

        // For wrong answers: Don't disable the buzzer, but check if we can re-enable any disabled buzzers
        // (in case a teammate answered correctly in a previous question)
        const reEnabledBuzzersWrong = [];
        if (bb.disabledBuzzers && bb.disabledBuzzers.size > 0) {
          for (const [disabledStudentId, disabledTeamId] of bb.disabledBuzzers.entries()) {
            const disabledTeam = bb.teams.find(t => t.teamId === disabledTeamId);
            if (disabledTeam) {
              const teamMemberIds = disabledTeam.memberIds || [];
              const otherTeammates = teamMemberIds.filter(mid => mid !== disabledStudentId);
              // Check if all other teammates have answered CORRECTLY at least once
              const allTeammatesAnsweredCorrectly = otherTeammates.length === 0 || 
                otherTeammates.every(mid => bb.globalCorrectAnsweredStudents.includes(mid));
              
              if (allTeammatesAnsweredCorrectly) {
                bb.disabledBuzzers.delete(disabledStudentId);
                reEnabledBuzzersWrong.push(disabledStudentId);
              }
            }
          }
        }

        const disabledBuzzersListWrong = bb.disabledBuzzers ? Array.from(bb.disabledBuzzers.keys()) : [];

        // Check if steal allowed
        if (bb.settings.stealEnabled && bb.buzzState.stealAttempts < bb.settings.maxSteals) {
          bb.buzzState.buzzedTeam = null;
          bb.buzzState.buzzedStudentId = null;
          bb.buzzState.buzzedStudentName = null;
          bb.buzzState.isAnswering = false;
          bb.buzzState.currentAnsweringStudentId = null;
          bb.buzzState.currentAnsweringStudentName = null;
          bb.buzzState.answeredStudents = []; // Reset for steal phase
          bb.buzzState.stealAttempts++;
          // Track the team that answered incorrectly (update if this was already a steal)
          bb.buzzState.wrongTeamId = teamId;

          io.to(code).emit('bb:steal-phase', {
            wrongTeamId: teamId,
            wrongTeamName: team.name,
            remainingSteals: bb.settings.maxSteals - bb.buzzState.stealAttempts,
            disabledBuzzers: disabledBuzzersListWrong,
            reEnabledBuzzers: reEnabledBuzzersWrong
          });

          console.log(`🔔 Steal opportunity in room ${code}: ${bb.settings.maxSteals - bb.buzzState.stealAttempts} steals remaining`);
        } else {
          // No more steals
          io.to(code).emit('bb:answer-result', {
            teamId,
            isCorrect: false,
            correctAnswer: question.acceptedAnswers,
            pointsAwarded,
            newScore: team.score,
            noMoreSteals: true,
            answeredBy: studentId,
            answeredByName: actualStudentName || 'Unknown',
            disabledBuzzers: disabledBuzzersListWrong,
            reEnabledBuzzers: reEnabledBuzzersWrong
          });

          console.log(`🔔 Team ${team.name} answered wrong in room ${code}: ${pointsAwarded} points`);
        }
      }
    } catch (err) {
      console.error('❌ Failed to process answer:', err);
    }
  });

  // Buzzer Battle: Next question
  socket.on('bb:next-question', ({ roomCode }) => {
    const code = (roomCode || '').toUpperCase();
    const bb = ensureBb(code);
    if (!bb) return;

    // Clear reveal interval if it exists
    if (bb.currentQuestion && bb.currentQuestion.revealInterval) {
      clearInterval(bb.currentQuestion.revealInterval);
      console.log(`🧹 Cleared reveal interval in bb:next-question`);
    }

    bb.buzzState = null;
    bb.currentQuestion = null;
    io.to(code).emit('bb:next-question');
  });

  // Buzzer Battle: End game
  socket.on('bb:end-game', async ({ roomCode }) => {
    const code = (roomCode || '').toUpperCase();
    const bb = ensureBb(code);
    if (!bb) return;

    try {
      const BuzzerBattleAttempt = require('./models/BuzzerBattleAttempt');
      
      // Get attempt record (should already exist from game start)
      let attempt = await BuzzerBattleAttempt.findOne({ sessionId: bb.sessionId });
      
      if (!attempt) {
        // Fallback: create if it doesn't exist (shouldn't happen normally)
        console.warn(`⚠️ Attempt record not found for session ${bb.sessionId}, creating now...`);
        attempt = await BuzzerBattleAttempt.create({
          sessionId: bb.sessionId,
          taskId: bb.taskId,
          subjectId: bb.subjectId,
          teamBuzzData: [],
          teamStats: [],
          status: 'completed',
          startedAt: new Date(),
          endedAt: new Date()
        });
      }

      // Calculate team statistics
      const room = rooms.get(code);
      attempt.teamStats = bb.teams.map(team => {
        const teamBuzzes = attempt.teamBuzzData.filter(b => b.teamId === team.teamId);
        const correctBuzzes = teamBuzzes.filter(b => b.isCorrect);
        const wrongBuzzes = teamBuzzes.filter(b => !b.isCorrect);
        const steals = teamBuzzes.filter(b => b.wasSteal);
        const successfulSteals = steals.filter(b => b.isCorrect);
        
        const avgBuzzTime = teamBuzzes.length > 0
          ? teamBuzzes.reduce((sum, b) => sum + b.buzzTimeMs, 0) / teamBuzzes.length / 1000
          : 0;

        // Get member names
        const memberNames = team.memberIds.map(mid => {
          if (room && room.students) {
            const st = Array.from(room.students.values()).find(s => s.id === mid);
            return st ? st.name : mid;
          }
          return mid;
        });

        return {
          teamId: team.teamId,
          teamName: team.name,
          memberIds: team.memberIds,
          memberNames,
          finalScore: team.score,
          questionsAnswered: teamBuzzes.length,
          correctAnswers: correctBuzzes.length,
          wrongAnswers: wrongBuzzes.length,
          stealsAttempted: steals.length,
          stealsSuccessful: successfulSteals.length,
          averageBuzzTimeSec: avgBuzzTime,
          longestStreak: team.longestStreak || 0,
          timesFrozen: team.timesFrozen || 0
        };
      });

      attempt.endedAt = new Date();
      attempt.status = 'completed';
      await attempt.save();

      // Update session
      await GameSession.findByIdAndUpdate(bb.sessionId, {
        status: 'ended',
        endedAt: new Date()
      });

      io.to(code).emit('bb:game-finished', {
        teams: bb.teams,
        attemptId: attempt._id.toString()
      });

      console.log(`🔔 Buzzer Battle game ended in room ${code}`);
    } catch (err) {
      console.error('❌ Failed to end Buzzer Battle game:', err);
    }
  });

  socket.on('disconnect', () => {
    // Notify rooms where this socket was the host
    try {
      for (const [code, room] of rooms.entries()) {
        if (room.hostSocketId === socket.id) {
          console.log(`⚠️ Host disconnected for room ${code}`);
          io.to(code).emit('host_left');
          io.to(code).emit('force_leave', { reason: 'host_left' });
          // Optionally end any active DB session for this room
          try {
            GameSession.findOneAndUpdate(
              { roomCode: code, status: { $ne: 'ended' } },
              { status: 'ended', endedAt: new Date() },
              { new: true }
            ).catch(() => {});
          } catch {}
          // Do not delete room immediately to allow reconnection
          room.hostSocketId = null;
        }
      }
    } catch {}
    handleLeaveAllRooms();
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🎮 Game Server running on port ${PORT}`);
});