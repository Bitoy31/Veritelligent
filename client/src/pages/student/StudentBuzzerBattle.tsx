import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import '../../styles/student_buzzer_battle.css';

interface Team {
  teamId: string;
  name: string;
  memberIds: string[];
  score: number;
  streak: number;
  frozen: boolean;
}

interface GameState {
  phase: 'lobby' | 'question' | 'answering' | 'results' | 'finished';
  currentQuestion: number;
  revealedWords: string[];
  myTeam: Team | null;
  buzzedTeam: string | null;
  canBuzz: boolean;
  isStealPhase: boolean;
}

const StudentBuzzerBattle: React.FC = () => {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const socketRef = useRef<Socket | null>(null);
  
  const [user, setUser] = useState<any>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [gameState, setGameState] = useState<GameState>({
    phase: 'lobby',
    currentQuestion: 0,
    revealedWords: [],
    myTeam: null,
    buzzedTeam: null,
    canBuzz: false,
    isStealPhase: false
  });
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastResult, setLastResult] = useState<{ isCorrect: boolean; points: number; correctAnswer?: string } | null>(null);
  const [currentQuestionResult, setCurrentQuestionResult] = useState<{ correctAnswer: string; answeringTeam?: string; isCorrect?: boolean } | null>(null);
  const [currentAnsweringStudent, setCurrentAnsweringStudent] = useState<{ studentId: string; studentName: string; teamId: string; teamName: string } | null>(null);
  const [buzzedStudentId, setBuzzedStudentId] = useState<string | null>(null); // Track who buzzed
  const [disabledBuzzers, setDisabledBuzzers] = useState<string[]>([]); // Track disabled buzzers
  const [answerDeadline, setAnswerDeadline] = useState<number | null>(null);
  const [remainingMs, setRemainingMs] = useState<number>(0);
  const countdownRef = useRef<number | null>(null);
  const [answerTimeLimitSec, setAnswerTimeLimitSec] = useState<number>(0);
  const autoSubmittedRef = useRef<boolean>(false);

  // Initialize socket connection
  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (!userData._id || !userData.userFname) {
      alert('Please log in first');
      navigate('/');
      return;
    }
    
    console.log('✅ Student loading user data:', userData.userFname);
    setUser(userData);

    const socket = io('http://localhost:5000');
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('🔔 Student connected to server. Socket ID:', socket.id);
      
      const joinData = {
        roomCode: roomCode?.toUpperCase(),
        studentId: userData._id,
        studentName: `${userData.userFname} ${userData.userLname || ''}`
      };
      console.log('📤 Student emitting bb:join-room:', joinData);
      
      socket.emit('bb:join-room', joinData);
    });

    socket.on('bb:lobby-update', ({ students, teams: updatedTeams }) => {
      console.log('🔔 Student received lobby-update:', { studentsCount: students?.length, teamsCount: updatedTeams?.length });
      
      if (updatedTeams) {
        setTeams(updatedTeams);
        
        // Find my team
        const myTeam = updatedTeams.find((t: Team) => 
          t.memberIds.includes(userData._id)
        );
        
        if (myTeam) {
          console.log('✅ Student found team:', myTeam.name);
          setGameState(prev => ({ ...prev, myTeam }));
        }
        setLoading(false); // Stop loading once we get team data
      } else {
        // Still in lobby waiting for teams
        setLoading(false);
      }
    });

    socket.on('bb:teams-created', ({ teams: createdTeams }) => {
      console.log('🔔 Student: Teams created:', createdTeams?.length);
      setTeams(createdTeams);
      
      const myTeam = createdTeams.find((t: Team) => 
        t.memberIds.includes(userData._id)
      );
      
      setGameState(prev => ({
        ...prev,
        myTeam,
        phase: 'lobby'
      }));
      setLoading(false);
    });

    socket.on('bb:error', ({ message }) => {
      console.error('❌ Student received error:', message);
      setError(message);
      setLoading(false);
      alert(message);
    });

    socket.on('bb:game-started', () => {
      console.log('🔔 Game started');
      setGameState(prev => ({ 
        ...prev, 
        phase: 'question',
        revealedWords: [],
        canBuzz: false,
        buzzedTeam: null,
        isStealPhase: false
      }));
    });

    socket.on('bb:word-revealed', ({ word, index, totalWords }) => {
      console.log(`📥 Student received word ${index + 1}/${totalWords}: "${word}"`);
      setGameState(prev => {
        // If we're not in question phase yet, set it to question phase
        // This handles cases where words arrive before phase is set
        const currentPhase = prev.phase === 'lobby' ? 'question' : prev.phase;
        
        // Only add if we're in question phase (or transitioning to it) and the word index matches
        // This prevents duplicate words if there are race conditions
        if ((currentPhase === 'question' || prev.phase === 'question') && prev.revealedWords.length === index) {
          return {
            ...prev,
            phase: currentPhase,
            revealedWords: [...prev.revealedWords, word],
            canBuzz: true
          };
        }
        return prev;
      });
    });

    socket.on('bb:team-buzzed', ({ teamId, teamName, fullQuestion, studentId, studentName, disabledBuzzers: disabledList, answerDeadline, answerTimeLimit }) => {
      console.log(`🔔 Team ${teamName} buzzed by ${studentName}`);
      
      // Track who buzzed
      setBuzzedStudentId(studentId);
      autoSubmittedRef.current = false;
      
      // Update disabled buzzers list
      if (disabledList) {
        setDisabledBuzzers(disabledList);
      }
      
      setGameState(prev => {
        const isBuzzed = prev.myTeam?.teamId === teamId;
        
        return {
          ...prev,
          phase: 'answering',
          buzzedTeam: teamId,
          canBuzz: false,
          revealedWords: fullQuestion ? fullQuestion.split(' ') : prev.revealedWords
        };
      });
      // Clear current answering student when new team buzzes
      setCurrentAnsweringStudent(null);
      // setup countdown
      if (answerDeadline) {
        setAnswerDeadline(answerDeadline);
        setAnswerTimeLimitSec(Number(answerTimeLimit || 30));
        const tick = () => {
          const rem = Math.max(0, (answerDeadline as number) - Date.now());
          setRemainingMs(rem);
          if (rem <= 0 && countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
          }
        };
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
        }
        // @ts-ignore
        countdownRef.current = window.setInterval(tick, 200);
        tick();
      }
    });

    socket.on('bb:student-answering', ({ studentId, studentName, teamId, teamName }) => {
      console.log(`🔔 Student ${studentName} from ${teamName} is answering`);
      setCurrentAnsweringStudent({ studentId, studentName, teamId, teamName });
    });

    socket.on('bb:answer-result', ({ teamId, isCorrect, pointsAwarded, basePointsAwarded, earlyBonusAwarded, newScore, streak, correctAnswer, teamName, disabledBuzzers: disabledList, reEnabledBuzzers }) => {
      console.log(`🔔 Answer result: ${isCorrect}`);
      
      // Update disabled buzzers list
      if (disabledList) {
        setDisabledBuzzers(disabledList);
      }
      
      // Update team scores
      setTeams(prev => {
        const updated = prev.map(t => 
          t.teamId === teamId 
            ? { ...t, score: newScore, streak: streak || 0 }
            : t
        );
        
        // Show result if it's my team
        const myTeam = updated.find(t => t.teamId === gameState.myTeam?.teamId);
        if (myTeam?.teamId === teamId) {
          // @ts-ignore - enrich with bonus details for UI
          setLastResult({ isCorrect, points: pointsAwarded, correctAnswer, earlyBonusAwarded, basePointsAwarded });
        }

        // Set question result for reveal phase
        const answeringTeam = updated.find(t => t.teamId === teamId);
        setCurrentQuestionResult({
          correctAnswer: correctAnswer || '',
          answeringTeam: answeringTeam?.name || teamName || 'Unknown Team',
          isCorrect
        });

        return updated;
      });

      setAnswer('');
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
        setAnswerDeadline(null);
        setRemainingMs(0);
        setAnswerTimeLimitSec(0);
        autoSubmittedRef.current = false;
      }
      setCurrentAnsweringStudent(null); // Clear answering student when result comes
      setGameState(prev => ({ ...prev, phase: 'results' }));
    });

    socket.on('bb:steal-phase', ({ wrongTeamId, remainingSteals, disabledBuzzers: disabledList, reEnabledBuzzers }) => {
      console.log('🔔 Steal phase');
      setCurrentQuestionResult(null); // Clear results for steal phase
      setCurrentAnsweringStudent(null); // Clear answering student
      setBuzzedStudentId(null); // Clear buzzer for steal phase
      
      // Update disabled buzzers list
      if (disabledList) {
        setDisabledBuzzers(disabledList);
      }
      
      setGameState(prev => ({
        ...prev,
        phase: 'question',
        buzzedTeam: null,
        canBuzz: true,
        isStealPhase: true
      }));
    });

    socket.on('bb:next-question', () => {
      console.log('🔔 Next question');
      setCurrentQuestionResult(null); // Clear previous question results
      setLastResult(null); // Clear last result
      setCurrentAnsweringStudent(null); // Clear answering student
      setBuzzedStudentId(null); // Clear buzzer
      setGameState(prev => ({
        ...prev,
        phase: 'question',
        currentQuestion: prev.currentQuestion + 1,
        revealedWords: [],
        buzzedTeam: null,
        canBuzz: false,
        isStealPhase: false
      }));
      setAnswer('');
    });

    socket.on('bb:teammate-answered', ({ message }) => {
      console.log('✅ Teammate answer recorded:', message);
      // Show feedback that answer was recorded
      setAnswer(''); // Clear the input
    });

    socket.on('bb:error', ({ message }) => {
      console.error('❌ Error:', message);
      alert(message);
    });

    socket.on('bb:game-finished', ({ teams: finalTeams }) => {
      console.log('🔔 Game finished');
      setTeams(finalTeams);
      setGameState(prev => {
        const mine = prev.myTeam ? finalTeams.find((t: Team) => t.teamId === prev.myTeam?.teamId) : null;
        return { ...prev, phase: 'finished', myTeam: (mine || prev.myTeam) };
      });
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [roomCode, navigate]);

  const handleBuzz = () => {
    if (!gameState.canBuzz || gameState.myTeam?.frozen) return;

    if (socketRef.current && gameState.myTeam) {
      socketRef.current.emit('bb:buzz-in', {
        roomCode: roomCode?.toUpperCase(),
        teamId: gameState.myTeam.teamId,
        studentId: user._id,
        studentName: `${user.userFname} ${user.userLname}`.trim() || user.userName
      });
      
      setGameState(prev => ({ ...prev, canBuzz: false }));
    }
  };

  const handleSubmitAnswer = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!answer.trim() || !gameState.myTeam) return;

    if (socketRef.current) {
      socketRef.current.emit('bb:submit-answer', {
        roomCode: roomCode?.toUpperCase(),
        teamId: gameState.myTeam.teamId,
        answer: answer.trim(),
        studentId: user._id,
        studentName: `${user.userFname} ${user.userLname}`.trim() || user.userName
      });
    }
  };

  // Auto-submit when timer runs out for the buzzer
  useEffect(() => {
    if (!answerDeadline) return;
    const amIBuzzer = buzzedStudentId === user?._id && gameState.buzzedTeam === gameState.myTeam?.teamId && gameState.phase === 'answering';
    if (amIBuzzer && remainingMs <= 0 && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true;
      if (socketRef.current) {
        socketRef.current.emit('bb:submit-answer', {
          roomCode: roomCode?.toUpperCase(),
          teamId: gameState.myTeam!.teamId,
          answer: (answer || '').trim(),
          studentId: user._id,
          studentName: `${user.userFname} ${user.userLname}`.trim() || user.userName
        });
      }
    }
  }, [remainingMs, answerDeadline, buzzedStudentId, gameState.phase, gameState.buzzedTeam, gameState.myTeam, user, roomCode, answer]);

  const handleLeave = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    navigate('/student/party-games');
  };

  const sortedTeams = [...teams].sort((a, b) => b.score - a.score);
  const myTeamRank = sortedTeams.findIndex(t => t.teamId === gameState.myTeam?.teamId) + 1;

  if (loading) {
    return (
      <div className="sbb-page">
        <div className="sbb-loading">
          <i className="fas fa-spinner fa-spin"></i>
          <p>Joining game...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sbb-page">
      {/* Header */}
      <div className="sbb-header">
        <button className="sbb-leave-btn" onClick={handleLeave}>
          <i className="fas fa-sign-out-alt"></i>
        </button>
        <div className="sbb-header-info">
          <div className="sbb-room-code">Room: {roomCode}</div>
          {gameState.myTeam && (
            <div className="sbb-my-team">
              {gameState.myTeam.name}
              {gameState.myTeam.frozen && <i className="fas fa-snowflake"></i>}
            </div>
          )}
        </div>
        {gameState.myTeam && (
          <div className="sbb-my-score">
            <div className="sbb-score-value">{gameState.myTeam.score}</div>
            <div className="sbb-score-label">Points</div>
            {gameState.myTeam.streak > 0 && (
              <div className="sbb-streak">
                <i className="fas fa-fire"></i> {gameState.myTeam.streak}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="sbb-content">
        {/* Lobby Phase */}
        {gameState.phase === 'lobby' && (
          <div className="sbb-lobby">
            <h2>Waiting for Game to Start</h2>
            {gameState.myTeam ? (
              <div className="sbb-team-display">
                <h3>Your Team: {gameState.myTeam.name}</h3>
                <p>Get ready to buzz in and answer questions!</p>
              </div>
            ) : (
              <p>Waiting for teams to be created...</p>
            )}
          </div>
        )}

                {/* Question Phase */}
        {gameState.phase === 'question' && (
          <div className="sbb-question-view">
            {gameState.isStealPhase && (
              <div className="sbb-steal-banner">
                <i className="fas fa-bolt"></i> STEAL OPPORTUNITY!
              </div>
            )}

            <div className="sbb-question-text">
              {gameState.revealedWords.length > 0 ? (
                <>
                  {gameState.revealedWords.join(' ')}
                  <span className="sbb-cursor-blink">_</span>
                </>
              ) : (
                <span className="sbb-loading-question">Waiting for question...</span>
              )}
            </div>

            <div className="sbb-buzz-section">
              {gameState.myTeam?.frozen ? (
                <div className="sbb-frozen-message">
                  <i className="fas fa-snowflake"></i>
                  <p>Your team is frozen!</p>
                  <small>Too many consecutive wrong answers</small>
                </div>
              ) : disabledBuzzers.includes(user._id) ? (
                <div className="sbb-frozen-message">
                  <i className="fas fa-lock"></i>
                  <p>Your buzzer is disabled</p>
                  <small>Wait for all your teammates to answer first</small>
                </div>
              ) : (
                <button
                  className={`sbb-buzz-btn ${gameState.canBuzz ? 'active' : ''}`}
                  onClick={handleBuzz}
                  disabled={!gameState.canBuzz}
                >
                  <i className="fas fa-bell"></i>
                  <span>BUZZ IN!</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Answering Phase */}
        {gameState.phase === 'answering' && (
          <div className="sbb-answering-view">
            <div className="sbb-full-question">
              {gameState.revealedWords.join(' ')}
            </div>
            {answerDeadline && (
              <div className="sbb-answer-timer">
                <i className="fas fa-hourglass-half"></i>{' '}
                <span>{String(Math.ceil(remainingMs / 1000)).padStart(2, '0')}s</span>
                {answerTimeLimitSec > 0 && (
                  <div className="sbb-timer-bar" style={{ marginTop: '6px', height: '6px', background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.min(100, Math.max(0, (remainingMs / (answerTimeLimitSec * 1000)) * 100))}%`,
                        background: '#f59e0b',
                        transition: 'width 0.2s linear'
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {gameState.buzzedTeam === gameState.myTeam?.teamId ? (
              <div className="sbb-answer-section">
                {buzzedStudentId === user._id ? (
                  // This is the buzzer - only they can answer
                  <>
                    <h3>You Buzzed In!</h3>
                    <p className="sbb-answer-hint">You are the only one who can submit the answer for your team.</p>
                    {currentAnsweringStudent && currentAnsweringStudent.studentId === user._id && (
                      <div className="sbb-current-answering">
                        <i className="fas fa-user"></i>
                        <span><strong>You</strong> are answering...</span>
                      </div>
                    )}
                    <form onSubmit={handleSubmitAnswer} className="sbb-answer-form">
                      <input
                        type="text"
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        placeholder="Type your answer..."
                        autoFocus
                        required
                      />
                      <button 
                        type="submit" 
                        disabled={!answer.trim()}
                      >
                        Submit Answer
                      </button>
                    </form>
                  </>
                ) : (
                  // This is a teammate (not the buzzer) - they can only spectate
                  <>
                    <h3>Your Team Buzzed In!</h3>
                    <p className="sbb-answer-hint">Only the student who buzzed in can submit the answer. Please wait...</p>
                    {currentAnsweringStudent && (
                      <div className="sbb-current-answering">
                        <i className="fas fa-user"></i>
                        <span><strong>{currentAnsweringStudent.studentName}</strong> is answering...</span>
                      </div>
                    )}
                    {!currentAnsweringStudent && (
                      <div className="sbb-waiting">
                        <i className="fas fa-hourglass-half"></i>
                        <p>Waiting for {teams.find(t => t.teamId === gameState.buzzedTeam)?.name} to answer...</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="sbb-waiting">
                <i className="fas fa-hourglass-half"></i>
                {currentAnsweringStudent ? (
                  <div>
                    <p><strong>{currentAnsweringStudent.studentName}</strong> from <strong>{currentAnsweringStudent.teamName}</strong> is answering...</p>
                  </div>
                ) : (
                  <p>{teams.find(t => t.teamId === gameState.buzzedTeam)?.name} is answering...</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Results Phase */}
        {gameState.phase === 'results' && currentQuestionResult && (
          <div className="sbb-results-reveal">
            <h2>Question Complete!</h2>
            
            {/* Show result for the answering team */}
            {currentQuestionResult.answeringTeam && (
              <div className={`sbb-team-result ${currentQuestionResult.isCorrect ? 'correct' : 'wrong'}`}>
                <i className={`fas ${currentQuestionResult.isCorrect ? 'fa-check-circle' : 'fa-times-circle'}`}></i>
                <p className="sbb-team-answer-status">
                  {currentQuestionResult.answeringTeam} {currentQuestionResult.isCorrect ? 'got it right!' : 'got it wrong'}
                </p>
              </div>
            )}
            
            {/* Always show correct answer */}
            <div className="sbb-correct-answer-reveal">
              <p className="sbb-correct-answer-label">Correct Answer:</p>
              <p className="sbb-correct-answer-value">{currentQuestionResult.correctAnswer}</p>
            </div>

            {/* Show points for my team if they answered */}
            {lastResult && gameState.myTeam && (
              <div className={`sbb-my-result ${lastResult.isCorrect ? 'correct' : 'wrong'}`}>
                <p className="sbb-my-result-text">
                  {lastResult.isCorrect ? '✓ Your team answered correctly!' : '✗ Your team answered incorrectly'}
                </p>
                <p className="sbb-my-result-points">
                  {lastResult.points > 0 ? '+' : ''}{lastResult.points} pts
                </p>
                {/* Optional: show early bonus details if present */}
                {/* @ts-ignore */}
                {lastResult.isCorrect && (lastResult as any).earlyBonusAwarded > 0 && (
                  <p className="sbb-my-result-bonus">+{(lastResult as any).earlyBonusAwarded} early buzz bonus</p>
                )}
              </div>
            )}

            <div className="sbb-waiting-next">
              <i className="fas fa-hourglass-half"></i>
              <p>Waiting for next question...</p>
            </div>
          </div>
        )}

        {/* Finished Phase */}
        {gameState.phase === 'finished' && (
          <div className="sbb-finished">
            <h2>🎉 Game Over!</h2>
            
            {myTeamRank === 1 && (
              <div className="sbb-winner">
                <h3>🏆 YOUR TEAM WON! 🏆</h3>
              </div>
            )}

            <div className="sbb-final-stats">
              <div className="sbb-stat">
                <div className="sbb-stat-value">#{myTeamRank}</div>
                <div className="sbb-stat-label">Your Rank</div>
              </div>
              <div className="sbb-stat">
                <div className="sbb-stat-value">{gameState.myTeam?.score}</div>
                <div className="sbb-stat-label">Final Score</div>
              </div>
              {gameState.myTeam?.streak && gameState.myTeam.streak > 0 && (
                <div className="sbb-stat">
                  <div className="sbb-stat-value">{gameState.myTeam.streak}</div>
                  <div className="sbb-stat-label">Best Streak</div>
                </div>
              )}
            </div>

            <button className="sbb-leave-game-btn" onClick={handleLeave}>
              Leave Game
            </button>
          </div>
        )}
      </div>

      {/* Leaderboard */}
      {(gameState.phase === 'question' || gameState.phase === 'answering' || gameState.phase === 'results') && (
        <div className="sbb-mini-leaderboard">
          <h4>Leaderboard</h4>
          {sortedTeams.slice(0, 5).map((team, index) => (
            <div 
              key={team.teamId} 
              className={`sbb-mini-team ${team.teamId === gameState.myTeam?.teamId ? 'my-team' : ''}`}
            >
              <span className="sbb-mini-rank">#{index + 1}</span>
              <span className="sbb-mini-name">{team.name}</span>
              <span className="sbb-mini-score">{team.score}</span>
            </div>
          ))}
        </div>
      )}

      {/* Error Toast */}
      {error && (
        <div className="sbb-error-toast">
          <i className="fas fa-exclamation-circle"></i>
          {error}
        </div>
      )}
    </div>
  );
};

export default StudentBuzzerBattle;

