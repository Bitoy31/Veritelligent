import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import '../../styles/solo_quiz_game.css';
import '../../styles/student_live_quiz.css';

type RouteParams = { roomCode?: string };

interface QuestionOption { text: string; isCorrect: boolean; }
interface Question { text: string; options: QuestionOption[]; points: number; timeLimit: number; }

interface AnswerRecord {
  questionIndex: number;
  selectedOption: number;
  isCorrect: boolean;
  timeTakenSec: number;
  pointsEarned: number;
}

const StudentLiveQuiz: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams<RouteParams>();
  const roomCode = (params.roomCode || '').toUpperCase();
  const socketRef = useRef<Socket | null>(null);
  
  // Add attempt tracking
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());
  // Track game start time for accurate total duration
  const gameStartTimeRef = useRef<number | null>(null);

  const [phase, setPhase] = useState<'lobby' | 'countdown' | 'question' | 'results' | 'finished'>('lobby');
  
  // Add phase change logging
  useEffect(() => {
    console.log('🔄 Phase changed to:', phase);
  }, [phase]);
  
  // Add attemptId change logging
  useEffect(() => {
    console.log('🆔 AttemptId changed to:', attemptId);
    console.log('🆔 AttemptId ref is:', attemptIdRef.current);
  }, [attemptId]);
  const [students, setStudents] = useState<any[]>([]);
  const [isReady, setIsReady] = useState(true);
  
  // Add flag to prevent multiple submissions
  const hasSubmittedAttempt = useRef(false);
  
  // Add ref for attemptId to prevent state loss
  const attemptIdRef = useRef<string | null>(null);
  
  // Add timestamp for event deduplication
  const lastGameFinishedTime = useRef<number>(0);
  
  // Add refs to store answer data immediately and prevent state loss
  const currentAnswerRef = useRef<{
    questionIndex: number;
    selectedIndex: number;
    question: Question | null;
  } | null>(null);
  // Keep a mirror of answers to avoid state staleness at submission time
  const answersRef = useRef<AnswerRecord[]>([]);
  // Prevent duplicate processing of results per question
  const hasRecordedForQuestionRef = useRef<Record<number, boolean>>({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [question, setQuestion] = useState<Question | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [correctIndex, setCorrectIndex] = useState<number | null>(null);
  const [countdownValue, setCountdownValue] = useState<number>(3);
  const [quizMeta, setQuizMeta] = useState<{ title: string; subjectName?: string; subjectCode?: string; totalQuestions: number; totalPoints: number; totalTime: number; taskId?: string; sessionId?: string; subjectId?: string } | null>(null);
  const [showPlayersModal, setShowPlayersModal] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showFsPrompt, setShowFsPrompt] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Add ref to store metadata immediately
  const quizMetaRef = useRef<any>(null);

  // Simple alert modal state
  const [alertOpen, setAlertOpen] = useState<boolean>(false);
  const [alertTitle, setAlertTitle] = useState<string>('');
  const [alertMessage, setAlertMessage] = useState<string>('');
  const alertNavigateBackRef = useRef<boolean>(false);
  const showAlert = (title: string, message: string, navigateBack: boolean = false) => {
    setAlertTitle(title);
    setAlertMessage(message);
    alertNavigateBackRef.current = navigateBack;
    setAlertOpen(true);
  };

  const enterNativeFullscreen = async (): Promise<boolean> => {
    const el: any = containerRef.current;
    if (!el) return false;
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen || el.mozRequestFullScreen;
    if (req) {
      try {
        await req.call(el);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  };

  const exitNativeFullscreen = async (): Promise<void> => {
    const d: any = document as any;
    if (document.fullscreenElement || d.webkitFullscreenElement || d.msFullscreenElement || d.mozFullScreenElement) {
      const exit = document.exitFullscreen || d.webkitExitFullscreen || d.msExitFullscreen || d.mozCancelFullScreen;
      try { await exit.call(document); } catch {}
    }
  };

  const enterFullscreen = async () => {
    await enterNativeFullscreen();
    setIsFullscreen(true);
    document.documentElement.style.overflow = 'hidden';
  };

  const exitFullscreen = async () => {
    await exitNativeFullscreen();
    setIsFullscreen(false);
    document.documentElement.style.overflow = '';
  };

  const toggleFullscreen = async () => {
    if (isFullscreen) await exitFullscreen(); else await enterFullscreen();
  };

  const colors = useMemo(() => ['#8e44ad', '#2980b9', '#e67e22', '#27ae60'], []);

  // Create attempt when game starts
  const createAttempt = async () => {
    try {
      console.log('=== CREATE ATTEMPT DEBUG ===');
      console.log('quizMeta state:', quizMeta);
      console.log('quizMeta ref:', quizMetaRef.current);
      
      // Use ref for immediate access, fallback to state
      const currentMeta = quizMetaRef.current || quizMeta;
      
      // Safety check - ensure metadata exists
      if (!currentMeta) {
        console.error('❌ Cannot create attempt - no metadata available');
        return;
      }
      
      console.log('Using metadata for attempt creation:', currentMeta);
      console.log('currentMeta.taskId:', currentMeta?.taskId);
      console.log('currentMeta.sessionId:', currentMeta?.sessionId);
      console.log('currentMeta.subjectId:', currentMeta?.subjectId);
      
      // Only create attempt if we have proper metadata
      if (!currentMeta?.taskId || !currentMeta?.sessionId || !currentMeta?.subjectId) {
        console.log('Cannot create attempt - missing metadata:', currentMeta);
        return;
      }
      
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      console.log('User data:', user);
      
      const attemptData = {
        taskId: currentMeta.taskId,
        sessionId: currentMeta.sessionId, 
        subjectId: currentMeta.subjectId,
        studentId: user._id,
        category: 'solo',
        gameType: 'quiz',
        startedAt: new Date(),
        answers: [],
        scoringPolicy: {
          totalPointsPossible: currentMeta.totalPoints || 10,
          allowRetries: false,
          quickAnswerBonus: false,
          streakBonus: false
        },
        totalScore: 0,
        bonusPoints: 0,
        finalScore: 0,
        status: 'in_progress'
      };
      
      console.log('Creating attempt with data:', attemptData);
      
      const response = await fetch('https://api.veritelligent.fun/api/analytics/attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attemptData)
      });
      
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      if (response.ok) {
        const attempt = await response.json();
        setAttemptId(attempt._id);
        attemptIdRef.current = attempt._id; // Also set the ref
        hasSubmittedAttempt.current = false; // Reset flag for new attempt
        console.log('✅ Created attempt successfully:', attempt._id);
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to create attempt:', response.status, response.statusText, errorText);
      }
    } catch (error) {
      console.error('❌ Exception in createAttempt:', error);
    }
  };

  // Submit attempt when game finishes
  const submitAttempt = async () => {
    // Use ref instead of state to prevent state loss
    const currentAttemptId = attemptIdRef.current;
    
    if (!currentAttemptId) {
      console.error('❌ Cannot submit attempt - no attemptId');
      console.error('attemptId ref value:', currentAttemptId);
      console.error('attemptId state value:', attemptId);
      console.error('attemptId ref type:', typeof currentAttemptId);
      return;
    }
    
    // Prevent multiple submissions
    if (hasSubmittedAttempt.current) {
      console.log('⚠️ Attempt already submitted, skipping');
      return;
    }
    
    try {
      console.log('=== SUBMITTING ATTEMPT ===');
      console.log('Attempt ID:', currentAttemptId);
      console.log('Answers recorded (state):', answers);
      console.log('Answers recorded (ref):', answersRef.current);
      console.log('Answers length (state):', answers.length);
      console.log('Answers length (ref):', answersRef.current.length);
      console.log('Answers structure (state):', JSON.stringify(answers, null, 2));
      console.log('Answers structure (ref):', JSON.stringify(answersRef.current, null, 2));
      
      const finalAnswers = answers.length ? answers : answersRef.current;
      const totalScore = finalAnswers.reduce((sum, a) => sum + a.pointsEarned, 0);
      const baseStart = (gameStartTimeRef.current || questionStartTime);
      const timeSpent = Math.round((Date.now() - baseStart) / 1000);
      
      console.log('Total score calculated:', totalScore);
      console.log('Time spent:', timeSpent, 'seconds');
      
      const updateData = {
        answers: finalAnswers,
        totalScore,
        finalScore: totalScore,
        endedAt: new Date(),
        timeSpentSec: timeSpent,
        status: 'completed'
      };
      
      console.log('Submitting attempt update:', updateData);
      console.log('Update data JSON:', JSON.stringify(updateData, null, 2));
      
      const response = await fetch(`https://api.veritelligent.fun/api/analytics/attempts/${currentAttemptId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Attempt submitted successfully:', result);
        hasSubmittedAttempt.current = true; // Set flag to prevent duplicate submissions
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to submit attempt:', response.status, errorText);
      }
    } catch (error) {
      console.error('❌ Exception in submitAttempt:', error);
    }
  };

  useEffect(() => {
    const onFsChange = () => {
      const d: any = document as any;
      const active = !!(document.fullscreenElement || d.webkitFullscreenElement || d.msFullscreenElement || d.mozFullScreenElement);
      setIsFullscreen(active);
      if (!active) document.documentElement.style.overflow = '';
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange as any);
    document.addEventListener('msfullscreenchange', onFsChange as any);
    document.addEventListener('mozfullscreenchange', onFsChange as any);

    if (!socketRef.current) {
      const socket = io('https://api.veritelligent.fun', { withCredentials: true });
      socketRef.current = socket;
      const user = JSON.parse(localStorage.getItem('user') || '{}');

      socket.emit('join_room', {
        roomCode,
        student: { id: user._id, name: `${user.userFname} ${user.userLname}`, isReady },
      });
    }

    const s = socketRef.current;
    if (s) {
      s.on('lobby_update', (payload: { students: Array<{ id: string; name: string; isReady: boolean; avatar?: string }> }) => {
        setStudents(payload.students);
        setPhase('lobby');
      });

      s.on('quiz_meta', (payload: any) => {
        console.log('Received quiz metadata payload:', payload);
        
        // Handle both data structures:
        // 1. Direct metadata: { title, totalQuestions, taskId, ... }
        // 2. Wrapped metadata: { roomCode, meta: { title, totalQuestions, taskId, ... } }
        const metadata = payload.meta || payload;
        
        console.log('Extracted metadata:', metadata);
        
        // Validate metadata has required fields
        if (!metadata || typeof metadata !== 'object') {
          console.error('❌ Invalid metadata received:', payload);
          return;
        }
        
        setQuizMeta(metadata);
        quizMetaRef.current = metadata; // Store in ref
        
        // Confirm metadata receipt to host
        if (socketRef.current && payload.roomCode) {
          console.log('✅ Confirming metadata receipt to host...');
          socketRef.current.emit('metadata_confirmed', { roomCode: payload.roomCode });
        }
        
        // If we already have all required metadata and the game has started, create attempt
        if (metadata.taskId && metadata.sessionId && metadata.subjectId && phase !== 'lobby') {
          console.log('✅ Metadata received and game started, creating attempt...');
          setTimeout(() => createAttempt(), 500);
        }
      });

      s.on('start_game', () => {
        console.log('=== START GAME EVENT ===');
        console.log('Current quizMeta state:', quizMeta);
        console.log('Current quizMeta ref:', quizMetaRef.current);
        
        // Use ref for immediate access, fallback to state
        const currentMeta = quizMetaRef.current || quizMeta;
        
        console.log('Using metadata:', currentMeta);
        console.log('currentMeta.taskId:', currentMeta?.taskId);
        console.log('currentMeta.sessionId:', currentMeta?.sessionId);
        console.log('currentMeta.subjectId:', currentMeta?.subjectId);
        console.log('All required fields present:', !!(currentMeta?.taskId && currentMeta?.sessionId && currentMeta?.subjectId));
        
        setPhase('countdown');
        // Mark the session start when the game starts
        gameStartTimeRef.current = Date.now();
        
        // Create attempt when game starts, but only if we have metadata
        if (currentMeta?.taskId && currentMeta?.sessionId && currentMeta?.subjectId) {
          console.log('✅ Metadata available, creating attempt...');
          setTimeout(() => createAttempt(), 1000);
        } else {
          console.error('❌ Cannot start game - missing quiz metadata');
          console.log('Waiting for metadata to be populated...');
          // Wait a bit more for metadata to be populated
          setTimeout(() => {
            console.log('=== RETRY CHECK ===');
            console.log('quizMeta state after delay:', quizMeta);
            console.log('quizMeta ref after delay:', quizMetaRef.current);
            
            const retryMeta = quizMetaRef.current || quizMeta;
            if (retryMeta?.taskId && retryMeta?.sessionId && retryMeta?.subjectId) {
              console.log('✅ Metadata now available, creating attempt...');
              createAttempt();
            } else {
              console.error('❌ Still no metadata after delay');
            }
          }, 2000);
        }
      });

      s.on('countdown_update', (payload: { value: number }) => {
        setCountdownValue(payload.value);
      });

      s.on('question_start', (payload: { index: number; timeLimit: number; question: { text: string; options: QuestionOption[]; points: number } }) => {
        setPhase('question');
        setQuestionIndex(payload.index);
        setQuestion({ text: payload.question.text, options: payload.question.options, points: payload.question.points, timeLimit: payload.timeLimit });
        setTimeLeft(payload.timeLimit);
        setSelectedIndex(null);
        setCorrectIndex(null);
        setQuestionStartTime(Date.now());
        // Reset duplicate guard for this question
        hasRecordedForQuestionRef.current[payload.index] = false;
      });

      s.on('timer_tick', (payload: { timeLeft: number }) => {
        setTimeLeft(payload.timeLeft);
      });
      // Pause/resume handling from host
      s.on('pause_timer', (payload: { timeLeft: number }) => {
        setTimeLeft(payload.timeLeft);
      });
      s.on('resume_timer', (_payload: {}) => {
        // Host drives the countdown via timer_tick; nothing needed besides accepting ticks
      });

      s.on('results', (payload: { responses: Record<string, number>; correctIndex: number }) => {
        console.log('=== RESULTS EVENT RECEIVED ===');
        console.log('Payload:', payload);
        console.log('Current questionIndex:', questionIndex);
        console.log('Current selectedIndex:', selectedIndex);
        console.log('Current question:', question);
        console.log('Current answers array:', answers);
        console.log('Current answer ref data:', currentAnswerRef.current);
        
        setPhase('results');
        setCorrectIndex(payload.correctIndex);
        
        // Use ref data instead of potentially stale state
        const answerData = currentAnswerRef.current;
        
        // Record answer if we have answer data
        if (answerData && answerData.selectedIndex !== null && answerData.question) {
          if (hasRecordedForQuestionRef.current[answerData.questionIndex]) {
            console.log('⚠️ Already recorded results for question', answerData.questionIndex, '- skipping');
            return;
          }
          console.log('✅ Recording answer using ref data for question:', answerData.questionIndex);
          const isCorrect = answerData.selectedIndex === payload.correctIndex;
          const timeTaken = Math.round((Date.now() - questionStartTime) / 1000);
          const pointsEarned = isCorrect ? answerData.question.points : 0;
          
          const answerRecord: AnswerRecord = {
            questionIndex: answerData.questionIndex,
            selectedOption: answerData.selectedIndex,
            isCorrect,
            timeTakenSec: timeTaken,
            pointsEarned
          };
          
          console.log('Answer record to add:', answerRecord);
          // Update ref immediately to avoid losing data due to state timing
          answersRef.current = [...answersRef.current, answerRecord];
          setAnswers(prev => {
            const newAnswers = [...prev, answerRecord];
            console.log('Updated answers array:', newAnswers);
            return newAnswers;
          });
          
          // Clear the ref after recording
          currentAnswerRef.current = null;
          hasRecordedForQuestionRef.current[answerRecord.questionIndex] = true;
          console.log('✅ Answer recorded and ref cleared');
        } else {
          console.log('❌ Cannot record answer:', {
            hasAnswerData: !!answerData,
            selectedIndex: answerData?.selectedIndex,
            hasQuestion: !!answerData?.question,
            questionIndex: answerData?.questionIndex
          });
        }
      });

      s.on('game_finished', () => {
        const now = Date.now();
        console.log('🎯 Received game_finished event!');
        console.log('Current phase before change:', phase);
        console.log('Current attemptId ref:', attemptIdRef.current);
        console.log('Current attemptId state:', attemptId);
        console.log('Current answers:', answers);
        console.log('Has already submitted attempt:', hasSubmittedAttempt.current);
        console.log('Time since last event:', now - lastGameFinishedTime.current, 'ms');
        
        // Prevent multiple submissions within 2 seconds
        if (hasSubmittedAttempt.current || (now - lastGameFinishedTime.current) < 2000) {
          console.log('⚠️ Ignoring duplicate game_finished event');
          return;
        }
        
        lastGameFinishedTime.current = now;
        setPhase('finished');
        console.log('Phase set to finished, submitting attempt in 1 second...');
        
        // Check if we can submit immediately
        if (attemptIdRef.current) {
          console.log('✅ AttemptId available immediately, submitting now...');
          submitAttempt();
        } else {
          console.log('⏳ AttemptId not available, waiting 1 second...');
          setTimeout(() => submitAttempt(), 1000);
        }
      });

      // Server rejected joining (room invalid/no host)
      s.on('room_error', (payload: { code: string; message: string }) => {
        console.log('❌ Room error:', payload);
        setPhase('lobby');
        showAlert('Room not found', payload?.message || 'This room does not exist or has no host.', true);
      });

      // Host-triggered restart: abandon current attempt and go back to lobby
      s.on('game_restarted', () => {
        console.log('🔁 Received game_restarted - resetting to lobby');
        // Mark in-progress attempt as abandoned (if any)
        const currentAttemptId = attemptIdRef.current;
        if (currentAttemptId && !hasSubmittedAttempt.current) {
          try {
            const baseStart = (gameStartTimeRef.current || questionStartTime);
            const timeSpent = Math.round((Date.now() - baseStart) / 1000);
            fetch(`https://api.veritelligent.fun/api/attempts/${currentAttemptId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'abandoned', endedAt: new Date(), timeSpentSec: timeSpent })
            }).catch(() => {});
          } catch {}
        }
        // Reset local state
        setPhase('lobby');
        setQuestionIndex(0);
        setTimeLeft(0);
        setQuestion(null);
        setSelectedIndex(null);
        setCorrectIndex(null);
        setCountdownValue(3);
        setAnswers([]);
        answersRef.current = [];
        attemptIdRef.current = null;
        setAttemptId(null);
        hasSubmittedAttempt.current = false;
        hasRecordedForQuestionRef.current = {};
        currentAnswerRef.current = null;
        gameStartTimeRef.current = null;
      });

      // Host disconnected
      s.on('host_left', () => {
        console.log('⚠️ Host left - returning to lobby');
        setPhase('lobby');
        showAlert('Host left', 'The host has left the room. You have been returned to the lobby.', false);
      });

      // Force leave for any server-mandated reasons (e.g., host left)
      s.on('force_leave', (payload: { reason?: string }) => {
        console.log('🚪 Forced to leave room. Reason:', payload?.reason);
        // Abandon attempt if any
        const currentAttemptId = attemptIdRef.current;
        if (currentAttemptId && !hasSubmittedAttempt.current) {
          try {
            const baseStart = (gameStartTimeRef.current || questionStartTime);
            const timeSpent = Math.round((Date.now() - baseStart) / 1000);
            fetch(`https://api.veritelligent.fun/api/attempts/${currentAttemptId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'abandoned', endedAt: new Date(), timeSpentSec: timeSpent })
            }).catch(() => {});
          } catch {}
        }
        // Leave socket room and clean up
        try { s.emit('leave_room'); } catch {}
        // Reset local state and navigate out
        setPhase('lobby');
        showAlert('Session ended', 'The session has ended. Returning to the previous page.', true);
      });
    }

    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange as any);
      document.removeEventListener('msfullscreenchange', onFsChange as any);
      document.removeEventListener('mozfullscreenchange', onFsChange as any);
      if (socketRef.current) {
        try { socketRef.current.emit('leave_room'); } catch {}
        try { socketRef.current.disconnect(); } catch {}
        socketRef.current = null;
      }
    };
  }, [roomCode]);

  // No forced fullscreen

  const submitAnswer = (index: number) => {
    console.log('=== SUBMIT ANSWER CALLED ===');
    console.log('Selected index:', index);
    console.log('Current questionIndex:', questionIndex);
    console.log('Current question:', question);
    console.log('Socket available:', !!socketRef.current);
    
    if (!socketRef.current) {
      console.log('❌ No socket available');
      return;
    }
    
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    console.log('User submitting answer:', user._id);
    
    // Store answer data in ref immediately to prevent state loss
    currentAnswerRef.current = {
      questionIndex,
      selectedIndex: index,
      question
    };
    console.log('✅ Answer data stored in ref:', currentAnswerRef.current);
    
    // Allow changing answer before time is up
    setSelectedIndex(index);
    console.log('✅ Answer selected and stored:', index);
    
    socketRef.current.emit('submit_answer', { roomCode, studentId: user._id, optionIndex: index });
    console.log('📤 Answer submitted to server via socket');
  };

  const toggleReady = () => {
    if (!socketRef.current) return;
    const next = !isReady;
    setIsReady(next);
    socketRef.current.emit('set_ready', { roomCode, isReady: next });
    // No forced fullscreen on interaction
  };

  return (
    <div ref={containerRef} className={`solo-quiz-game slq-container ${isFullscreen ? 'fullscreen-overlay' : ''} ${phase === 'finished' ? 'complete' : ''}`}>
      {/* Fullscreen prompt removed; user can toggle via button */}
      <div className="game-header slq-header">
        <button className="back-button slq-back" onClick={() => navigate(-1)}>
          <i className="fas fa-arrow-left"></i>
        </button>
        <div className="game-info slq-title-wrap">
          <h2 className="slq-title">{quizMeta?.title || 'Live Quiz'}</h2>
          <div className="slq-meta">
            <span className="slq-chip" title="Room Code"><i className="fas fa-hashtag"></i> {roomCode}</span>
            {quizMeta?.subjectCode && <span className="slq-chip" title="Subject Code"><i className="fas fa-book"></i> {quizMeta.subjectCode}</span>}
            {quizMeta?.subjectName && <span className="slq-chip" title="Subject"><i className="fas fa-chalkboard"></i> {quizMeta.subjectName}</span>}
            {phase === 'question' && (
              <span className="slq-chip slq-counter" title="Question">Q{questionIndex + 1}/{quizMeta?.totalQuestions ?? '—'}</span>
            )}
          </div>
        </div>
        <button className="fs-btn slq-fs" onClick={toggleFullscreen} title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}>
          <i className={`fas ${isFullscreen ? 'fa-compress' : 'fa-expand'}`}></i>
        </button>
      </div>

      {phase === 'lobby' && (
        <div className="lobby-layout">
          <div className="lobby-main">
            <div className="loading-spinner" style={{ marginBottom: '0.75rem' }}>
              <i className="fas fa-users"></i>
              <p>Waiting for host to start...</p>
            </div>
            <button className="back-btn" onClick={toggleReady}>
              {isReady ? 'Mark Not Ready' : 'I am Ready'}
            </button>
            <div className="lobby-meta">
              <div className="meta-item">
                <div className="meta-label">Total Questions</div>
                <div className="meta-value">{quizMeta?.totalQuestions ?? '—'}</div>
              </div>
              <div className="meta-item">
                <div className="meta-label">Total Points</div>
                <div className="meta-value">{quizMeta?.totalPoints ?? '—'}</div>
              </div>
              <div className="meta-item">
                <div className="meta-label">Estimated Time</div>
                <div className="meta-value">{quizMeta ? Math.round(quizMeta.totalTime / 60) : '—'} min</div>
              </div>
            </div>

            {/* Mobile players button */}
            <button className="players-toggle" onClick={() => setShowPlayersModal(true)}>
              <i className="fas fa-user-friends"></i> Players ({students.length})
            </button>
          </div>

          {/* Desktop sidebar */}
          <aside className="players-sidebar">
            <div className="players-header">
              <h3>Players</h3>
              <span className="count-badge">{students.length}</span>
            </div>
            <div className="players-list">
              {students.map((s, i) => (
                <div key={s.id || i} className="player-row">
                  <div className="avatar-circle">{(s.name || '?').charAt(0)}</div>
                  <div className="player-info">
                    <div className="player-name">{s.name}</div>
                    <div className="player-status" style={{ color: s.isReady ? '#22c55e' : '#94a3b8' }}>{s.isReady ? 'Ready' : 'Waiting'}</div>
                  </div>
                </div>
              ))}
            </div>
          </aside>

          {/* Mobile modal */}
          {showPlayersModal && (
            <div className="players-modal-overlay" onClick={() => setShowPlayersModal(false)}>
              <div className="players-modal" onClick={(e) => e.stopPropagation()}>
                <div className="players-header">
                  <h3>Players</h3>
                  <span className="count-badge">{students.length}</span>
                </div>
                <div className="players-list">
                  {students.map((s, i) => (
                    <div key={s.id || i} className="player-row">
                      <div className="avatar-circle">{(s.name || '?').charAt(0)}</div>
                      <div className="player-info">
                        <div className="player-name">{s.name}</div>
                        <div className="player-status" style={{ color: s.isReady ? '#22c55e' : '#94a3b8' }}>{s.isReady ? 'Ready' : 'Waiting'}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <button className="modal-close" onClick={() => setShowPlayersModal(false)}>
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {phase === 'countdown' && (
        <div className="loading-spinner" style={{ marginTop: '3rem' }}>
          <i className="fas fa-hourglass-start"></i>
          <p>Starting in {countdownValue}...</p>
        </div>
      )}

      {phase === 'question' && question && (
        <>
          <div className="timer-container slq-timer-center">
            <div className="timer-circle">
              <span className="timer-value">{timeLeft}</span>
            </div>
          </div>
          <div className="question-display slq-question">
            <h2 className="question-text slq-question-text">{question.text}</h2>
          </div>
          <div className="answer-options">
            {question.options.map((opt, idx) => (
              <button
                key={idx}
                className={`answer-button ${selectedIndex === idx ? 'selected' : ''}`}
                style={{ backgroundColor: colors[idx] }}
                onClick={() => submitAnswer(idx)}
                disabled={false}
              >
                <div className="answer-content">
                  <div className="answer-shape">{['A','B','C','D'][idx] || ''}</div>
                  <div className="answer-text">{opt.text}</div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {phase === 'results' && (
        <div className="results-phase" style={{ marginTop: '2rem' }}>
          <div className="results-header">
            <h2>Question Results</h2>
          </div>

          <div className="correct-answer">
            <h3>Correct Answer:</h3>
            <div className="answer-reveal">
              {question?.options?.map((opt, idx) => (
                opt.isCorrect && (
                  <div key={idx} className="correct-option" style={{ backgroundColor: colors[idx] }}>
                    <div className="option-shape">{['A','B','C','D'][idx] || ''}</div>
                    <span>{opt.text}</span>
                    <i className="fas fa-check"></i>
                  </div>
                )
              ))}
            </div>
          </div>

          {correctIndex !== null && (
            <div style={{ marginTop: '0.75rem' }}>
              {selectedIndex !== null && (
                <div className="correct-answer" style={{ marginTop: 0 }}>
                  <h3 style={{ marginBottom: '0.5rem' }}>Your Answer:</h3>
                  <div className="answer-reveal">
                    <div className="correct-option" style={{ backgroundColor: colors[selectedIndex] }}>
                      <div className="option-shape">{['A','B','C','D'][selectedIndex] || ''}</div>
                      <span>{question?.options?.[selectedIndex]?.text || ''}</span>
                      <i className={`fas ${selectedIndex === correctIndex ? 'fa-check' : 'fa-times'}`}></i>
                    </div>
                  </div>
                </div>
              )}
              <div style={{ marginTop: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.6rem', borderRadius: '9999px', background: selectedIndex === correctIndex ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', color: selectedIndex === correctIndex ? '#16a34a' : '#dc2626' }}>
                <i className={`fas ${selectedIndex === correctIndex ? 'fa-check-circle' : 'fa-times-circle'}`}></i>
                <span style={{ fontWeight: 600 }}>{selectedIndex === correctIndex ? 'Correct' : 'Wrong'}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {phase === 'finished' && (
        <div className="game-complete" style={{ marginTop: '2rem' }}>
          <h1>🎉 Game Finished</h1>
          <p>Thanks for playing!</p>
        </div>
      )}

      {/* Simple Alert Modal */}
      {alertOpen && (
        <div className="players-modal-overlay" onClick={() => { setAlertOpen(false); if (alertNavigateBackRef.current) navigate(-1); }}>
          <div className="players-modal" onClick={(e) => e.stopPropagation()}>
            <div className="players-header">
              <h3>{alertTitle}</h3>
            </div>
            <div style={{ padding: '0.75rem 0' }}>{alertMessage}</div>
            <button className="modal-close" onClick={() => { setAlertOpen(false); if (alertNavigateBackRef.current) navigate(-1); }}>
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentLiveQuiz;

