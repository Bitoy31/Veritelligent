import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import '../../styles/student_grid_quest.css';
import GridQuestBoard, { GQClue } from '../../components/gridquest/GridQuestBoard';

type Phase = 'lobby' | 'board' | 'clue' | 'reveal' | 'finished';

const StudentGridQuest: React.FC = () => {
  const params = useParams<{ roomCode?: string }>();
  const navigate = useNavigate();
  const roomCode = (params.roomCode || '').toUpperCase();
  const socketRef = useRef<Socket | null>(null);
  const [phase, setPhase] = useState<Phase>('lobby');
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [countdown, setCountdown] = useState<number>(3);
  const [answer, setAnswer] = useState<string>('');
  const [categories, setCategories] = useState<string[]>(['Cat 1', 'Cat 2', 'Cat 3', 'Cat 4', 'Cat 5']);
  const [grid, setGrid] = useState<GQClue[][]>(() =>
    Array.from({ length: 5 }).map((_, c) => Array.from({ length: 5 }).map((__, r) => ({ catIdx: c, clueIdx: r, label: `${(r+1)*100}`, taken: false })))
  );
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [answerSubmitted, setAnswerSubmitted] = useState<boolean>(false);
  const [answerCorrect, setAnswerCorrect] = useState<boolean | null>(null);
  const [allStudents, setAllStudents] = useState<Record<string, { id: string; name: string }>>({});
  const [teams, setTeams] = useState<Array<{ teamId: string; name: string; memberIds: string[] }>>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [choosenStudents, setChoosenStudents] = useState<Record<string, string>>({});
  const [choosenOne, setChoosenOne] = useState<string | null>(null);
  const [currentClue, setCurrentClue] = useState<{
    catIdx: number;
    clueIdx: number;
    prompt?: string;
    points?: number;
    timeLimitSec?: number;
    acceptedAnswers?: string[];
  } | null>(null);
  const [teamAnswers, setTeamAnswers] = useState<Record<string, string>>({});
  const [answerResults, setAnswerResults] = useState<Record<string, { correct: boolean; pointsAwarded: number; submittedText: string }>>({});
  
  // Spectator mode: watch chosen student typing
  const [teamChoosenAnswer, setTeamChoosenAnswer] = useState<string>('');
  const [typingStudentName, setTypingStudentName] = useState<string>('');
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setCurrentUser(user);

    const s = io('http://localhost:5000', { withCredentials: true });
    socketRef.current = s;

    console.log(`Student joining room: ${roomCode}`);
    s.emit('join_room', { roomCode, student: { id: user._id, name: `${user.userFname} ${user.userLname}`, isReady: true } });

    // Handle lobby updates
    s.on('lobby_update', (payload: { students: Array<{ id: string; name: string; isReady?: boolean }> }) => {
      console.log('Student received lobby update:', payload);
      const studentMap: Record<string, { id: string; name: string }> = {};
      payload.students?.forEach(student => {
        studentMap[student.id] = { id: student.id, name: student.name };
      });
      setAllStudents(studentMap);
      setPhase('lobby');
    });

    // Handle board started (when teacher enters board phase)
    s.on('gq_board_started', (p: { categories: string[], grid: GQClue[][] }) => {
      setCategories(p.categories || categories);
      setGrid(p.grid || grid);
      setPhase('board');
    });

    // Handle clue reveal with question data
    s.on('gq_clue_reveal', (p: { catIdx: number, clueIdx: number, points: number, prompt: string, acceptedAnswers: string[], timeLimitSec?: number }) => {
      console.log('Student Clue Reveal Debug:');
      console.log('Payload:', p);
      console.log('Accepted Answers:', p.acceptedAnswers || []);

      setCurrentClue({
        catIdx: p.catIdx,
        clueIdx: p.clueIdx,
        prompt: p.prompt,
        points: p.points,
        timeLimitSec: 20,
        acceptedAnswers: p.acceptedAnswers || []
      });
      setAnswerSubmitted(false);
      setAnswerCorrect(null);
      setAnswer('');
      setAnswerResults({});
      setTimeLeft(p.timeLimitSec || 20);
      setPhase('clue');
      
      // Clear spectator typing state for new clue
      setTeamChoosenAnswer('');
      setTypingStudentName('');
    });

    // Handle team setup
    s.on('gq_team_setup', (p: { teams: Array<{ teamId: string; name: string; memberIds: string[] }> }) => {
      setTeams(p.teams || []);
    });

    // Handle score updates
    s.on('gq_score_update', (p: { scores: Record<string, number> }) => {
      setScores(p.scores || {});
    });

    // Handle timer updates
    s.on('timer_tick', (p: { timeLeft: number }) => {
      console.log(`Student received timer tick: ${p.timeLeft}`);
      setTimeLeft(p.timeLeft);
    });

    // Handle countdown updates
    s.on('countdown_update', (p: { value: number }) => {
      console.log(`Student received countdown: ${p.value}`);
      setCountdown(p.value);
    });

    // Handle choosen students selection
    s.on('gq_choosen_selected', (p: { choosenStudents: Record<string, string>, choosenOne: string }) => {
      setChoosenStudents(p.choosenStudents);
      setChoosenOne(p.choosenOne);
      // Clear spectator typing state when new students are chosen
      setTeamChoosenAnswer('');
      setTypingStudentName('');
    });

    // Handle real-time typing from chosen student (for spectators)
    s.on('gq_answer_typing', (p: { text: string, typingStudentId: string }) => {
      setTeamChoosenAnswer(p.text);
      // Get the name of the student who is typing
      const typingName = getStudentName(p.typingStudentId, 'Teammate');
      setTypingStudentName(typingName);
      console.log(`👀 Spectator: Watching ${typingName} type: "${p.text}"`);
    });

    // Handle answer received (server acknowledgment)
    s.on('gq_answer_received', (p: { studentId: string }) => {
      // Answer was received by server, UI will be updated via answer results
    });

    // Handle answer results
    s.on('gq_answer_result', (p: { teamId: string; correct: boolean; pointsAwarded: number; submittedText: string }) => {
      console.log('Student received answer result:', p);
      setAnswerResults(prev => ({ ...prev, [p.teamId]: { correct: p.correct, pointsAwarded: p.pointsAwarded, submittedText: p.submittedText } }));
    });

    // Handle score updates
    s.on('gq_score_update', (p: { scores: Record<string, number> }) => {
      setScores(p.scores || {});
    });

    // Handle next turn (back to board phase)
    s.on('gq_next_turn', () => {
      setPhase('board');
      setAnswerResults({});
    });

    // Handle game phases
    s.on('game_finished', () => setPhase('finished'));
    s.on('gq_clue_reveal', () => {
      setPhase('clue');
      });
    s.on('gq_reveal_phase', () => {
      console.log(`Student received reveal phase transition for room: ${roomCode} - transitioning to reveal phase`);
      console.log('Student: Current phase before transition:', phase);
      setPhase('reveal');
      setTimeLeft(0);
      setCountdown(0);
      console.log('Student: Phase transition complete, new phase:', 'reveal');
    });

    return () => { try { s.emit('leave_room'); s.disconnect(); } catch {} };
  }, [roomCode]);

  // Auto-submit answer when timer reaches 0
  useEffect(() => {
    if (phase === 'clue' && timeLeft === 0 && !answerSubmitted && answer.trim()) {
      console.log('Auto-submitting answer as timer reached 0');
      submit();
    }
  }, [timeLeft, phase]);

  // Simple functions for the UI
  const submit = () => {
    if (!socketRef.current) return;
    
    // Allow submitting even empty answers when timer runs out
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    console.log('Student submitting answer:', answer);
    console.log('Current clue accepted answers:', currentClue?.acceptedAnswers || []);

    socketRef.current.emit('gq_answer_submit', { roomCode, studentId: user._id, text: answer.trim() });
    setAnswerSubmitted(true);
  };

  // Debounced typing emit for chosen students (so spectators can watch in real-time)
  const handleTyping = (text: string) => {
    setAnswer(text);
    
    // Only emit typing events if this student is the chosen one
    const myTeam = teams.find(t => t.memberIds.includes(currentUser?._id));
    if (!myTeam) return;
    
    const isChosen = choosenStudents[myTeam.teamId] === currentUser?._id;
    if (!isChosen) return;

    // Debounce: clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Emit after 200ms of no typing
    typingTimeoutRef.current = setTimeout(() => {
      if (socketRef.current && currentUser?._id) {
        socketRef.current.emit('gq_answer_typing', { 
          roomCode, 
          studentId: currentUser._id, 
          text 
        });
      }
    }, 200);
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getStudentName = (studentId: string, fallbackName?: string) => {
    if (allStudents[studentId]) {
      return allStudents[studentId].name;
    }
    if (studentId === currentUser?._id) {
      return `${currentUser.userFname} ${currentUser.userLname}`;
    }
    return fallbackName || 'Loading...';
  };

  return (
    <div className={`student-grid-quest ${phase}`}>
      {/* Header - Same as host */}
      <div className="sgq-hero">
        <div className="sgq-title">
          <button className="sgq-back-btn" onClick={() => navigate('/student/party-games')}>
            <i className="fas fa-arrow-left"></i>
          </button>
          <i className="fas fa-grid-2"></i>
          <span className="sgq-title-text">Grid Quest</span>
        </div>
        <div className="sgq-phase">{phase.charAt(0).toUpperCase() + phase.slice(1)}</div>
        <div className="sgq-chips">
          <span className="sgq-chip">
            <i className="fas fa-hashtag"></i> {roomCode}
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className="sgq-content">
        {/* Lobby Phase */}
        {phase === 'lobby' && (
          <div className="sgq-lobby">
            <div className="sgq-lobby-header">
              <h3 className="sgq-lobby-title">Waiting for Game to Start</h3>
              <p className="sgq-lobby-subtitle">Your teacher will start the game soon</p>
            </div>

            {/* Show team members when teams are set up */}
            {teams.length > 0 && (() => {
              const myTeam = teams.find(t => t.memberIds.includes(currentUser?._id));
              return myTeam ? (
                <div className="sgq-team-section">
                  <div className="sgq-team-header">
                    <h3 className="sgq-section-title">
                      <i className="fas fa-users"></i>
                      Your Team
                    </h3>
                  </div>

                  <div className="sgq-team-card">
                    <h4 className="sgq-team-name">{myTeam.name}</h4>
                    <div className="sgq-team-members">
                      {myTeam.memberIds.map((memberId) => {
                        const memberName = getStudentName(memberId);
                        const isCurrentUser = memberId === currentUser?._id;
                        const isChoosen = choosenStudents[myTeam.teamId] === memberId;
                        const isChoosenOne = choosenOne === memberId;

                        return (
                          <div key={memberId} className="sgq-team-member">
                            <div className="sgq-member-avatar">
                              {getInitials(memberName)}
                            </div>
                            <div className="sgq-member-info">
                              <div className={`sgq-member-name ${memberName === 'Loading...' ? 'sgq-loading-name' : ''}`}>
                                {memberName}
                                {isCurrentUser && <span className="sgq-you-indicator"> (You)</span>}
                              </div>
                              {isChoosen && !isChoosenOne && (
                                <div className="sgq-member-role sgq-choosen">Choosen</div>
                              )}
                              {isChoosenOne && (
                                <div className="sgq-member-role sgq-choosen-one">Choosen One</div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : null;
            })()}
          </div>
        )}

        {/* Board Phase */}
        {phase === 'board' && (
          <>
            <div className="sgq-board">
              <GridQuestBoard
                categories={categories}
                grid={grid}
                readOnly={true} // Students can't select tiles, only view
              />
            </div>
            <div className="sgq-board-footer">
              <div className="sgq-board-instruction">
                {choosenOne === currentUser?._id ? (
                  <>
                    <i className="fas fa-hand-pointer"></i>
                    <span>Select a tile to choose your question</span>
                  </>
                ) : (
                  <>
                    <i className="fas fa-clock"></i>
                    <span>Waiting for the Choosen One to select a question</span>
                  </>
                )}
              </div>
              <div className="sgq-scoreboard">
                {teams.map(t => (
                  <div key={t.teamId} className="sgq-score-card">
                    <div className="sgq-score-team">{t.name}</div>
                    <div className="sgq-score-value">{Number.isFinite(scores[t.teamId] as any) ? (scores[t.teamId] || 0) : 0}</div>
                  </div>
                ))}
                {teams.length === 0 && (
                  <div className="sgq-empty">No teams yet</div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Clue Phase */}
      {phase === 'clue' && (() => {
        // Determine if this student is the chosen one
        const myTeam = teams.find(t => t.memberIds.includes(currentUser?._id));
        const isChosen = myTeam ? choosenStudents[myTeam.teamId] === currentUser?._id : false;

        return (
          <div className="sgq-clue">
            <div className="sgq-clue-header">
              <div className="sgq-timer-section">
                <div className="sgq-timer-label">
                  {countdown > 0 ? 'Starting In' : 'Time Left'}
                </div>
                <div className={`sgq-timer-value ${countdown > 0 ? 'sgq-countdown' : ''}`}>
                  {countdown > 0 ? countdown : `${timeLeft}s`}
                </div>
              </div>
            </div>

            {/* Role indicator */}
            {isChosen ? (
              <div style={{
                background: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
                color: 'white',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontWeight: '600',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
              }}>
                <i className="fas fa-user-check"></i>
                <span>You are chosen to answer for your team!</span>
              </div>
            ) : (
              <div style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
                color: '#78350f',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontWeight: '600',
                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
              }}>
                <i className="fas fa-eye"></i>
                <span>You are spectating - watch your teammate answer</span>
              </div>
            )}

            <div className="sgq-clue-content">
              <div className="sgq-clue-text">
                {currentClue?.prompt || 'Question will be displayed here'}
              </div>
              {currentClue?.points && (
                <div className="sgq-points-display">
                  <span>Points: {currentClue.points}</span>
                </div>
              )}
            </div>

            <div className="sgq-answer-section">
              {isChosen ? (
                // CHOSEN STUDENT: Can type and submit
                <>
                  <textarea
                    className="sgq-answer-input"
                    value={answer}
                    onChange={(e) => handleTyping(e.target.value)}
                    placeholder="Type your answer here..."
                    disabled={answerSubmitted}
                  />
                  <button
                    className="sgq-submit-btn"
                    onClick={submit}
                    disabled={answerSubmitted || !answer.trim()}
                  >
                    {answerSubmitted ? 'Answer Submitted' : 'Submit Answer'}
                  </button>
                </>
              ) : (
                // SPECTATOR: Watch teammate type
                <>
                  {typingStudentName && (
                    <div style={{
                      fontSize: '0.9rem',
                      color: '#64748b',
                      marginBottom: '0.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <i className="fas fa-keyboard"></i>
                      <span>{typingStudentName} is typing...</span>
                    </div>
                  )}
                  <textarea
                    className="sgq-answer-input"
                    value={teamChoosenAnswer}
                    placeholder="Waiting for your teammate to type..."
                    disabled
                    style={{
                      background: '#f8f9fa',
                      cursor: 'not-allowed',
                      color: '#64748b'
                    }}
                  />
                  <button
                    className="sgq-submit-btn"
                    disabled
                    style={{
                      opacity: 0.5,
                      cursor: 'not-allowed'
                    }}
                  >
                    <i className="fas fa-lock"></i> Only {typingStudentName || 'your teammate'} can submit
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })()}

        {/* Reveal Phase */}
        {phase === 'reveal' && (
          <div className="sgq-reveal">
            <div className="sgq-reveal-answers">
              <div className="sgq-true-answers">
                <div className="sgq-true-label">Correct Answer{(currentClue?.acceptedAnswers || []).length > 1 ? 's' : ''}:</div>
                <div className="sgq-true-text">
                  {(currentClue?.acceptedAnswers || []).join(', ') || '—'}
                </div>
              </div>
              <div className="sgq-team-answers">
                {teams.map((t) => {
                  const ans = teamAnswers[t.teamId] || '';
                  const result = answerResults[t.teamId];
                  const isCorrect = result ? result.correct : false;
                  const pointsAwarded = result ? result.pointsAwarded : 0;
                  const displayText = result ? result.submittedText : ans;
                  return (
                    <div key={t.teamId} className={`sgq-team-answer ${isCorrect ? 'correct' : 'wrong'}`}>
                      <div className="team-name">{t.name}</div>
                      <div className="team-answer-text">{displayText || '—'}</div>
                      <div className={`badge ${isCorrect ? 'ok' : 'no'}`}>
                        {isCorrect ? 'Correct' : 'Wrong'} {pointsAwarded !== 0 && `(${pointsAwarded > 0 ? '+' : ''}${pointsAwarded})`}
                      </div>
                    </div>
                  );
                })}
                {teams.length === 0 && (
                  <div className="sgq-empty">No teams yet</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Finished Phase */}
        {phase === 'finished' && (
          <div className="sgq-finished">
            {(() => {
              // Find current user's team
              const myTeam = teams.find(t => t.memberIds.includes(currentUser?._id));
              
              if (!myTeam) {
                return (
                  <div className="sgq-finished-message">
                    <i className="fas fa-trophy"></i>
                    <h3>Game Finished!</h3>
                    <p>Thanks for playing Grid Quest!</p>
                  </div>
                );
              }

              // Calculate rankings
              const rankedTeams = [...teams]
                .map(team => ({
                  ...team,
                  score: scores[team.teamId] || 0
                }))
                .sort((a, b) => b.score - a.score);

              // Find my team's position
              const myPosition = rankedTeams.findIndex(t => t.teamId === myTeam.teamId) + 1;

              // Trophy data based on position
              const trophyData = {
                1: {
                  icon: 'crown',
                  color: 'linear-gradient(135deg, #ffd700 0%, #ffed4e 100%)',
                  title: 'Champion!',
                  message: 'Outstanding performance! You are the champions!',
                  shadow: '0 12px 30px rgba(255, 215, 0, 0.5)'
                },
                2: {
                  icon: 'medal',
                  color: 'linear-gradient(135deg, #c0c0c0 0%, #e8e8e8 100%)',
                  title: 'Silver Medal!',
                  message: 'Excellent work! So close to the top!',
                  shadow: '0 12px 30px rgba(192, 192, 192, 0.5)'
                },
                3: {
                  icon: 'award',
                  color: 'linear-gradient(135deg, #cd7f32 0%, #e6a057 100%)',
                  title: 'Bronze Medal!',
                  message: 'Great effort! You made it to the podium!',
                  shadow: '0 12px 30px rgba(205, 127, 50, 0.5)'
                }
              };

              const trophy = trophyData[myPosition as keyof typeof trophyData];

              if (trophy) {
                // Top 3 - Show trophy
                return (
                  <div className="sgq-trophy-container">
                    <div 
                      className="sgq-trophy-icon"
                      style={{ 
                        background: trophy.color,
                        boxShadow: trophy.shadow
                      }}
                    >
                      <i className={`fas fa-${trophy.icon}`}></i>
                    </div>
                    <h1 className="sgq-trophy-title">{trophy.title}</h1>
                    <p className="sgq-trophy-message">{trophy.message}</p>
                    <div className="sgq-trophy-details">
                      <div className="sgq-trophy-team">{myTeam.name}</div>
                      <div className="sgq-trophy-score">{scores[myTeam.teamId] || 0} points</div>
                      <div className="sgq-trophy-position">Rank: {myPosition} of {teams.length}</div>
                    </div>
                  </div>
                );
              } else {
                // Not in top 3 - Show encouraging message
                const encouragingMessages = [
                  "Better luck next time! Keep practicing!",
                  "Great effort! Every game is a learning experience!",
                  "Don't give up! You'll get them next time!",
                  "Well played! You're improving with each game!",
                  "Keep your head up! Success is just around the corner!"
                ];
                
                const randomMessage = encouragingMessages[Math.floor(Math.random() * encouragingMessages.length)];

                return (
                  <div className="sgq-encouragement-container">
                    <div className="sgq-encouragement-icon">
                      <i className="fas fa-heart"></i>
                    </div>
                    <h2 className="sgq-encouragement-title">Good Game!</h2>
                    <p className="sgq-encouragement-message">{randomMessage}</p>
                    <div className="sgq-encouragement-details">
                      <div className="sgq-encouragement-team">{myTeam.name}</div>
                      <div className="sgq-encouragement-score">{scores[myTeam.teamId] || 0} points</div>
                      <div className="sgq-encouragement-position">Rank: {myPosition} of {teams.length}</div>
                    </div>
                  </div>
                );
              }
            })()}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentGridQuest;
