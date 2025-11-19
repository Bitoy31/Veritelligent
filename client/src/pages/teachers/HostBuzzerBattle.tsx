import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import QRCode from 'react-qr-code';
import '../../styles/host_buzzer_battle.css';

interface Question {
  text: string;
  type: 'text_input' | 'multiple_choice';
  options?: { text: string }[];
  acceptedAnswers: string;
  points: number;
  category?: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface Team {
  teamId: string;
  name: string;
  memberIds: string[];
  score: number;
  streak: number;
  frozen: boolean;
  consecutiveWrong: number;
}

interface Student {
  id: string;
  name: string;
  teamId?: string;
  socketId: string;
}

interface GameState {
  phase: 'lobby' | 'team-setup' | 'question' | 'answering' | 'results' | 'finished';
  currentQuestion: number;
  revealedWords: string[];
  buzzedTeam: string | null;
  isStealPhase: boolean;
}

const HostBuzzerBattle: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const socketRef = useRef<Socket | null>(null);
  
  const { taskId, subjectId } = location.state || {};
  
  // Task and Room State
  const [task, setTask] = useState<any>(null);
  const [roomCode, setRoomCode] = useState('');
  const [sessionId, setSessionId] = useState('');
  
  // Students and Teams
  const [students, setStudents] = useState<Student[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  
  // Game State
  const [gameState, setGameState] = useState<GameState>({
    phase: 'lobby',
    currentQuestion: 0,
    revealedWords: [],
    buzzedTeam: null,
    isStealPhase: false
  });
  
  // UI State
  const [loading, setLoading] = useState(true);
  const [teamSetupMode, setTeamSetupMode] = useState<'auto' | 'manual'>('auto');
  const [numTeams, setNumTeams] = useState(4);
  const [answerInput, setAnswerInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [dropOverTeamId, setDropOverTeamId] = useState<string | null>(null);
  const [dropOverPresent, setDropOverPresent] = useState<boolean>(false);
  const [currentAnsweringStudent, setCurrentAnsweringStudent] = useState<{ subject?: string; studentId: string; studentName: string; teamId: string; teamName: string } | null>(null);
  const [answerDeadline, setAnswerDeadline] = useState<number | null>(null);
  const [remainingMs, setRemainingMs] = useState<number>(0);
  const answerCountdownRef = useRef<number | null>(null);
  const [answerTimeLimitSec, setAnswerTimeLimitSec] = useState<number>(0);
  
  // Refs
  const revealInterval = useRef<NodeJS.Timeout | null>(null);
  const answerTimeout = useRef<NodeJS.Timeout | null>(null);

  // Fetch task and setup room
  useEffect(() => {
    const setupGame = async () => {
      try {
        if (!taskId || !subjectId) {
          console.error('❌ Missing data - taskId:', taskId, 'subjectId:', subjectId);
          alert('Missing task or subject information');
          navigate('/teacher/buzzer-battle');
          return;
        }

        console.log('✅ Starting game setup with taskId:', taskId, 'subjectId:', subjectId);

        const user = JSON.parse(localStorage.getItem('user') || '{}');
        console.log('✅ User loaded:', user._id);
        
        // Fetch task
        console.log('📡 Fetching task...');
        const response = await fetch(`http://localhost:5000/api/buzzerbattle/tasks/${taskId}`);
        if (!response.ok) {
          console.error('❌ Failed to fetch task:', response.status, response.statusText);
          throw new Error('Failed to fetch task');
        }
        
        const taskData = await response.json();
        console.log('✅ Task loaded:', taskData.title);
        setTask(taskData);

        // Setup socket
        console.log('📡 Setting up socket connection...');
        const socket = io('http://localhost:5000');
        socketRef.current = socket;

        socket.on('connect', () => {
          console.log('🔔 Socket connected! Socket ID:', socket.id);
          
          // Create room
          const roomData = {
            taskId,
            subjectId,
            teacherId: user._id
          };
          console.log('📤 Emitting bb:create-room with data:', roomData);
          socket.emit('bb:create-room', roomData);
        });

        socket.on('bb:room-created', ({ roomCode: code, sessionId: sid }) => {
          console.log('🔔 Room created:', code, 'Session ID:', sid);
          setRoomCode(code);
          setSessionId(sid);
          setLoading(false);
        });

        socket.on('bb:error', ({ message }) => {
          console.error('❌ Server error:', message);
          alert(`Error: ${message}`);
          setLoading(false);
          navigate('/teacher/buzzer-battle');
        });

        socket.on('bb:lobby-update', ({ students: updatedStudents, teams: updatedTeams }) => {
          console.log('🔔 Lobby update:', updatedStudents);
          setStudents(updatedStudents);
          if (updatedTeams) setTeams(updatedTeams);
        });

        socket.on('bb:teams-created', ({ teams: createdTeams }) => {
          console.log('🔔 Teams created:', createdTeams);
          setTeams(createdTeams);
          // Don't change phase - stay in lobby until teacher clicks "Start Game"
        });

        socket.on('bb:word-revealed', ({ word, index, totalWords }) => {
          console.log(`📥 Host received word ${index + 1}/${totalWords}: "${word}"`);
          setGameState(prev => {
            // Only add if we're in question phase and the word index matches our current array length
            // This prevents duplicate words if there are race conditions
            if (prev.phase === 'question' && prev.revealedWords.length === index) {
              return {
                ...prev,
                revealedWords: [...prev.revealedWords, word]
              };
            }
            return prev;
          });
        });

        socket.on('bb:team-buzzed', ({ teamId, teamName, fullQuestion, studentId, studentName, answerDeadline, answerTimeLimit }) => {
          console.log(`🔔 Team ${teamName} buzzed by ${studentName}!`);
          setGameState(prev => ({
            ...prev,
            phase: 'answering',
            buzzedTeam: teamId
          }));
          // Setup answer countdown
          if (answerDeadline) {
            setAnswerDeadline(answerDeadline);
            setAnswerTimeLimitSec(Number(answerTimeLimit || 30));
            const tick = () => {
              const rem = Math.max(0, (answerDeadline as number) - Date.now());
              setRemainingMs(rem);
              if (rem <= 0 && answerCountdownRef.current) {
                clearInterval(answerCountdownRef.current);
                answerCountdownRef.current = null;
              }
            };
            if (answerCountdownRef.current) {
              clearInterval(answerCountdownRef.current);
            }
            tick();
            // @ts-ignore
            answerCountdownRef.current = window.setInterval(tick, 200);
          }
          
          // Show full question
          if (fullQuestion) {
            const words = fullQuestion.split(' ');
            setGameState(prev => ({ ...prev, revealedWords: words }));
          }
          
          // Clear current answering student when new team buzzes
          setCurrentAnsweringStudent(null);
        });

        socket.on('bb:student-answering', ({ studentId, studentName, teamId, teamName }) => {
          console.log(`🔔 Student ${studentName} from ${teamName} is answering`);
          setCurrentAnsweringStudent({ studentId, studentName, teamId, teamName });
        });

        socket.on('bb:answer-result', ({ teamId, isCorrect, pointsAwarded, basePointsAwarded, earlyBonusAwarded, newScore, streak, noMoreSteals, answeredBy, answeredByName }) => {
          console.log(`🔔 Answer result: ${isCorrect ? 'Correct' : 'Wrong'}, answered by: ${answeredByName || answeredBy}`);
          if (answerCountdownRef.current) {
            clearInterval(answerCountdownRef.current);
            answerCountdownRef.current = null;
            setAnswerDeadline(null);
            setRemainingMs(0);
            setAnswerTimeLimitSec(0);
          }

          // Update team score
          setTeams(prev => prev.map(t => 
            t.teamId === teamId 
              ? { ...t, score: newScore, streak: streak || 0 }
              : t
          ));

          // Clear answering student when result comes
          setCurrentAnsweringStudent(null);

          if (isCorrect || noMoreSteals) {
            // Move to results
            setTimeout(() => {
              setGameState(prev => ({
                ...prev,
                phase: 'results',
                buzzedTeam: null,
                isStealPhase: false
              }));
            }, 2000);
          }
        });

        socket.on('bb:steal-phase', ({ wrongTeamId, remainingSteals }) => {
          console.log(`🔔 Steal phase: ${remainingSteals} steals remaining`);
          setCurrentAnsweringStudent(null); // Clear answering student
          if (answerCountdownRef.current) {
            clearInterval(answerCountdownRef.current);
            answerCountdownRef.current = null;
            setAnswerDeadline(null);
            setRemainingMs(0);
            setAnswerTimeLimitSec(0);
          }
          setGameState(prev => ({
            ...prev,
            phase: 'question',
            buzzedTeam: null,
            isStealPhase: true
          }));
        });

        socket.on('bb:next-question', () => {
          setCurrentAnsweringStudent(null); // Clear answering student
          if (answerCountdownRef.current) {
            clearInterval(answerCountdownRef.current);
            answerCountdownRef.current = null;
            setAnswerDeadline(null);
            setRemainingMs(0);
            setAnswerTimeLimitSec(0);
          }
          setGameState(prev => ({
            ...prev,
            phase: 'question',
            revealedWords: [],
            buzzedTeam: null,
            isStealPhase: false
          }));
        });

        socket.on('bb:game-finished', ({ teams: finalTeams }) => {
          console.log('🔔 Game finished');
          setTeams(finalTeams);
          setGameState(prev => ({ ...prev, phase: 'finished' }));
        });

        socket.on('bb:error', ({ message }) => {
          console.error('Socket error:', message);
          alert(message);
        });

      } catch (error) {
        console.error('Error setting up game:', error);
        alert('Failed to setup game');
        navigate('/teacher/buzzer-battle');
      }
    };

    setupGame();

    return () => {
      if (revealInterval.current) clearInterval(revealInterval.current);
      if (answerTimeout.current) clearTimeout(answerTimeout.current);
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [taskId, subjectId, navigate]);

  // Helper functions
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const idToName: Record<string, string> = {};
  students.forEach(s => { if (s?.id) idToName[s.id] = s.name; });

  const studentTeamTag: Record<string, string> = {};
  teams.forEach((t, idx) => {
    (t.memberIds || []).forEach(mid => { studentTeamTag[mid] = `T${idx + 1}`; });
  });

  // Team creation
  const handleCreateTeams = (groupCount: number) => {
    if (students.length < 2) {
      alert('Need at least 2 students to create teams');
      return;
    }

    // Auto-assign students to teams
    const shuffled = [...students].sort(() => Math.random() - 0.5);
    const teamsData: Team[] = [];
    
    const teamCount = Math.max(2, Math.min(groupCount, students.length));
    
    for (let i = 0; i < teamCount; i++) {
      teamsData.push({
        teamId: `team-${i + 1}`,
        name: `Team ${i + 1}`,
        memberIds: [],
        score: 0,
        streak: 0,
        frozen: false,
        consecutiveWrong: 0
      });
    }
    
    shuffled.forEach((student, idx) => {
      const teamIndex = idx % teamCount;
      teamsData[teamIndex].memberIds.push(student.id);
    });

    setTeams(teamsData);
    
    if (socketRef.current) {
      socketRef.current.emit('bb:create-teams', {
        roomCode,
        teams: teamsData
      });
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, studentId: string) => {
    try {
      e.dataTransfer.setData('text/plain', studentId);
      e.dataTransfer.effectAllowed = 'move';
    } catch {}
  };

  const handleDropOnTeam = (e: React.DragEvent, teamId: string) => {
    e.preventDefault();
    setDropOverTeamId(null);
    const studentId = e.dataTransfer.getData('text/plain');
    if (!studentId) return;
    
    setTeams(prev => {
      // Remove from any team first
      const next = prev.map(t => ({ ...t, memberIds: t.memberIds.filter(id => id !== studentId) }));
      // Add to target team if not already
      const tidx = next.findIndex(t => t.teamId === teamId);
      if (tidx >= 0 && !next[tidx].memberIds.includes(studentId)) {
        next[tidx] = { ...next[tidx], memberIds: [...next[tidx].memberIds, studentId] };
      }
      
      if (socketRef.current) {
        socketRef.current.emit('bb:create-teams', { roomCode, teams: next });
      }
      return next;
    });
  };

  const handleDropOnPresent = (e: React.DragEvent) => {
    e.preventDefault();
    setDropOverPresent(false);
    const studentId = e.dataTransfer.getData('text/plain');
    if (!studentId) return;
    
    setTeams(prev => {
      const next = prev.map(t => ({ ...t, memberIds: t.memberIds.filter(id => id !== studentId) }));
      if (socketRef.current) {
        socketRef.current.emit('bb:create-teams', { roomCode, teams: next });
      }
      return next;
    });
  };

  const handleStartGame = () => {
    if (teams.length === 0) {
      alert('Please create teams first');
      return;
    }

    console.log('🎮 Host clicking Start Game button');
    
    if (socketRef.current) {
      socketRef.current.emit('bb:start-game', { roomCode });
      console.log('📤 Host emitted bb:start-game, now calling startQuestion(0)');
      startQuestion(0);
    }
  };

  const startQuestion = (questionIndex: number) => {
    if (!task || questionIndex >= task.questions.length) {
      console.log('❌ Cannot start question: no task or invalid index');
      return;
    }

    console.log(`📋 Starting question ${questionIndex}`, task.questions[questionIndex].text);

    setGameState(prev => ({
      ...prev,
      currentQuestion: questionIndex,
      phase: 'question',
      revealedWords: [],
      buzzedTeam: null,
      isStealPhase: false
    }));

    if (socketRef.current) {
      console.log(`📤 Emitting bb:start-question for question ${questionIndex}`);
      socketRef.current.emit('bb:start-question', {
        roomCode,
        questionIndex
      });
    }
  };

  const handleNextQuestion = () => {
    const nextIndex = gameState.currentQuestion + 1;
    
    if (nextIndex >= task.questions.length) {
      // Game over
      handleEndGame();
    } else {
      if (socketRef.current) {
        socketRef.current.emit('bb:next-question', { roomCode });
      }
      startQuestion(nextIndex);
    }
  };

  const handleEndGame = () => {
    if (socketRef.current) {
      socketRef.current.emit('bb:end-game', { roomCode });
    }
  };

  const handleViewAnalytics = () => {
    navigate(`/teacher/buzzer-battle-analytics/${sessionId}`);
  };

  const getQRCodeURL = () => {
    return `http://localhost:3000/student/buzzer-battle/${roomCode}`;
  };

  const currentQuestion = task?.questions?.[gameState.currentQuestion];
  const sortedTeams = [...teams].sort((a, b) => b.score - a.score);

  if (loading) {
    return (
      <div className="bb-host-page">
        <div className="bb-host-loading">
          <i className="fas fa-spinner fa-spin"></i>
          <p>Setting up Buzzer Battle...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="host-buzzer-battle">
      {/* Hero Header */}
      <div className="bb-lobby-header">
        <div className="bb-lobby-hero">
        <div className="bb-lobby-title">
          <button className="bb-lobby-back-btn" onClick={() => navigate('/teacher/party-games')}>
            <i className="fas fa-arrow-left"></i>
          </button>
          <h1 className="bb-lobby-title-text">Buzzer Battle</h1>
        </div>
        <div className='bb-lobby-phase'>{gameState.phase}</div>
        <div className="bb-lobby-chips">
          <span className="bb-lobby-chip room" title="Room Code"><i className="fas fa-hashtag"></i> {roomCode}</span>
          <span className="bb-lobby-chip present" title="Present"><i className="fas fa-users"></i> {students.length} Present</span>
          {teams.length > 0 && (
            <span className="bb-lobby-chip next" title="Teams"><i className="fas fa-layer-group"></i> {teams.length} Teams</span>
          )}
        </div>
        </div>
      </div>

      {/* Main Content */}
      {gameState.phase === 'lobby' && (
        <div className="bb-lobby-container">
            <div className="bb-lobby-layout">
              {/* Present Students Panel */}
              <div className="bb-lobby-panel bb-lobby-present">
                <div className="bb-lobby-panel-head">
                  <h3 className="bb-lobby-section-title"><i className="fas fa-user-check"></i> Present / Active</h3>
                  <span className="bb-lobby-count-badge">{students.length}</span>
                </div>
                <div
                  className="bb-lobby-list"
                  onDragOver={(e) => { e.preventDefault(); setDropOverPresent(true); }}
                  onDragLeave={() => setDropOverPresent(false)}
                  onDrop={handleDropOnPresent}
                >
                  {students.map(s => (
                    <div
                      key={s.id}
                      className={`bb-lobby-list-item present`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, s.id)}
                      style={{ position: 'relative' }}
                    >
                      {studentTeamTag[s.id] && <span className="bb-lobby-team-tag">{studentTeamTag[s.id]}</span>}
                      <div className="bb-lobby-li-name">{s.name}</div>
                      <div className={`bb-lobby-li-badge present`}>Ready</div>
                    </div>
                  ))}
                  {students.length === 0 && (
                    <div className="bb-lobby-empty">Waiting for students to join…</div>
                  )}
                </div>
              </div>

              {/* Teams Panel */}
              <aside className="bb-lobby-panel bb-lobby-teams">
                <div className="bb-lobby-panel-head">
                  <h3 className="bb-lobby-section-title"><i className="fas fa-layer-group"></i> Teams</h3>
                  <span className="bb-lobby-count-badge">{teams.length}</span>
                </div>
                <div className="bb-lobby-teams-container">
                  {teams.map(t => (
                    <div
                      key={t.teamId}
                      className={`bb-lobby-team-card${dropOverTeamId === t.teamId ? ' drop' : ''}`}
                      onDragOver={(e) => { e.preventDefault(); setDropOverTeamId(t.teamId); }}
                      onDragLeave={() => setDropOverTeamId(null)}
                      onDrop={(e) => handleDropOnTeam(e, t.teamId)}
                    >
                      <div className="bb-lobby-team-name">{t.name}</div>
                      <div className="bb-lobby-team-count">{t.memberIds.length} member{t.memberIds.length === 1 ? '' : 's'}</div>
                      <div className="bb-lobby-team-members">
                        {t.memberIds.length === 0 && (
                          <div className="bb-lobby-empty">No members yet</div>
                        )}
                        {t.memberIds.map((mid) => {
                          const name = idToName[mid] || mid;
                          return (
                            <div
                              className="bb-lobby-team-member"
                              key={mid}
                              draggable
                              onDragStart={(e) => handleDragStart(e, mid)}
                            >
                              <div className="bb-lobby-tm-avatar">{(name || '?').charAt(0).toUpperCase()}</div>
                              <div className="bb-lobby-tm-name">{name}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </aside>

              {/* QR Panel */}
              <div className="bb-lobby-panel bb-lobby-qr">
                <div className="bb-lobby-panel-head">
                  <h3 className="bb-lobby-section-title"><i className="fas fa-qrcode"></i> Join via QR</h3>
                </div>
                <p style={{ textAlign: 'center', color: '#1e3c72' }}>Scan to join. Room Code: <strong>{roomCode}</strong></p>
                <div className="bb-qr-container" style={{ display: 'flex', justifyContent: 'center' }}>
                  <QRCode value={`http://localhost:3000/student/buzzer-battle/${roomCode}`} size={180} />
                </div>
              </div>
              
              {/* Control Panel */}
              <div className="bb-lobby-panel bb-lobby-wait">
                <h3 className="bb-lobby-section-title"><i className="fas fa-hourglass-half"></i> Waiting for Students</h3>
                <div className="bb-lobby-actions bb-lobby-auto-group">
                  <label className="bb-lobby-auto-group-label">Auto Group:</label>
                  <select
                    value={numTeams}
                    onChange={(e) => setNumTeams(Math.max(2, Math.min(8, Number(e.target.value))))}
                    className="bb-lobby-select"
                  >
                    {[2,3,4,5,6,7,8].map(n => (<option key={n} value={n}>{n} groups</option>))}
                  </select>
                  <button className="bb-lobby-btn blue" onClick={() => handleCreateTeams(numTeams)}>
                    Apply
                  </button>
                </div>
                <div className="bb-lobby-actions bb-lobby-start">
                  <button className="bb-lobby-btn primary" disabled={!teams.length} onClick={handleStartGame}>
                    <i className="fas fa-play"></i> Start Game
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}


        {/* Question Phase */}
        {(gameState.phase === 'question' || gameState.phase === 'answering') && currentQuestion && (
          <div className="bb-host-game">
            <div className="bb-host-question-section">
              <div className="bb-question-header">
                <span className="bb-question-number">
                  Question {gameState.currentQuestion + 1} of {task.questions.length}
                </span>
                <span className="bb-question-points">{currentQuestion.points} pts</span>
                {currentQuestion.category && (
                  <span className="bb-question-category">{currentQuestion.category}</span>
                )}
              </div>

              <div className="bb-question-display">
                {gameState.phase === 'question' ? (
                  <p className="bb-question-text-reveal">
                    {gameState.revealedWords.join(' ')}
                    {gameState.revealedWords.length < currentQuestion.text.split(' ').length && (
                      <span className="bb-cursor-blink">_</span>
                    )}
                  </p>
                ) : (
                  <p className="bb-question-text-full">
                    {currentQuestion.text}
                  </p>
                )}
              </div>

              {gameState.phase === 'answering' && gameState.buzzedTeam && (
                <div className="bb-answering-state">
                  <p className="bb-buzzed-team">
                    <i className="fas fa-bell"></i>
                    {teams.find(t => t.teamId === gameState.buzzedTeam)?.name} buzzed in!
                  </p>
                  {answerDeadline && (
                    <div className="bb-answer-timer" style={{ marginTop: '6px' }}>
                      <i className="fas fa-hourglass-half"></i>{' '}
                      <span>{String(Math.ceil(remainingMs / 1000)).padStart(2, '0')}s</span>
                      {answerTimeLimitSec > 0 && (
                        <div className="bb-timer-bar" style={{ marginTop: '6px', height: '6px', background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
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
                {currentAnsweringStudent ? (
                    <div className="bb-current-answering">
                      <i className="fas fa-user"></i>
                      <p className="bb-waiting-answer">
                        <strong>{currentAnsweringStudent.studentName}</strong> from <strong>{currentAnsweringStudent.teamName}</strong> is answering...
                      </p>
                    </div>
                  ) : (
                    <p className="bb-waiting-answer">Waiting for answer...</p>
                  )}
                </div>
              )}

              {gameState.isStealPhase && (
                <div className="bb-steal-banner">
                  <i className="fas fa-bolt"></i> STEAL OPPORTUNITY!
                </div>
              )}
            </div>

            <div className="bb-host-control-panel">
              <button className="bb-host-skip-btn" onClick={handleNextQuestion}>
                <i className="fas fa-forward"></i> Skip Question
              </button>
              <button className="bb-host-end-btn" onClick={handleEndGame}>
                <i className="fas fa-stop"></i> End Game
              </button>
            </div>
          </div>
        )}

        {/* Results Phase */}
        {gameState.phase === 'results' && (
          <div className="bb-host-results">
            <h2>Question Complete!</h2>
            <p className="bb-correct-answer">
              Correct Answer: {currentQuestion?.acceptedAnswers}
            </p>
            {/* Optional: show awarded breakdown if available in last event (requires keeping last result in state) */}
            {/* You can wire a state to store basePointsAwarded and earlyBonusAwarded from bb:answer-result if you want this visible to host */}
            <button className="bb-host-next-btn" onClick={handleNextQuestion}>
              {gameState.currentQuestion + 1 < task.questions.length ? 'Next Question' : 'Finish Game'}
            </button>
          </div>
        )}

        {/* Finished Phase */}
        {gameState.phase === 'finished' && (
          <div className="bb-host-finished">
            <h2>🎉 Game Complete!</h2>
            <div className="bb-final-rankings">
              <h3>Final Rankings</h3>
              {sortedTeams.map((team, index) => (
                <div key={team.teamId} className={`bb-rank-card rank-${index + 1}`}>
                  <span className="bb-rank-position">#{index + 1}</span>
                  <span className="bb-rank-team">{team.name}</span>
                  <span className="bb-rank-score">{team.score} pts</span>
                </div>
              ))}
            </div>
            <div className="bb-finished-actions">
              <button className="bb-host-analytics-btn" onClick={handleViewAnalytics}>
                <i className="fas fa-chart-bar"></i> View Analytics
              </button>
              <button className="bb-host-back-btn" onClick={() => navigate('/teacher/buzzer-battle')}>
                <i className="fas fa-home"></i> Back to Management
              </button>
            </div>
          </div>
        )}

      {/* Scoreboard Sidebar */}
      {(gameState.phase === 'question' || gameState.phase === 'answering' || gameState.phase === 'results') && (
        <div className="bb-host-scoreboard">
          <h3>Scoreboard</h3>
          {sortedTeams.map((team, index) => (
            <div 
              key={team.teamId} 
              className={`bb-score-card ${team.frozen ? 'frozen' : ''} ${team.teamId === gameState.buzzedTeam ? 'buzzed' : ''}`}
            >
              <div className="bb-score-rank">#{index + 1}</div>
              <div className="bb-score-info">
                <div className="bb-score-team-name">
                  {team.name}
                  {team.frozen && <i className="fas fa-snowflake"></i>}
                </div>
                <div className="bb-score-details">
                  <span className="bb-score-points">{team.score} pts</span>
                  {team.streak > 0 && (
                    <span className="bb-score-streak">
                      <i className="fas fa-fire"></i> {team.streak}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* QR Code Modal removed; QR visible in lobby */}
    </div>
  );
};

export default HostBuzzerBattle;

