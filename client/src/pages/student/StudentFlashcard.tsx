import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io, { Socket } from 'socket.io-client';
import '../../styles/student_flashcard.css';

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
  timeLimitSec: number;
}

interface QuestionPreview {
  questionIndex: number;
  text: string;
  type: 'multiple_choice' | 'text_input';
  points: number;
  hasTimer: boolean;
}

interface LifeCards {
  callFriend: boolean;
  hint: boolean;
  redraw: boolean;
}

const StudentFlashcard: React.FC = () => {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const socketRef = useRef<Socket | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const studentId = user._id;
  const studentName = `${user.userFname} ${user.userLname}`;

  const [phase, setPhase] = useState<Phase>('lobby');
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedStudentName, setSelectedStudentName] = useState<string>('');
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [myAnswer, setMyAnswer] = useState<string | number>('');
  const [lifeCards, setLifeCards] = useState<LifeCards>({
    callFriend: true,
    hint: true,
    redraw: true
  });
  const [hintText, setHintText] = useState('');
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [revealData, setRevealData] = useState<any>(null);
  const [showFriendModal, setShowFriendModal] = useState(false);
  const [friendQuestion, setFriendQuestion] = useState<any>(null);
  const [friendAnswer, setFriendAnswer] = useState<string | number>('');
  const [showSelectFriendModal, setShowSelectFriendModal] = useState(false);
  const [selectedFriendId, setSelectedFriendId] = useState<string>('');
  const [myTurns, setMyTurns] = useState(0);
  const [myScore, setMyScore] = useState(0);
  const [availableQuestions, setAvailableQuestions] = useState<QuestionPreview[]>([]);
  const [waitingForFriend, setWaitingForFriend] = useState(false);

  const isMyTurn = selectedStudentId === studentId && !waitingForFriend;

  // Auto-submit when timer reaches 0
  useEffect(() => {
    if (timeLeft === 0 && phase === 'answering' && selectedStudentId === studentId && !waitingForFriend) {
      console.log('⏰ Timer expired, auto-submitting answer');
      // Auto-submit with current answer (empty if not filled)
      const timer = setTimeout(() => {
        socketRef.current?.emit('flashcard:submit-answer', {
          roomCode,
          studentId,
          answer: currentQuestion?.type === 'text_input' ? myAnswer : undefined,
          selectedOption: currentQuestion?.type === 'multiple_choice' ? myAnswer : undefined
        });
      }, 100); // Small delay to ensure UI updates
      
      return () => clearTimeout(timer);
    }
  }, [timeLeft, phase, selectedStudentId, studentId, waitingForFriend, roomCode, currentQuestion, myAnswer]);

  useEffect(() => {
    if (!roomCode) {
      alert('No room code provided');
      navigate('/student/solo-games/flashcard/join');
      return;
    }

    // Initialize socket
    const socket = io('https://api.veritelligent.fun');
    socketRef.current = socket;

    // Join room
    socket.emit('flashcard:join', {
      roomCode: roomCode.toUpperCase(),
      student: {
        id: studentId,
        name: studentName
      }
    });

    // Socket listeners
    socket.on('flashcard:student-joined', (data) => {
      setStudents(data.students);
    });

    socket.on('flashcard:game-started', () => {
      setPhase('draw-student');
    });

    socket.on('flashcard:student-selected', (data) => {
      setSelectedStudentId(data.studentId);
      setSelectedStudentName(data.studentName);
      setPhase('draw-question');
      if (data.studentId === studentId) {
        setMyTurns(prev => prev + 1);
      }
    });

    socket.on('flashcard:questions-available', (data) => {
      setAvailableQuestions(data.questions);
    });

    socket.on('flashcard:question-selected', (data) => {
      setCurrentQuestion(data);
      setAvailableQuestions([]);
      setPhase('answering');
      setMyAnswer('');
      setHintText('');
      if (data.hasTimer) {
        startTimer(data.timeLimitSec);
      }
    });

    socket.on('flashcard:hint-revealed', (data) => {
      if (data.studentId === studentId) {
        setHintText(data.hint);
        setLifeCards(prev => ({ ...prev, hint: false }));
      }
    });

    socket.on('flashcard:redraw-used', (data) => {
      if (data.studentId === studentId) {
        setLifeCards(prev => ({ ...prev, redraw: false }));
      }
      setPhase('draw-question');
      setCurrentQuestion(null);
      setMyAnswer('');
      setHintText('');
      clearTimer();
    });

    socket.on('flashcard:call-friend-used', (data) => {
      if (data.studentId === studentId) {
        setLifeCards(prev => ({ ...prev, callFriend: false }));
        setWaitingForFriend(true); // Original student becomes spectator
        console.log('📞 Called a friend, now waiting for their answer');
      }
    });

    socket.on('flashcard:friend-help-request', (data) => {
      // I'm being asked to help
      setFriendQuestion(data);
      setFriendAnswer('');
      setShowFriendModal(true);
    });

    socket.on('flashcard:friend-answered', () => {
      setShowFriendModal(false);
    });

    socket.on('flashcard:reveal', (data) => {
      setRevealData(data);
      setPhase('reveal');
      clearTimer();
      setWaitingForFriend(false); // Reset for next turn
      
      // Update my score if I was involved
      if (selectedStudentId === studentId) {
        setMyScore(prev => prev + data.pointsEarned);
      }
      if (data.helperData && data.helperData.helperId === studentId) {
        setMyScore(prev => prev + data.helperData.helperPointsEarned);
      }
    });

    socket.on('flashcard:next-turn', () => {
      resetTurn();
    });

    socket.on('flashcard:game-finished', () => {
      setPhase('finished');
      clearTimer();
    });

    socket.on('flashcard:error', (data) => {
      alert(data.message);
    });

    return () => {
      clearTimer();
      socket.disconnect();
    };
  }, [roomCode, studentId]);

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
    setSelectedStudentId(null);
    setSelectedStudentName('');
    setCurrentQuestion(null);
    setMyAnswer('');
    setHintText('');
    setRevealData(null);
    setPhase('draw-student');
    setWaitingForFriend(false);
    clearTimer();
  };

  const handleRequestQuestions = () => {
    socketRef.current?.emit('flashcard:request-questions', { roomCode });
  };

  const handleSelectQuestion = (questionIndex: number) => {
    socketRef.current?.emit('flashcard:select-question', { roomCode, questionIndex });
  };

  const handleUseHint = () => {
    if (!lifeCards.hint) return;
    socketRef.current?.emit('flashcard:use-hint', { roomCode, studentId });
  };

  const handleUseRedraw = () => {
    if (!lifeCards.redraw) return;
    socketRef.current?.emit('flashcard:use-redraw', { roomCode, studentId });
  };

  const handleUseCallFriend = () => {
    if (!lifeCards.callFriend) return;
    setShowSelectFriendModal(true);
  };

  const handleSelectFriend = () => {
    if (!selectedFriendId) return;
    socketRef.current?.emit('flashcard:use-call-friend', {
      roomCode,
      studentId,
      helperId: selectedFriendId
    });
    setShowSelectFriendModal(false);
    setSelectedFriendId('');
  };

  const handleSubmitAnswer = () => {
    if (!myAnswer && myAnswer !== 0) {
      alert('Please provide an answer');
      return;
    }

    socketRef.current?.emit('flashcard:submit-answer', {
      roomCode,
      studentId,
      answer: currentQuestion?.type === 'text_input' ? myAnswer : undefined,
      selectedOption: currentQuestion?.type === 'multiple_choice' ? myAnswer : undefined
    });
  };

  const handleSubmitFriendAnswer = () => {
    socketRef.current?.emit('flashcard:friend-answer', {
      roomCode,
      helperId: studentId,
      answer: friendQuestion?.type === 'text_input' ? friendAnswer : undefined,
      selectedOption: friendQuestion?.type === 'multiple_choice' ? friendAnswer : undefined
    });
    setShowFriendModal(false);
  };

  return (
    <div className="sfc-page">
      {/* Header */}
      <div className="sfc-header">
        <button className="sfc-back-btn" onClick={() => navigate('/student/solo-games')}>
          <i className="fas fa-arrow-left"></i>
        </button>
        <div className="sfc-title-section">
          <h1 className="sfc-title">Flashcard Game</h1>
          <div className="sfc-chips">
            <div className="sfc-chip">Room: {roomCode}</div>
            <div className="sfc-chip">Score: {myScore}</div>
            <div className="sfc-chip">Turns: {myTurns}</div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="sfc-content">
        {/* Lobby */}
        {phase === 'lobby' && (
          <div className="sfc-lobby">
            <h2>Waiting for game to start...</h2>
            <div className="sfc-students-waiting">
              <h3>Players ({students.length})</h3>
              <div className="sfc-students-grid">
                {students.map(s => (
                  <div key={s.id} className={`sfc-student-badge ${s.id === studentId ? 'you' : ''}`}>
                    <div className="sfc-avatar">
                      {s.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </div>
                    <span>{s.name}{s.id === studentId ? ' (You)' : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Draw Student */}
        {phase === 'draw-student' && (
          <div className="sfc-draw-student">
            <div className="sfc-instruction">
              <i className="fas fa-eye"></i>
              <p>Teacher is drawing a student...</p>
            </div>
            <div className="sfc-card-area">
              <div className="sfc-card-stack">
                <div className="sfc-card sfc-card-back"></div>
                <div className="sfc-card sfc-card-back"></div>
                <div className="sfc-card sfc-card-spectate">
                  <div className="sfc-card-front">
                    <i className="fas fa-user"></i>
                    <p>Student Card</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Draw Question */}
        {phase === 'draw-question' && (
          <div className="sfc-draw-question">
            <h2>Selected: {selectedStudentName}</h2>
            {isMyTurn ? (
              <div className="sfc-your-turn">
                <p>It's your turn!</p>
                <div className="sfc-instruction">
                  <i className="fas fa-hand-pointer"></i>
                  <p>Pick a question card ({availableQuestions.length} available)</p>
                </div>
                
                <div className="sfc-facedown-grid">
                  {availableQuestions.map((q, idx) => (
                    <div 
                      key={q.questionIndex} 
                      className="sfc-facedown-card"
                      onClick={() => handleSelectQuestion(q.questionIndex)}
                      style={{ animationDelay: `${idx * 0.05}s` }}
                    >
                      <div className="sfc-facedown-card-inner">
                        <i className="fas fa-question"></i>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="sfc-waiting">
                <p>Waiting for {selectedStudentName} to select a question...</p>
              </div>
            )}
          </div>
        )}

        {/* Answering */}
        {phase === 'answering' && currentQuestion && (
          <div className="sfc-answering">
            <div className="sfc-question-display">
              <div className="sfc-question-header">
                <span>Question {currentQuestion.questionIndex + 1}</span>
                <span className="sfc-points">{currentQuestion.points} pts</span>
              </div>
              <h2>{currentQuestion.text}</h2>

              {currentQuestion.hasTimer && timeLeft !== null && (
                <div className="sfc-timer">
                  <div className="sfc-timer-circle">{timeLeft}s</div>
                  <div className="sfc-timer-bar">
                    <div 
                      className="sfc-timer-fill"
                      style={{ width: `${(timeLeft / currentQuestion.timeLimitSec) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {hintText && (
                <div className="sfc-hint">
                  <i className="fas fa-lightbulb"></i>
                  <span>Hint: {hintText}</span>
                </div>
              )}

              {isMyTurn ? (
                <div className="sfc-answer-section">
                  {timeLeft === 0 && (
                    <div className="sfc-timer-expired">
                      <i className="fas fa-clock"></i>
                      <p>Time's up! Submitting your answer...</p>
                    </div>
                  )}
                  {currentQuestion.type === 'multiple_choice' && currentQuestion.options ? (
                    <div className="sfc-options">
                      {currentQuestion.options.map((opt, idx) => (
                        <button
                          key={idx}
                          className={`sfc-option ${myAnswer === idx ? 'selected' : ''}`}
                          onClick={() => setMyAnswer(idx)}
                          disabled={timeLeft === 0}
                        >
                          <span className="sfc-option-letter">{String.fromCharCode(65 + idx)}</span>
                          <span>{opt.text}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <input
                      type="text"
                      className="sfc-text-input"
                      placeholder="Type your answer..."
                      value={myAnswer as string}
                      onChange={(e) => setMyAnswer(e.target.value)}
                      disabled={timeLeft === 0}
                    />
                  )}

                  <div className="sfc-life-cards">
                    <h4>Life Cards</h4>
                    <div className="sfc-cards-row">
                      <button
                        className="sfc-life-card"
                        onClick={handleUseCallFriend}
                        disabled={!lifeCards.callFriend}
                      >
                        <i className="fas fa-phone"></i>
                        <span>Call Friend</span>
                      </button>
                      <button
                        className="sfc-life-card"
                        onClick={handleUseHint}
                        disabled={!lifeCards.hint}
                      >
                        <i className="fas fa-lightbulb"></i>
                        <span>Hint</span>
                      </button>
                      <button
                        className="sfc-life-card"
                        onClick={handleUseRedraw}
                        disabled={!lifeCards.redraw}
                      >
                        <i className="fas fa-sync-alt"></i>
                        <span>Re-draw</span>
                      </button>
                    </div>
                  </div>

                  <button 
                    className="sfc-btn sfc-btn-primary" 
                    onClick={handleSubmitAnswer}
                    disabled={timeLeft === 0}
                  >
                    Submit Answer
                  </button>
                </div>
              ) : waitingForFriend && selectedStudentId === studentId ? (
                <div className="sfc-waiting-friend">
                  <i className="fas fa-user-friends"></i>
                  <h3>Waiting for your friend to answer...</h3>
                  <p>Your friend is helping you answer this question</p>
                </div>
              ) : (
                <div className="sfc-spectating">
                  <p>Watching {selectedStudentName} answer...</p>
                  {currentQuestion.type === 'multiple_choice' && currentQuestion.options && (
                    <div className="sfc-options-view">
                      {currentQuestion.options.map((opt, idx) => (
                        <div key={idx} className="sfc-option-view">
                          <span className="sfc-option-letter">{String.fromCharCode(65 + idx)}</span>
                          <span>{opt.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Reveal */}
        {phase === 'reveal' && revealData && (
          <div className="sfc-reveal">
            <h2 className={revealData.isCorrect ? 'correct' : 'wrong'}>
              {revealData.isCorrect ? '✅ Correct!' : '❌ Wrong!'}
            </h2>
            <div className="sfc-points-display">
              {revealData.pointsEarned > 0 ? '+' : ''}{revealData.pointsEarned} points
            </div>
            
            <div className="sfc-reveal-answers">
              <div className="sfc-answer-card">
                <h4>Correct Answer</h4>
                <div className="sfc-answer">
                  {typeof revealData.correctAnswer === 'number'
                    ? String.fromCharCode(65 + revealData.correctAnswer)
                    : revealData.correctAnswer}
                </div>
              </div>
              
              {revealData.helperData && (
                <div className="sfc-answer-card">
                  <h4>Helper: {revealData.helperData.helperName}</h4>
                  <div className={`sfc-answer ${revealData.helperData.helperCorrect ? 'correct' : 'wrong'}`}>
                    {typeof revealData.helperData.helperAnswer === 'number'
                      ? String.fromCharCode(65 + revealData.helperData.helperAnswer)
                      : revealData.helperData.helperAnswer}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Finished */}
        {phase === 'finished' && (
          <div className="sfc-finished">
            <div className="sfc-finish-icon">🎉</div>
            <h1>Game Complete!</h1>
            <div className="sfc-final-stats">
              <div className="sfc-stat">
                <div className="sfc-stat-value">{myScore}</div>
                <div className="sfc-stat-label">Final Score</div>
              </div>
              <div className="sfc-stat">
                <div className="sfc-stat-value">{myTurns}</div>
                <div className="sfc-stat-label">Turns Taken</div>
              </div>
            </div>
            <button className="sfc-btn sfc-btn-primary" onClick={() => navigate('/student/solo-games')}>
              Back to Games
            </button>
          </div>
        )}
      </div>

      {/* Friend Help Modal */}
      {showFriendModal && friendQuestion && (
        <div className="sfc-modal-overlay">
          <div className="sfc-modal">
            <h3>Help Your Friend!</h3>
            <p className="sfc-question-text">{friendQuestion.text}</p>
            
            {friendQuestion.type === 'multiple_choice' && friendQuestion.options ? (
              <div className="sfc-modal-options">
                {friendQuestion.options.map((opt: any, idx: number) => (
                  <button
                    key={idx}
                    className={`sfc-modal-option ${friendAnswer === idx ? 'selected' : ''}`}
                    onClick={() => setFriendAnswer(idx)}
                  >
                    {String.fromCharCode(65 + idx)}. {opt.text}
                  </button>
                ))}
              </div>
            ) : (
              <input
                type="text"
                className="sfc-modal-input"
                placeholder="Type your answer..."
                value={friendAnswer as string}
                onChange={(e) => setFriendAnswer(e.target.value)}
              />
            )}

            <button className="sfc-btn sfc-btn-primary" onClick={handleSubmitFriendAnswer}>
              Submit Answer
            </button>
          </div>
        </div>
      )}

      {/* Select Friend Modal */}
      {showSelectFriendModal && (
        <div className="sfc-modal-overlay">
          <div className="sfc-modal">
            <h3>Choose a Friend to Help</h3>
            <div className="sfc-friend-list">
              {students
                .filter(s => s.id !== studentId)
                .map(s => (
                  <button
                    key={s.id}
                    className={`sfc-friend-option ${selectedFriendId === s.id ? 'selected' : ''}`}
                    onClick={() => setSelectedFriendId(s.id)}
                  >
                    {s.name}
                  </button>
                ))}
            </div>
            <div className="sfc-modal-actions">
              <button className="sfc-btn sfc-btn-secondary" onClick={() => setShowSelectFriendModal(false)}>
                Cancel
              </button>
              <button 
                className="sfc-btn sfc-btn-primary" 
                onClick={handleSelectFriend}
                disabled={!selectedFriendId}
              >
                Select
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentFlashcard;

