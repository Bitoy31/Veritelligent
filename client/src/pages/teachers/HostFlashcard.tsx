import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import io, { Socket } from 'socket.io-client';
import QRCode from 'react-qr-code';
import '../../styles/host_flashcard.css';

type Phase = 'lobby' | 'draw-student' | 'draw-question' | 'answering' | 'reveal' | 'finished';

interface Student {
  id: string;
  name: string;
  hasBeenCalled: boolean;
}

interface Question {
  questionIndex: number;
  text: string;
  type: 'multiple_choice' | 'text_input';
  options?: { text: string }[];
  points: number;
  hasTimer: boolean;
  timeLimitSec?: number;
  remainingQuestions?: number;
}

interface QuestionPreview {
  questionIndex: number;
  text: string;
  type: 'multiple_choice' | 'text_input';
  points: number;
  hasTimer: boolean;
}

const HostFlashcard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const socketRef = useRef<Socket | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const { taskId, subjectId, taskTitle } = location.state || {};
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const [roomCode] = useState(() => Math.random().toString(36).substring(2, 8).toUpperCase());
  const [phase, setPhase] = useState<Phase>('lobby');
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<{ id: string; name: string } | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [currentAnswer, setCurrentAnswer] = useState<{
    studentAnswer: string | number;
    helperData?: {
      helperId: string;
      helperName: string;
      helperAnswer: string | number;
      helperCorrect: boolean;
      helperPointsEarned: number;
    };
  } | null>(null);
  const [revealData, setRevealData] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [showHelperModal, setShowHelperModal] = useState(false);
  const [hintText, setHintText] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [showMechanicsModal, setShowMechanicsModal] = useState(false);
  const [availableQuestions, setAvailableQuestions] = useState<QuestionPreview[]>([]);
  const [callFriendActive, setCallFriendActive] = useState<{ helperId: string; helperName: string } | null>(null);

  useEffect(() => {
    if (!taskId || !subjectId) {
      alert('Missing task information');
      navigate('/teacher/flashcard');
      return;
    }

    // Initialize socket
    const socket = io('http://localhost:5000');
    socketRef.current = socket;

    // Register as host
    socket.emit('host_register', { roomCode });

    // Create flashcard session
    socket.emit('flashcard:create-room', {
      roomCode,
      taskId,
      subjectId,
      teacherId: user._id
    });

    // Socket listeners
    socket.on('flashcard:session-created', (data) => {
      setSessionId(data.sessionId);
      setTotalQuestions(data.totalQuestions);
      console.log('Session created:', data);
    });

    socket.on('flashcard:student-joined', (data) => {
      setStudents(data.students);
    });

    socket.on('flashcard:student-selected', (data) => {
      setSelectedStudent({ id: data.studentId, name: data.studentName });
      setPhase('draw-question');
    });

    socket.on('flashcard:questions-available', (data) => {
      setAvailableQuestions(data.questions);
      setPhase('draw-question');
    });

    socket.on('flashcard:question-selected', (data) => {
      setCurrentQuestion(data);
      setAvailableQuestions([]);
      setPhase('answering');
      if (data.hasTimer) {
        startTimer(data.timeLimitSec);
      }
    });

    socket.on('flashcard:hint-revealed', (data) => {
      setHintText(data.hint);
    });

    socket.on('flashcard:redraw-used', () => {
      setPhase('draw-question');
      setCurrentQuestion(null);
      setAvailableQuestions([]);
      clearTimer();
    });

    socket.on('flashcard:call-friend-used', (data) => {
      setShowHelperModal(true);
      setCurrentAnswer({ ...currentAnswer as any, helperData: data });
      setCallFriendActive({ helperId: data.helperId, helperName: data.helperName });
    });

    socket.on('flashcard:friend-answered', () => {
      setShowHelperModal(false);
    });

    socket.on('flashcard:reveal', (data) => {
      setRevealData(data);
      setPhase('reveal');
      clearTimer();
      setCallFriendActive(null); // Reset for next turn
      setShowHelperModal(false); // Close helper modal if open
    });

    socket.on('flashcard:next-turn', () => {
      resetTurn();
    });

    socket.on('flashcard:game-finished', () => {
      setPhase('finished');
      clearTimer();
    });

    socket.on('flashcard:no-students-available', () => {
      alert('No more students available!');
      setPhase('finished');
    });

    socket.on('flashcard:no-questions-available', () => {
      alert('All questions have been answered!');
      setPhase('finished');
    });

    socket.on('flashcard:error', (data) => {
      alert(data.message);
    });

    return () => {
      clearTimer();
      socket.disconnect();
    };
  }, [taskId, subjectId, roomCode]);

  const startTimer = (seconds: number) => {
    clearTimer();
    setTimeLeft(seconds);
    
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null) {
          clearTimer();
          return null;
        }
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          return 0; // Keep at 0 instead of clearing
        }
        return prev - 1;
      });
    }, 1000);
  };

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTimeLeft(null);
  };

  const resetTurn = () => {
    setSelectedStudent(null);
    setCurrentQuestion(null);
    setCurrentAnswer(null);
    setRevealData(null);
    setHintText('');
    setShowHelperModal(false);
    setPhase('draw-student');
    clearTimer();
  };

  const handleStartGame = () => {
    if (students.length === 0) {
      alert('Wait for students to join!');
      return;
    }
    socketRef.current?.emit('flashcard:start-game', { roomCode });
    setPhase('draw-student');
  };

  const handleDrawStudent = () => {
    socketRef.current?.emit('flashcard:draw-student-card', { roomCode });
  };

  const handleRequestQuestions = () => {
    socketRef.current?.emit('flashcard:request-questions', { roomCode });
  };

  const handleSelectQuestion = (questionIndex: number) => {
    socketRef.current?.emit('flashcard:select-question', { roomCode, questionIndex });
  };

  const handleNextTurn = () => {
    socketRef.current?.emit('flashcard:next-turn', { roomCode });
  };

  const handleEndGame = () => {
    if (!window.confirm('End the game?')) return;
    socketRef.current?.emit('flashcard:end-game', { roomCode });
  };

  const handleViewAnalytics = () => {
    navigate(`/teacher/flashcard-analytics/${sessionId}`);
  };

  return (
    <div className="hfc-page">
      {/* Header */}
      <div className="hfc-header">
        <button className="hfc-back-btn" onClick={() => navigate('/teacher/flashcard')}>
          <i className="fas fa-arrow-left"></i>
        </button>
        <div className="hfc-title-section">
          <h1 className="hfc-title">{taskTitle || 'Flashcard Game'}</h1>
          <div className="hfc-chips">
            <div className="hfc-chip">
              <i className="fas fa-door-open"></i>
              {roomCode}
            </div>
            <div className="hfc-chip">
              <i className="fas fa-users"></i>
              {students.length} students
            </div>
            <div className="hfc-chip">
              <i className="fas fa-layer-group"></i>
              {phase}
            </div>
          </div>
        </div>
        {phase !== 'finished' && (
          <button className="hfc-end-btn" onClick={handleEndGame}>
            <i className="fas fa-stop"></i> End Game
          </button>
        )}
      </div>

      {/* Content */}
      <div className="hfc-content">
        {/* Lobby Phase */}
        {phase === 'lobby' && (
          <div className="hfc-lobby">
            <div className="hfc-join-section">
              <h2>Waiting for Students</h2>
              <p>Students can join using the room code or QR code below</p>
              
              <div className="hfc-join-methods">
                <div className="hfc-room-code-card">
                  <h3>Room Code</h3>
                  <div className="hfc-code-display">{roomCode}</div>
                </div>
                <div className="hfc-qr-card">
                  <h3>QR Code</h3>
                  <QRCode 
                    value={`${window.location.origin}/student/flashcard/${roomCode}`}
                    size={180}
                  />
                </div>
              </div>

              <button 
                className="hfc-btn hfc-btn-secondary hfc-mechanics-btn"
                onClick={() => setShowMechanicsModal(true)}
              >
                <i className="fas fa-info-circle"></i> Game Mechanics
              </button>
            </div>

            <div className="hfc-students-panel">
              <h3>Joined Students ({students.length})</h3>
              <div className="hfc-students-list">
                {students.map(s => (
                  <div key={s.id} className="hfc-student-item">
                    <div className="hfc-student-avatar">
                      {s.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </div>
                    <span>{s.name}</span>
                  </div>
                ))}
                {students.length === 0 && (
                  <p className="hfc-empty">No students joined yet</p>
                )}
              </div>
              <button
                className="hfc-btn hfc-btn-primary"
                onClick={handleStartGame}
                disabled={students.length === 0}
              >
                <i className="fas fa-play"></i> Start Game
              </button>
            </div>
          </div>
        )}

        {/* Draw Student Phase */}
        {phase === 'draw-student' && (
          <div className="hfc-draw-student">
            <div className="hfc-instruction">
              <i className="fas fa-hand-pointer"></i>
              <p>Click the card to draw a student</p>
            </div>
            <div className="hfc-card-area">
              <div className="hfc-card-stack">
                <div className="hfc-card hfc-card-back"></div>
                <div className="hfc-card hfc-card-back"></div>
                <div className="hfc-card hfc-card-interactive" onClick={handleDrawStudent}>
                  <div className="hfc-card-front">
                    <i className="fas fa-user"></i>
                    <p>Student Card</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Draw Question Phase */}
        {phase === 'draw-question' && selectedStudent && (
          <div className="hfc-draw-question">
            <div className="hfc-selected-student">
              <h2>Selected Student</h2>
              <div className="hfc-student-badge">
                <div className="hfc-student-avatar-large">
                  {selectedStudent.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                </div>
                <h3>{selectedStudent.name}</h3>
              </div>
            </div>

            <div className="hfc-instruction">
              <i className="fas fa-hand-pointer"></i>
              <p>Pick a question card ({availableQuestions.length} available)</p>
            </div>
            
            <div className="hfc-facedown-grid">
              {availableQuestions.map((q, idx) => (
                <div 
                  key={q.questionIndex} 
                  className="hfc-facedown-card"
                  onClick={() => handleSelectQuestion(q.questionIndex)}
                  style={{ animationDelay: `${idx * 0.05}s` }}
                >
                  <div className="hfc-facedown-card-inner">
                    <i className="fas fa-question"></i>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Answering Phase */}
        {phase === 'answering' && currentQuestion && selectedStudent && (
          <div className="hfc-answering">
            <div className="hfc-question-display">
              <div className="hfc-question-header">
                <span className="hfc-question-label">Question {currentQuestion.questionIndex + 1}</span>
                <span className="hfc-points">{currentQuestion.points} points</span>
              </div>
              <h2 className="hfc-question-text">{currentQuestion.text}</h2>
              
              {currentQuestion.type === 'multiple_choice' && currentQuestion.options && (
                <div className="hfc-options-display">
                  {currentQuestion.options.map((opt, idx) => (
                    <div key={idx} className="hfc-option">
                      <span className="hfc-option-letter">{String.fromCharCode(65 + idx)}</span>
                      <span>{opt.text}</span>
                    </div>
                  ))}
                </div>
              )}

              {currentQuestion.hasTimer && timeLeft !== null && currentQuestion.timeLimitSec && (
                <div className="hfc-timer">
                  <div className="hfc-timer-circle">
                    <span>{timeLeft}s</span>
                  </div>
                  <div className="hfc-timer-bar">
                    <div 
                      className="hfc-timer-fill"
                      style={{ width: `${(timeLeft / currentQuestion.timeLimitSec) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {hintText && (
                <div className="hfc-hint-display">
                  <i className="fas fa-lightbulb"></i>
                  <span>Hint: {hintText}</span>
                </div>
              )}
            </div>

            <div className="hfc-answering-student">
              <h3>Answering: {selectedStudent.name}</h3>
              {callFriendActive ? (
                <p className="hfc-friend-helping">
                  <i className="fas fa-user-friends"></i>
                  {callFriendActive.helperName} is helping to answer...
                </p>
              ) : (
                <p>Waiting for answer...</p>
              )}
            </div>
          </div>
        )}

        {/* Reveal Phase */}
        {phase === 'reveal' && revealData && (
          <div className="hfc-reveal">
            <div className="hfc-reveal-header">
              <h2>{revealData.isCorrect ? '✅ Correct!' : '❌ Wrong!'}</h2>
              <div className="hfc-points-earned">
                {revealData.pointsEarned > 0 ? '+' : ''}{revealData.pointsEarned} points
              </div>
            </div>

            <div className="hfc-reveal-content">
              <div className="hfc-reveal-section">
                <h3>Correct Answer</h3>
                <div className="hfc-correct-answer">
                  {typeof revealData.correctAnswer === 'number'
                    ? String.fromCharCode(65 + revealData.correctAnswer)
                    : revealData.correctAnswer}
                </div>
              </div>

              <div className="hfc-reveal-section">
                <h3>Student Answer</h3>
                <div className={`hfc-student-answer ${revealData.isCorrect ? 'correct' : 'wrong'}`}>
                  {typeof revealData.studentAnswer === 'number'
                    ? String.fromCharCode(65 + revealData.studentAnswer)
                    : revealData.studentAnswer || 'No answer'}
                </div>
              </div>

              {revealData.helperData && (
                <div className="hfc-reveal-section">
                  <h3>Helper: {revealData.helperData.helperName}</h3>
                  <div className={`hfc-helper-answer ${revealData.helperData.helperCorrect ? 'correct' : 'wrong'}`}>
                    {typeof revealData.helperData.helperAnswer === 'number'
                      ? String.fromCharCode(65 + revealData.helperData.helperAnswer)
                      : revealData.helperData.helperAnswer || 'No answer'}
                  </div>
                  <div className="hfc-helper-points">
                    {revealData.helperData.helperPointsEarned > 0 ? '+' : ''}
                    {revealData.helperData.helperPointsEarned} points
                  </div>
                </div>
              )}
            </div>

            <button className="hfc-btn hfc-btn-primary" onClick={handleNextTurn}>
              <i className="fas fa-forward"></i> Next Turn
            </button>
          </div>
        )}

        {/* Finished Phase */}
        {phase === 'finished' && (
          <div className="hfc-finished">
            <div className="hfc-finish-icon">🎉</div>
            <h1>Game Complete!</h1>
            <p>All questions have been answered</p>
            
            <div className="hfc-finish-actions">
              <button className="hfc-btn hfc-btn-primary" onClick={handleViewAnalytics}>
                <i className="fas fa-chart-bar"></i> View Analytics
              </button>
              <button className="hfc-btn hfc-btn-secondary" onClick={() => navigate('/teacher/flashcard')}>
                <i className="fas fa-home"></i> Back to Management
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Helper Modal */}
      {showMechanicsModal && (
        <div className="hfc-modal-overlay" onClick={() => setShowMechanicsModal(false)}>
          <div className="hfc-modal-content hfc-mechanics-modal" onClick={(e) => e.stopPropagation()}>
            <div className="hfc-modal-header">
              <h3>
                <i className="fas fa-gamepad"></i> Game Mechanics
              </h3>
              <button className="hfc-modal-close" onClick={() => setShowMechanicsModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="hfc-mechanics-content">
              <ul>
                <li>
                  <i className="fas fa-user-circle"></i>
                  <span>Students are selected one-by-one via card draw</span>
                </li>
                <li>
                  <i className="fas fa-question-circle"></i>
                  <span>Selected student draws a question card</span>
                </li>
                <li>
                  <i className="fas fa-heart"></i>
                  <span>Each student has 3 life cards: Call a Friend, Hint, Re-draw</span>
                </li>
                <li>
                  <i className="fas fa-check-circle"></i>
                  <span>Answer correctly to earn points</span>
                </li>
                <li>
                  <i className="fas fa-trophy"></i>
                  <span>Game ends when all questions are answered</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {showHelperModal && (
        <div className="hfc-modal-overlay">
          <div className="hfc-modal-content">
            <h3>Call a Friend Active</h3>
            <p>Helper is answering the question...</p>
            <div className="hfc-loading">
              <i className="fas fa-spinner fa-spin"></i>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HostFlashcard;

