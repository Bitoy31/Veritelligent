import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../../styles/host_quiz_game.css';
import { io, Socket } from 'socket.io-client';
import QRCode from 'react-qr-code';

interface Question {
  text: string;
  options: {
    text: string;
    isCorrect: boolean;
  }[];
  points: number;
  timeLimit: number;
}

interface Quiz {
  _id: string;
  subjectId: string; // added for session creation
  title: string;
  description: string;
  questions: Question[];
  settings: {
    timeLimit: number;
    passingScore: number;
  };
}

interface Student {
  id: string;
  name: string;
  joinedAt: Date;
  isReady: boolean;
  avatar?: string;
}

interface GameState {
  phase: 'lobby' | 'countdown' | 'question' | 'results' | 'leaderboard' | 'finished';
  currentQuestion: number;
  timeLeft: number;
  countdownValue: number;
  students: Student[];
  responses: { [studentId: string]: number };
}

const HostQuizGame: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const socketRef = useRef<Socket | null>(null);
  
  // Quiz and Room State
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [roomCode, setRoomCode] = useState('');
  const [sessionId, setSessionId] = useState<string>(''); // Add this to store the created session ID
  const [gameState, setGameState] = useState<GameState>({
    phase: 'lobby',
    currentQuestion: 0,
    timeLeft: 20,
    countdownValue: 3,
    responses: {},
    students: []
  });
  
  // Add flag to prevent multiple finish_game emissions
  const hasFinishedGame = useRef(false);
  
  // UI State
  const [showQRCode, setShowQRCode] = useState(false);
  const [activeBg, setActiveBg] = useState(false);
  const [loading, setLoading] = useState(true);
  const [answeredCount, setAnsweredCount] = useState<number>(0);
  const answeredStudentIds = useRef<Set<string>>(new Set());
  
  // Timer management using refs for immediate access
  const questionTimer = useRef<NodeJS.Timeout | null>(null);
  const countdownTimer = useRef<NodeJS.Timeout | null>(null);
  const [isProcessingResults, setIsProcessingResults] = useState(false);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef<boolean>(false);

  // Generate unique room code
  const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  // Cleanup function for timers
  const clearAllTimers = () => {
    console.log('Clearing all timers');
    if (questionTimer.current) {
      clearInterval(questionTimer.current);
      questionTimer.current = null;
    }
    if (countdownTimer.current) {
      clearInterval(countdownTimer.current);
      countdownTimer.current = null;
    }
    setIsTimerRunning(false);
    setIsProcessingResults(false);
  };

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, []);

  // Clear timers when phase changes
  useEffect(() => {
    if (gameState.phase === 'finished' || gameState.phase === 'lobby') {
      clearAllTimers();
    }
  }, [gameState.phase]);

  // Fetch quiz and setup room
  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        const response = await fetch(`https://api.veritelligent.fun/api/quiz/${quizId}`);
        if (response.ok) {
          const quizData = await response.json();
          setQuiz(quizData);
          setLoading(false);
          // Initialize socket and register host
          const socket = io('https://api.veritelligent.fun', { withCredentials: true });
          socketRef.current = socket;
          const codeToUse = generateRoomCode();
          setRoomCode(codeToUse);
          socket.emit('host_register', { roomCode: codeToUse });
          // Compute quiz meta and broadcast to room for lobby UI
          try {
            const totalQuestions = (quizData?.questions || []).length;
            const totalPoints = (quizData?.questions || []).reduce((sum: number, q: Question) => sum + (q.points || 0), 0);
            const totalTime = (quizData?.questions || []).reduce((sum: number, q: Question) => sum + (q.timeLimit || 0), 0);
            socket.emit('quiz_meta', {
              roomCode: codeToUse,
              meta: {
                title: quizData?.title || 'Live Quiz',
                totalQuestions,
                totalPoints,
                totalTime,
                taskId: quizData?._id,
                sessionId: '', // Will be set after session creation
                subjectId: quizData?.subjectId
              }
            });
          } catch (_) {}
          socket.on('host_registered', () => {
            // noop
          });
          // Receive lobby updates
          socket.on('lobby_update', (payload: { students: Student[] }) => {
            const { students } = payload;
            setGameState(prev => ({ ...prev, students }));
          });
          // Track incoming answers (unique by student id)
          socket.on('answer_received', ({ studentId }: { studentId: string }) => {
            answeredStudentIds.current.add(studentId);
            setAnsweredCount(answeredStudentIds.current.size);
          });

          // Results payload with response map
          socket.on('results', ({ responses }: { responses: Record<string, number> }) => {
            setGameState(prev => ({ ...prev, responses }));
          });
        }
      } catch (error) {
        console.error('Error fetching quiz:', error);
      }
    };

    if (quizId) {
      fetchQuiz();
    }
    return () => {
      // Cleanup socket
      if (socketRef.current) {
        try { socketRef.current.disconnect(); } catch {}
        socketRef.current = null;
      }
    };
  }, [quizId]);

  // Broadcast timer ticks to students (optional visual sync)
  useEffect(() => {
    if (!socketRef.current || !roomCode) return;
    if (gameState.phase !== 'question' || isPaused) return;
    socketRef.current.emit('timer_tick', { roomCode, timeLeft: gameState.timeLeft });
  }, [gameState.timeLeft, gameState.phase, roomCode, isPaused]);

  // Mock students for demo (in real app, this would come from WebSocket)
  useEffect(() => {
    // Simulate students joining
    const mockStudents: Student[] = [
      
    ];
    
    setGameState(prev => ({ ...prev, students: mockStudents }));
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (questionTimer.current) clearInterval(questionTimer.current);
      if (countdownTimer.current) clearInterval(countdownTimer.current);
    };
  }, [questionTimer, countdownTimer]);

  const startGame = () => {
    console.log('🚀 Starting game...');
    hasFinishedGame.current = false; // Reset finish game flag
    setGameState(prev => ({ 
      ...prev, 
      phase: 'countdown',
      countdownValue: 3,
      currentQuestion: 0,
      responses: {}
    }));
    
    // Notify students game start
    if (socketRef.current) socketRef.current.emit('start_game', { roomCode });

    // Create a DB session when hosting starts
    try {
      if (quiz) {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        fetch('https://api.veritelligent.fun/api/analytics/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskId: quiz._id,
            subjectId: quiz.subjectId,
            teacherId: user._id,
            category: 'solo',
            gameType: 'quiz',
            roomCode,
            status: 'active',
            settingsSnapshot: { timeLimit: quiz.settings?.timeLimit, passingScore: quiz.settings?.passingScore },
          }),
        }).then(async res => {
          if (res.ok) {
            const data = await res.json();
            setSessionId(data._id);
            console.log('Session created with ID:', data._id);
            
            // Update quiz meta with session ID for students
            if (socketRef.current && quiz) {
              const totalQuestions = (quiz?.questions || []).length;
              const totalPoints = (quiz?.questions || []).reduce((sum: number, q: Question) => sum + (q.points || 0), 0);
              const totalTime = (quiz?.questions || []).reduce((sum: number, q: Question) => sum + (q.timeLimit || 0), 0);
              socketRef.current.emit('quiz_meta', {
                roomCode,
                meta: {
                  title: quiz?.title || 'Live Quiz',
                  totalQuestions,
                  totalPoints,
                  totalTime,
                  taskId: quiz?._id,
                  sessionId: data._id,
                  subjectId: quiz?.subjectId
                }
              });
             
              // Wait a bit for students to process the metadata before starting countdown
              console.log('Quiz metadata sent, waiting for students to process...');
             
              // Add a delay to ensure metadata is processed
              setTimeout(() => {
                console.log('Starting countdown after metadata delay...');
                startCountdown();
              }, 2000); // Wait 2 seconds for metadata processing
            }
          } else {
            console.error('Error creating session:', res.status, res.statusText);
          }
        }).catch(err => {
          console.error('Error creating session:', err);
        });
      }
    } catch {}
  };

  const startCountdown = () => {
    let countdown = 3;
    const timer = setInterval(() => {
      countdown -= 1;
      if (countdown > 0) {
        setGameState(prev => ({ ...prev, countdownValue: countdown }));
        if (socketRef.current) socketRef.current.emit('countdown_update', { roomCode, value: countdown });
      } else {
        clearInterval(timer);
        countdownTimer.current = null;
        console.log('Countdown finished, starting first question');
        
        // Start first question
        const firstQuestionTimeLimit = quiz?.questions[0]?.timeLimit || 20;
        
        setGameState(prev => ({ 
          ...prev, 
          phase: 'question',
          currentQuestion: 0,
          timeLeft: firstQuestionTimeLimit,
          countdownValue: 0,
          responses: {}
        }));
        setIsPaused(false);
        
        // Broadcast first question to students
        if (socketRef.current && quiz) {
          socketRef.current.emit('question_start', {
            roomCode,
            index: 0,
            timeLimit: firstQuestionTimeLimit,
            question: { text: quiz.questions[0].text, options: quiz.questions[0].options, points: quiz.questions[0].points },
          });
        }

        // Small delay to ensure state is set before starting timer
        setTimeout(() => {
          // reset per-question counters
          answeredStudentIds.current = new Set();
          setAnsweredCount(0);
          startQuestionTimer();
        }, 100);
      }
    }, 1000);
    
    countdownTimer.current = timer;
  };

  const startQuestionTimer = () => {
    // Prevent multiple timers from starting
    if (isTimerRunning || isPausedRef.current) {
      console.log('Timer already running, ignoring start request');
      return;
    }
    
    // Clear any existing question timer
    if (questionTimer.current) {
      clearInterval(questionTimer.current);
      questionTimer.current = null;
    }
    
    setIsTimerRunning(true);
    console.log('Starting question timer for question:', gameState.currentQuestion, 'with time:', gameState.timeLeft);
    
    const timer = setInterval(() => {
      setGameState(prev => {
        console.log('Timer tick - Question:', prev.currentQuestion, 'Time left:', prev.timeLeft);
        if (prev.timeLeft <= 1) {
          clearInterval(timer);
          questionTimer.current = null;
          setIsTimerRunning(false);
          console.log('Timer finished for question:', prev.currentQuestion);
          
          // Use a setTimeout to avoid race conditions with state updates
          setTimeout(() => {
            if (!isProcessingResults) {
              console.log('Calling showQuestionResults from timer');
              showQuestionResults();
            } else {
              console.log('Already processing results, skipping timer call');
            }
          }, 100);
          
          return { ...prev, timeLeft: 0 };
        }
        return { ...prev, timeLeft: prev.timeLeft - 1 };
      });
    }, 1000);
    
    questionTimer.current = timer;
  };

  const showQuestionResults = () => {
    if (isProcessingResults) {
      console.log('Already processing results, ignoring call');
      return;
    }
    
    setIsProcessingResults(true);
    clearAllTimers(); // CRITICAL: Stop all timers immediately
    setIsPaused(false);
    
    console.log('=== SHOW QUESTION RESULTS ===');
    console.log('Current question before results:', gameState.currentQuestion);
    console.log('Total questions:', quiz?.questions.length);
    
    // Set to results phase first
    setGameState(prev => {
      console.log('Setting results phase - prev.currentQuestion:', prev.currentQuestion);
      const currentQuestionIndex = prev.currentQuestion;
      const totalQuestions = quiz?.questions.length || 0;
      const isLastQuestion = currentQuestionIndex >= totalQuestions - 1;
      
      console.log('=== QUESTION TRANSITION LOGIC ===');
      console.log('Current question index:', currentQuestionIndex);
      console.log('Total questions:', totalQuestions);
      console.log('Is last question calculation:', currentQuestionIndex, '>=', totalQuestions - 1, '=', isLastQuestion);
      
      if (isLastQuestion) {
        console.log('FINISHING GAME - this was the last question');
        
        // Prevent multiple finish_game emissions
        if (hasFinishedGame.current) {
          console.log('⚠️ Game already finished, skipping duplicate finish_game emission');
          return { ...prev, phase: 'finished' };
        }
        
        hasFinishedGame.current = true;
        
        // Reset flags and finish game
        setTimeout(() => {
          setIsProcessingResults(false);
        }, 100);
        // Broadcast final results once before finishing
        if (socketRef.current && quiz) {
          const correctIdx = (quiz.questions[currentQuestionIndex]?.options || []).findIndex(o => o.isCorrect);
          socketRef.current.emit('show_results', { roomCode, correctIndex: correctIdx });
        }
        console.log('🔄 Emitting finish_game event to room:', roomCode);
        if (socketRef.current) socketRef.current.emit('finish_game', { roomCode });
        
        // End the session in the database
        if (sessionId) {
          try {
            fetch(`https://api.veritelligent.fun/api/analytics/sessions/${sessionId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                status: 'ended',
                endedAt: new Date()
              })
            });
            console.log('Session ended successfully');
          } catch (err) {
            console.error('Failed to end session:', err);
          }
        }
        
        console.log('🔄 Setting game phase to finished');
        return { ...prev, phase: 'finished' };
      } else {
        // Show results for 3 seconds, then move to next question
        // Broadcast results now
        if (socketRef.current && quiz) {
          const correctIdx = (quiz.questions[currentQuestionIndex]?.options || []).findIndex(o => o.isCorrect);
          socketRef.current.emit('show_results', { roomCode, correctIndex: correctIdx });
        }
        setTimeout(() => {
          const nextQuestionIndex = currentQuestionIndex + 1;
          const nextQuestionTimeLimit = quiz?.questions[nextQuestionIndex]?.timeLimit || 20;
          
          console.log('MOVING TO NEXT QUESTION:', nextQuestionIndex);
          console.log('Next question time limit:', nextQuestionTimeLimit);
          
          setGameState(currentState => ({
            ...currentState,
            phase: 'question',
            currentQuestion: nextQuestionIndex,
            timeLeft: nextQuestionTimeLimit,
            responses: {}
          }));
          
          // Start timer for next question with proper delay
          setTimeout(() => {
            setIsProcessingResults(false);
            setIsTimerRunning(false);
            setIsPaused(false);
            // Broadcast next question
            if (socketRef.current && quiz) {
              socketRef.current.emit('question_start', {
                roomCode,
                index: nextQuestionIndex,
                timeLimit: nextQuestionTimeLimit,
                question: { text: quiz.questions[nextQuestionIndex].text, options: quiz.questions[nextQuestionIndex].options, points: quiz.questions[nextQuestionIndex].points },
              });
            }
            // reset per-question counters
            answeredStudentIds.current = new Set();
            setAnsweredCount(0);
            startQuestionTimer();
          }, 200);
        }, 3000);
        
        return { ...prev, phase: 'results' };
      }
    });
  };

  const generateQrAndBG = () => {
    setShowQRCode(!showQRCode);
    setActiveBg(!activeBg); // toggle class
  }

  const getReadyCount = () => {
    return gameState.students.filter(s => s.isReady).length;
  };

  const getResponseCount = () => {
    return Object.keys(gameState.responses).length;
  };

  const getAnswerColors = () => {
    return ['#8e44ad', '#2980b9', '#e67e22', '#27ae60']; // Purple, Blue, Orange, Green
  };

  const getAnswerLetter = (index: number) => ['A', 'B', 'C', 'D'][index] || '';

  if (loading || !quiz) {
    return (
      <div className="host-quiz-game loading">
        <div className="loading-spinner">
          <i className="fas fa-spinner fa-spin"></i>
          <p>Setting up quiz room...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="host-quiz-game">
      {/* Header */}
      <div className="host-header">
        <button className="back-btn" onClick={() => navigate('/teacher/quiz')}>
          <i className="fas fa-arrow-left"></i> Back to Quizzes
        </button>
        <div className="quiz-info">
          <h1>{quiz.title}</h1>
          <span className="question-count">{quiz.questions.length} Questions</span>
        </div>
        <div className="room-code-display">
          <span className="room-label">Room Code</span>
          <span className="room-code">{roomCode}</span>
          {/* Debug info */}
          <div style={{ fontSize: '0.8rem', marginTop: '1rem', opacity: 0.7 }}>
            Q: {gameState.currentQuestion + 1}/{quiz?.questions.length || 0} | Phase: {gameState.phase} | Time: {gameState.timeLeft}s | Processing: {isProcessingResults ? 'YES' : 'NO'}
          </div>
        </div>
      </div>

      {gameState.phase === 'question' && (
        <div className="timer-topbar">
          <div
            className="timer-topbar-fill"
            style={{ width: `${(gameState.timeLeft / (quiz.questions[gameState.currentQuestion]?.timeLimit || 20)) * 100}%` }}
          />
        </div>
      )}

      {/* Lobby Phase */}
      {gameState.phase === 'lobby' && (
        <div className="lobby-phase">
          <div className="lobby-main">
            <div className="waiting-area">
              <h2>🎯 Waiting for Students</h2>
              <p>Students can join using the room code: <strong>{roomCode}</strong></p>
              
              <div className="join-methods">
                <div className="room-code-card">
                  <h3>Room Code</h3>
                  <div className="code-display">{roomCode}</div>
                  <p>Enter this code to join</p>
                </div>
                
                <div className="qr-code-card">
                  <h3>QR Code</h3>
                  <div className={`qr-placeholder ${activeBg ? 'active' : ''}`}>
                    {showQRCode ? (
                      <QRCode 
                        value={`${roomCode}`}
                        size={110}
                        bgColor="#ffffff"
                        fgColor="#000000"
                        style={{ display: 'block', width: 110, height: 110, padding: 15}}
                      />
                    ) : (
                      <>
                        <i className="fas fa-qrcode"></i>
                        <p>QR Code</p>
                      </>
                    )}
                  </div>
                  <button className="generate-qr-btn" onClick={generateQrAndBG}>
                    {showQRCode ? 'Hide QR' : 'Generate QR'}
                  </button>
                </div>
              </div>
            </div>

            <div className="students-panel">
              <div className="students-header">
                <h3>Students ({gameState.students.length})</h3>
                <span className="ready-count">
                  {getReadyCount()}/{gameState.students.length} Ready
                </span>
              </div>
              
              <div className="students-list">
                {gameState.students.map((student) => (
                  <div key={student.id} className={`student-card ${student.isReady ? 'ready' : 'waiting'}`}>
                    <div className="student-avatar">
                      {student.avatar ? (
                        <img src={student.avatar} alt={student.name} />
                      ) : (
                        <div className="avatar-placeholder">
                          {student.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="student-info">
                      <span className="student-name">{student.name}</span>
                      <span className="student-status">
                        {student.isReady ? '✅ Ready' : '⏳ Joining...'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="lobby-actions">
                <button 
                  className={`start-game-btn ${getReadyCount() > 0 ? 'enabled' : 'disabled'}`}
                  onClick={startGame}
                  disabled={getReadyCount() === 0}
                >
                  <i className="fas fa-play"></i>
                  Start Game ({getReadyCount()} players)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Countdown Phase */}
      {gameState.phase === 'countdown' && (
        <div className="countdown-phase">
          <div className="countdown-display">
            <h1>Get Ready!</h1>
            <div className="countdown-timer">{gameState.countdownValue}</div>
            <p>Game starting soon...</p>
          </div>
        </div>
      )}

      {/* Question Phase */}
      {gameState.phase === 'question' && (
        <div className="question-phase">
          <div className="question-header minimal">
            <div className="question-info">
              <div className="qi-left">
                <span className="question-number">
                  Question {gameState.currentQuestion + 1} of {quiz.questions.length}
                </span>
              </div>

              <div className="qi-center action-buttons">
                <button
                  className={`icon-btn pause-btn ${isPaused ? 'resume' : ''}`}
                  title={isPaused ? 'Resume' : 'Pause'}
                  aria-label={isPaused ? 'Resume' : 'Pause'}
                  onClick={() => {
                    if (!isPaused) {
                      if (questionTimer.current) {
                        clearInterval(questionTimer.current);
                        questionTimer.current = null;
                      }
                      setIsTimerRunning(false);
                      isPausedRef.current = true;
                      setIsPaused(true);
                      if (socketRef.current) socketRef.current.emit('pause_timer', { roomCode, timeLeft: gameState.timeLeft });
                    } else {
                      isPausedRef.current = false;
                      setIsPaused(false);
                      // Defer to ensure state is updated before starting timer
                      setTimeout(() => startQuestionTimer(), 0);
                      if (socketRef.current) socketRef.current.emit('resume_timer', { roomCode });
                    }
                  }}
                  disabled={isProcessingResults}
                >
                  <i className={`fas ${isPaused ? 'fa-play' : 'fa-pause'}`}></i>
                </button>

                <button
                  className="icon-btn skip-btn"
                  title="Skip to results"
                  aria-label="Skip to results"
                  onClick={() => {
                    if (questionTimer.current) {
                      clearInterval(questionTimer.current);
                      questionTimer.current = null;
                    }
                    setIsTimerRunning(false);
                    showQuestionResults();
                  }}
                  disabled={isProcessingResults}
                >
                  <i className="fas fa-forward"></i>
                </button>
              </div>

              <div className="qi-right">
                <span className="response-chip">
                  {answeredCount}/{gameState.students.length} answered
                </span>
              </div>
            </div>
          </div>

          <div className="question-display compact">
            <h1>{quiz.questions[gameState.currentQuestion]?.text || 'Loading question...'}</h1>
          </div>

          <div className="answer-options compact">
            {quiz.questions[gameState.currentQuestion]?.options?.map((option, index) => (
              <div
                key={index}
                className="answer-option teacher-display"
                style={{ backgroundColor: getAnswerColors()[index] }}
              >
                <div className="option-shape">{getAnswerLetter(index)}</div>
                <span className="option-text">{option.text}</span>
              </div>
            )) || <div>Loading options...</div>}
          </div>
        </div>
      )}

      {/* Results Phase */}
      {gameState.phase === 'results' && (
        <div className="results-phase">
          <div className="results-header">
            <h2>Question Results</h2>
          </div>

          <div className="correct-answer">
            <h3>Correct Answer:</h3>
            <div className="answer-reveal">
              {quiz.questions[gameState.currentQuestion]?.options.map((option, index) => (
                option.isCorrect && (
                  <div key={index} className="correct-option" style={{ backgroundColor: getAnswerColors()[index] }}>
                    <div className="option-shape">{getAnswerLetter(index)}</div>
                    <span>{option.text}</span>
                    <i className="fas fa-check"></i>
                  </div>
                )
              ))}
            </div>
          </div>

          <div className="response-breakdown">
            <h3>Student Responses:</h3>
            <div className="responses-grid" style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 16, height: 180, width: '100%' }}>
              {quiz.questions[gameState.currentQuestion]?.options.map((option, index) => {
                const responseCount = Object.values(gameState.responses || {}).filter(r => r === index).length;
                const percentage = gameState.students.length > 0 ? (responseCount / gameState.students.length) * 100 : 0;
                return (
                  <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 44, height: '100%' }}>
                    <span className="option-label" style={{ color: getAnswerColors()[index], fontWeight: 700, marginBottom: 6 }}>{getAnswerLetter(index)}</span>
                    <div className="bar-container" style={{ height: '100%', display: 'flex', alignItems: 'flex-end' }}>
                      <div
                        className="bar-fill"
                        style={{
                          width: 28,
                          height: `${Math.max(percentage, 2)}%`,
                          backgroundColor: getAnswerColors()[index],
                          borderRadius: 6,
                          transition: 'height 0.3s ease'
                        }}
                      />
                    </div>
                    <span className="response-count" style={{ marginTop: 6 }}>{responseCount}</span>
                    <span className="percentage" style={{ fontSize: 12, color: '#6b7280' }}>{Math.round(percentage)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Game Finished */}
      {gameState.phase === 'finished' && (
        <div className="finished-phase">
          <div className="game-complete">
            <h1>🎉 Quiz Complete!</h1>
            <p>Great job everyone!</p>
            
            <div className="final-actions">
              <button className="play-again-btn" onClick={() => window.location.reload()}>
                <i className="fas fa-redo"></i> Host Again
              </button>
              <button className="back-btn" onClick={() => navigate('/teacher/quiz')}>
                <i className="fas fa-arrow-left"></i> Back to Quizzes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HostQuizGame;