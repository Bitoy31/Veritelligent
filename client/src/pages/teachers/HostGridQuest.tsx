import React, { useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useNavigate, useSearchParams } from 'react-router-dom';
import '../../styles/host_grid_quest.css';
import GridQuestBoard, { GQClue } from '../../components/gridquest/GridQuestBoard';
import { mockAllStudents, getMockPresentStudents } from '../../mocks/gridquestStudents';
import QRCode from 'react-qr-code';

type Phase = 'lobby' | 'board' | 'clue' | 'reveal' | 'finished';

const HostGridQuest: React.FC = () => {
  const socketRef = useRef<Socket | null>(null);
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const taskId = sp.get('taskId') || '';
  const [phase, setPhase] = useState<Phase>('lobby');
  const [roomCode, setRoomCode] = useState<string>('');
  const [students, setStudents] = useState<Array<{ id: string; name: string; isReady?: boolean }>>([]);
  const [teams, setTeams] = useState<Array<{ teamId: string; name: string; memberIds: string[] }>>([]);
  const [currentTeamIdx, setCurrentTeamIdx] = useState<number>(0);
  const [reps, setReps] = useState<Record<string, string>>({});
  const [countdown, setCountdown] = useState<number>(3);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [categories, setCategories] = useState<string[]>(['Cat 1', 'Cat 2', 'Cat 3', 'Cat 4', 'Cat 5']);
  const [grid, setGrid] = useState<GQClue[][]>(() =>
    Array.from({ length: 5 }).map((_, c) => Array.from({ length: 5 }).map((__, r) => ({ catIdx: c, clueIdx: r, label: `${(r + 1) * 100}`, taken: false })))
  );
  const [allStudents, setAllStudents] = useState<Array<{ id: string; name: string; status?: string }>>([]);
  const [groupCount, setGroupCount] = useState<number>(4);
  const [subjectIdState, setSubjectIdState] = useState<string>('');
  const [dropOverTeamId, setDropOverTeamId] = useState<string | null>(null);
  const [dropOverPresent, setDropOverPresent] = useState<boolean>(false);
  const [taskData, setTaskData] = useState<any>(null);
  const [currentClue, setCurrentClue] = useState<{ catIdx: number; clueIdx: number; prompt?: string; points?: number; timeLimitSec?: number; acceptedAnswers?: string[] } | null>(null);
  const [teamAnswers, setTeamAnswers] = useState<Record<string, string>>({});
  const [answerResults, setAnswerResults] = useState<Record<string, { correct: boolean; pointsAwarded: number; submittedText: string }>>({});
  const teamsRef = useRef<Array<{ teamId: string; memberIds: string[] }>>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentClueRef = useRef<{ catIdx: number; clueIdx: number; prompt?: string; points?: number; timeLimitSec?: number; acceptedAnswers?: string[] } | null>(null);
  const [showChooseModal, setShowChooseModal] = useState<boolean>(false);
  const [choosenStudents, setChoosenStudents] = useState<Record<string, string>>({});
  const [choosenOne, setChoosenOne] = useState<string | null>(null);
  const [isChoosing, setIsChoosing] = useState<boolean>(false);
  const [showQRCode, setShowQRCode] = useState<boolean>(false);
  
  // First round and choosing logic
  const [isFirstRound, setIsFirstRound] = useState<boolean>(true);
  const [isTileSelectionBlocked, setIsTileSelectionBlocked] = useState<boolean>(false);
  
  // Track previously chosen students per team for rotation
  const [previouslyChosen, setPreviouslyChosen] = useState<Record<string, string[]>>({});
  
  // Offline player management
  const [offlinePlayers, setOfflinePlayers] = useState<Array<{ id: string; name: string }>>([]);
  const [showAddPlayerModal, setShowAddPlayerModal] = useState<boolean>(false);
  const [newPlayerName, setNewPlayerName] = useState<string>('');
  const [newPlayerNameError, setNewPlayerNameError] = useState<string>('');

  const generateRoom = () => Math.random().toString(36).substring(2, 8).toUpperCase();

  const clearTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (countdownTimeoutRef.current) {
      clearInterval(countdownTimeoutRef.current);
      countdownTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    const s = io('https://api.veritelligent.fun', { withCredentials: true });
    socketRef.current = s;
    const code = generateRoom();
    console.log(`Host creating room: ${code}`);
    setRoomCode(code);

    s.on('connect', () => {
      console.log(`Host registering room: ${code}`);
      s.emit('host_register', { roomCode: code });
    });

    s.on('disconnect', () => {
      // Teacher disconnected
    });
    s.on('lobby_update', (payload: { students: Array<{ id: string; name: string; isReady?: boolean }> }) => {
      setStudents(payload.students || []);
    });
    s.on('countdown_update', (p: { value: number }) => setCountdown(p.value));
    s.on('timer_tick', (p: { timeLeft: number }) => setTimeLeft(p.timeLeft));
    s.on('gq_score_update', (p: { scores: Record<string, number> }) => {
      setScores(p.scores || {});
    });
    s.on('gq_answer_received', () => {
      // acknowledgement only
    });

    s.on('gq_answer_result', (p: { teamId: string; correct: boolean; pointsAwarded: number; submittedText: string }) => {
      console.log('Host received answer result:', p);
      setAnswerResults(prev => ({ ...prev, [p.teamId]: { correct: p.correct, pointsAwarded: p.pointsAwarded, submittedText: p.submittedText } }));
    });

    // Seed mock present students if no one joins (UI harness)
    setStudents(prev => (prev.length ? prev : getMockPresentStudents()));
    return () => {
      try {
        s.disconnect();
      } catch {}
    };
  }, []);

  useEffect(() => {
    teamsRef.current = teams.map(t => ({ teamId: t.teamId, memberIds: t.memberIds }));
  }, [teams]);

  // Cleanup timer on component unmount
  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, []);

  // Load task and build board
  useEffect(() => {
    const load = async () => {
      if (!taskId) return;
      try {
        const res = await fetch(`https://api.veritelligent.fun/api/gridquest/tasks/${taskId}`);
        if (res.ok) {
          const t = await res.json();
          const cats: string[] = (t.categories || []).map((c: any) => c.name);
          setCategories(cats);
          const newGrid: GQClue[][] = (t.categories || []).map((cat: any, cidx: number) => {
            return (cat.clues || []).map((cl: any, ridx: number) => ({ catIdx: cidx, clueIdx: ridx, label: String(cl.points || 0), taken: false }));
          });
          setGrid(newGrid);
          setTaskData(t);
          if (t.subjectId) {
            setSubjectIdState(String(t.subjectId));
            try {
              const er = await fetch(`https://api.veritelligent.fun/api/subjects/${t.subjectId}/enrolled`);
              if (er.ok) {
                const list = await er.json();
                const mapped = (list || []).map((e: any) => ({ id: String(e.studentId), name: e.name || 'Unknown', status: e.status }));
                setAllStudents(mapped);
              }
            } catch {}
          } else {
            // No subject context: use mock roster
            setAllStudents(mockAllStudents.map(s => ({ id: s.id, name: s.name })));
          }
        }
      } catch {}
    };
    load();
  }, [taskId]);

  const autoGroup = (groupCount: number) => {
    const unique = new Map<string, { id: string; name: string }>();
    students.forEach(s => unique.set(s.id, { id: s.id, name: s.name }));
    const present = Array.from(unique.values());
    const n = present.length;
    const p = Math.max(2, Math.min(groupCount, Math.max(1, n)));
    // Shuffle present students (Fisher–Yates)
    for (let i = present.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = present[i];
      present[i] = present[j];
      present[j] = tmp;
    }
    // Distribute in round-robin for balanced random teams
    const buckets: string[][] = Array.from({ length: p }, () => []);
    for (let i = 0; i < n; i++) {
      buckets[i % p].push(present[i].id);
    }
    const groups: Array<{ teamId: string; name: string; memberIds: string[] }> = buckets.map((ids, idx) => ({
      teamId: `T${idx + 1}`,
      name: `Team ${idx + 1}`,
      memberIds: ids,
    }));
    setTeams(groups);
    if (socketRef.current) socketRef.current.emit('gq_team_setup', { roomCode, teams: groups });
    // Initialize first representatives as first member of each team (if any)
    const initial: Record<string, string> = {};
    for (const t of groups) {
      if (t.memberIds[0]) initial[t.teamId] = t.memberIds[0];
    }
    setReps(initial);
    if (socketRef.current) socketRef.current.emit('gq_set_representatives', { roomCode, representatives: initial });
  };

  const startBoard = () => {
    setPhase('board');
    
    // Initialize analytics session (only on first start)
    if (isFirstRound && socketRef.current && taskId && subjectIdState) {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const offlinePlayerIds = offlinePlayers.map(p => p.id);
      
      socketRef.current.emit('gq_init_session', {
        roomCode,
        taskId,
        subjectId: subjectIdState,
        teacherId: user._id,
        offlinePlayerIds
      });
      console.log('📊 Initialized Grid Quest analytics session');
    }
    
    // On first board start, automatically set representatives as choosen students
    if (isFirstRound) {
      const initialChoosen = { ...reps };
      setChoosenStudents(initialChoosen);
      
      // Set choosen one for current team
      const currentTeamId = teams[currentTeamIdx]?.teamId;
      if (currentTeamId && initialChoosen[currentTeamId]) {
        setChoosenOne(initialChoosen[currentTeamId]);
      }
      
      // Notify students
      if (socketRef.current) {
        socketRef.current.emit('gq_choosen_selected', { 
          roomCode, 
          choosenStudents: initialChoosen, 
          choosenOne: initialChoosen[currentTeamId] 
        });
      }
      
      console.log('✅ First round: Auto-set representatives as choosen students', initialChoosen);
      console.log('📋 Current representatives (UNCHANGED by choosing):', reps);
    }
    
    // Notify students that board phase has started
    if (socketRef.current) {
      socketRef.current.emit('gq_board_started', { roomCode, categories, grid });
    }
  };
  const getQRCodeURL = () => `https://api.veritelligent.fun/student/grid-quest/${roomCode}`;

  const startClue = () => {
    setPhase('clue');
    // Clear any existing timer before starting a new one
    clearTimer();

    // Start countdown sequence: 3, 2, 1, Go!
    let countdownValue = 3;
    if (socketRef.current) {
      socketRef.current.emit('countdown_update', { roomCode, value: countdownValue });
    }

    const countdownInterval = setInterval(() => {
      countdownValue -= 1;
      console.log(`Host sending countdown: ${countdownValue}`);
      if (socketRef.current) {
        socketRef.current.emit('countdown_update', { roomCode, value: countdownValue });
      }

      if (countdownValue <= 0) {
        clearInterval(countdownInterval);
        console.log('Host countdown finished, starting timer');
      setCountdown(0);
      setTimeLeft(20);

        // Start the actual timer
      let t = 20;
      timerIntervalRef.current = setInterval(() => {
        t -= 1;
          console.log(`Host sending timer tick: ${t}`);
        setTimeLeft(t);
          if (socketRef.current) {
            socketRef.current.emit('timer_tick', { roomCode, timeLeft: t });
          }

          // Debug: Check if currentClue is still available during timer
          if (t === 10) {
            console.log('Host: Midway timer check - currentClueRef exists:', !!currentClueRef.current);
          }

        if (t <= 0) {
          clearTimer();
            console.log('Host timer ended, transitioning to reveal phase');
            setPhase('reveal');

            // Use setTimeout to ensure socket is ready and state is updated
            setTimeout(() => {
              const socket = socketRef.current;
              const clue = currentClueRef.current; // Get from ref
              console.log('Host: Checking socket and currentClue...');
              console.log('Host: socketRef.current exists:', !!socket);
              console.log('Host: currentClueRef exists:', !!clue);
              console.log('Host: currentClueRef value:', clue);

              if (!socket) {
                console.log('Host: socketRef.current is null/undefined - cannot send reveal phase');
                return;
              }

              console.log(`Host sending gq_reveal_phase to room: ${roomCode}`);
              socket.emit('gq_reveal_phase', { roomCode });

              if (clue) {
                console.log('Host Finalize Clue Debug:');
                console.log('Current Clue:', clue);
                console.log('Accepted Answers:', clue.acceptedAnswers || []);
                socket.emit('gq_finalize_clue', {
                  roomCode,
                  acceptedAnswers: clue.acceptedAnswers || [],
                  points: clue.points || 100,
                  allowNegative: true
                });
              } else {
                console.log('Host: currentClueRef is null/undefined, sending default finalize_clue payload');
                socket.emit('gq_finalize_clue', {
                  roomCode,
                  acceptedAnswers: [],
                  points: 100,
                  allowNegative: true
                });
              }
            }, 100);
        }
      }, 1000);
        }
      }, 1000);

    // Store the interval so we can clear it if needed
    countdownTimeoutRef.current = countdownInterval as any;
  };

  const reveal = () => {
    // Clear any running timer when manually revealing
    clearTimer();
    console.log('Host manual reveal triggered');
    setPhase('reveal');
    // Notify students to move to reveal phase
    const socket = socketRef.current;
    const clue = currentClueRef.current; // Get from ref
    if (!socket) {
      console.log('Host manual reveal: socketRef.current is null/undefined');
      return;
    }

    console.log('Host Manual Reveal Debug:');
    console.log('Current Clue from ref:', clue);
    console.log('Accepted Answers:', clue?.acceptedAnswers || []);

    console.log(`Host manual reveal sending gq_reveal_phase to room: ${roomCode}`);
    socket.emit('gq_reveal_phase', { roomCode });

    socket.emit('gq_finalize_clue', {
      roomCode,
      acceptedAnswers: clue?.acceptedAnswers || [],
      points: clue?.points || 100,
      allowNegative: true
    });
  };

  const next = () => {
    // Clear any running timer when moving to the next question
    clearTimer();
    setPhase('board');
    setAnswerResults({});
    setCurrentClue(null);
    currentClueRef.current = null; // Clear ref
    
    if (socketRef.current) {
      socketRef.current.emit('gq_next_turn', { roomCode });
    }
    
    // Rotate representatives (this happens in next() after each turn)
    if (teams.length) {
      const team = teams[currentTeamIdx];
      const memberIds = team.memberIds || [];
      if (memberIds.length > 1) {
        const current = reps[team.teamId] || memberIds[0];
        const idx = Math.max(0, memberIds.indexOf(current));
        const nextRep = memberIds[(idx + 1) % memberIds.length];
        const updated = { ...reps, [team.teamId]: nextRep };
        console.log(`🔄 Rotating representative for ${team.name}: ${idToName[current] || current} → ${idToName[nextRep] || nextRep}`);
        setReps(updated);
        if (socketRef.current) socketRef.current.emit('gq_set_representatives', { roomCode, representatives: updated });
      }
    }
    
    setCurrentTeamIdx((i) => (teams.length ? (i + 1) % teams.length : 0));
    
    // After first round ends, auto-show choose modal immediately
    if (isFirstRound) {
      console.log('First round ended. Auto-showing choose modal now.');
      setIsFirstRound(false);
      setShowChooseModal(true);
      setIsTileSelectionBlocked(true);
    } else {
      // For all subsequent rounds, auto-show choose modal and block tiles
      setShowChooseModal(true);
      setIsTileSelectionBlocked(true);
      console.log('Auto-showing choose modal. Tile selection blocked until choosing completes.');
    }
  };

  const end = () => {
    // Clear any running timer when ending the game
    clearTimer();
    setPhase('finished');
    if (socketRef.current) socketRef.current.emit('finish_game', { roomCode });
  };

  const chooseRandomStudents = () => {
    const newChoosen: Record<string, string> = {};
    const updatedPreviouslyChosen: Record<string, string[]> = { ...previouslyChosen };

    teams.forEach(team => {
      if (team.memberIds.length === 0) return;

      // Get list of previously chosen students for this team
      let prevChosen = updatedPreviouslyChosen[team.teamId] || [];

      // Check if all team members have been chosen (reset condition)
      const needsReset = prevChosen.length >= team.memberIds.length;
      if (needsReset) {
        console.log(`🔄 All students in ${team.name} have been chosen. Resetting rotation.`);
        prevChosen = [];
        updatedPreviouslyChosen[team.teamId] = [];
      }

      // Get students who haven't been chosen yet
      const notYetChosen = team.memberIds.filter(memberId => !prevChosen.includes(memberId));

      // Pick randomly from not-yet-chosen students (should always have options after reset check)
      const availablePool = notYetChosen.length > 0 ? notYetChosen : team.memberIds;
      const randomIndex = Math.floor(Math.random() * availablePool.length);
      const selectedStudent = availablePool[randomIndex];

      newChoosen[team.teamId] = selectedStudent;

      // Add to previously chosen list (ensure array exists first)
      if (!updatedPreviouslyChosen[team.teamId]) {
        updatedPreviouslyChosen[team.teamId] = [];
      }
      updatedPreviouslyChosen[team.teamId].push(selectedStudent);

      console.log(`${team.name}: Selected "${idToName[selectedStudent] || selectedStudent}". Previously chosen: ${updatedPreviouslyChosen[team.teamId].length}/${team.memberIds.length}`);
    });

    setPreviouslyChosen(updatedPreviouslyChosen);
    setChoosenStudents(newChoosen);
    return newChoosen;
  };

  const selectChoosenOne = (choosen: Record<string, string>) => {
    const currentTeamId = teams[currentTeamIdx]?.teamId;
    if (currentTeamId && choosen[currentTeamId]) {
      setChoosenOne(choosen[currentTeamId]);
    }
  };

  const handleChooseStudents = () => {
    setIsChoosing(true);

    console.log('📋 Before choosing - Representatives:', reps);

    setTimeout(() => {
      const choosen = chooseRandomStudents();
      selectChoosenOne(choosen);

      console.log('📋 After choosing - Representatives:', reps);
      console.log('✅ Chosen students:', choosen);

      if (socketRef.current) {
        socketRef.current.emit('gq_choosen_selected', { roomCode, choosenStudents: choosen, choosenOne: choosen[teams[currentTeamIdx]?.teamId] });
      }

      setIsChoosing(false);
      
      // Unblock tile selection after choosing completes
      setIsTileSelectionBlocked(false);
      console.log('Choosing complete. Tile selection unblocked.');
    }, 2000);
  };

  const resetChoosen = () => {
    setChoosenStudents({});
    setChoosenOne(null);
  };

  // Offline player functions
  const generateOfflineId = () => {
    return `OFFLINE_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  };

  const handleAddOfflinePlayer = () => {
    const trimmedName = newPlayerName.trim();
    
    if (!trimmedName) {
      setNewPlayerNameError('Please enter a name');
      return;
    }

    // Check for duplicate names
    const isDuplicate = [...students, ...offlinePlayers].some(
      s => s.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (isDuplicate) {
      setNewPlayerNameError('A player with this name already exists');
      return;
    }

    // Add offline player
    const newOfflinePlayer = {
      id: generateOfflineId(),
      name: trimmedName
    };

    setOfflinePlayers(prev => [...prev, newOfflinePlayer]);
    
    // Add to students list
    setStudents(prev => [...prev, { ...newOfflinePlayer, isReady: true }]);
    
    // Close modal and reset
    setShowAddPlayerModal(false);
    setNewPlayerName('');
    setNewPlayerNameError('');
  };

  const handleRemoveOfflinePlayer = (playerId: string) => {
    // Remove from offline players
    setOfflinePlayers(prev => prev.filter(p => p.id !== playerId));
    
    // Remove from students list
    setStudents(prev => prev.filter(s => s.id !== playerId));
    
    // Remove from teams if assigned
    setTeams(prev => prev.map(team => ({
      ...team,
      memberIds: team.memberIds.filter(id => id !== playerId)
    })));
  };

  // Manual score adjustment
  const adjustScore = (teamId: string, delta: number) => {
    if (delta === 0) return;
    
    // Optimistically update the UI
    setScores(prev => ({
      ...prev,
      [teamId]: (prev[teamId] || 0) + delta
    }));
    
    // Send to server
    if (socketRef.current) {
      socketRef.current.emit('gq_award_points', {
        roomCode,
        teamId,
        delta
      });
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const currentTeam = useMemo(() => teams[currentTeamIdx]?.name || '-', [teams, currentTeamIdx]);
  const idToName = useMemo(() => {
    const map: Record<string, string> = {};
    allStudents.forEach(s => { if (s?.id) map[s.id] = s.name; });
    students.forEach(s => { if (s?.id) map[s.id] = s.name; });
    return map;
  }, [allStudents, students]);
  const studentTeamTag = useMemo(() => {
    const map: Record<string, string> = {};
    teams.forEach((t, idx) => {
      (t.memberIds || []).forEach(mid => { map[mid] = `T${idx + 1}`; });
    });
    return map;
  }, [teams]);

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
      // Fix representatives
      setReps(old => {
        const updated: Record<string, string> = { ...old };
        for (const t of next) {
          if (!t.memberIds.includes(updated[t.teamId] || '')) {
            if (t.memberIds.length > 0) updated[t.teamId] = t.memberIds[0]; else delete updated[t.teamId];
          }
        }
        const target = next[tidx];
        if (target && (!updated[target.teamId] || !target.memberIds.includes(updated[target.teamId]))) {
          if (target.memberIds.length > 0) updated[target.teamId] = target.memberIds[0];
        }
        if (socketRef.current) socketRef.current.emit('gq_set_representatives', { roomCode, representatives: updated });
        return updated;
      });
      if (socketRef.current) socketRef.current.emit('gq_team_setup', { roomCode, teams: next });
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
      // Adjust reps for any team that lost this student
      setReps(old => {
        const updated: Record<string, string> = { ...old };
        for (const t of next) {
          if (!t.memberIds.includes(updated[t.teamId] || '')) {
            if (t.memberIds.length > 0) updated[t.teamId] = t.memberIds[0]; else delete updated[t.teamId];
          }
        }
        if (socketRef.current) socketRef.current.emit('gq_set_representatives', { roomCode, representatives: updated });
        return updated;
      });
      if (socketRef.current) socketRef.current.emit('gq_team_setup', { roomCode, teams: next });
      return next;
    });
  };

  return (
    <div className="host-grid-quest">
      <div className="hgq-hero">
        
        <div className="hgq-title">
          <button className="hgq-back-btn" onClick={() => navigate('/teacher/party-games')}>
            <i className="fas fa-arrow-left"></i>
          </button>
          <h1 className="hgq-title-text">Grid Quest</h1>
        </div>
        <div className='hgq-phase'>{phase}</div>
        <div className="hgq-chips">
          <span className="hgq-chip room" title="Room Code"><i className="fas fa-hashtag"></i> {roomCode}</span>
          <span className="hgq-chip present" title="Present"><i className="fas fa-users"></i> {students.length} Present</span>
          {teams.length > 0 && (
            <span className="hgq-chip next" title="Next Team"><i className="fas fa-flag"></i> Next: {currentTeam}</span>
          )}
        </div>
      </div>

      {phase === 'lobby' && (
        <div className="hgq-lobby">
          <div className="hgq-lobby-layout">
            <div className="hgq-panel hgq-present">
              <div className="hgq-teams-head">
                <h3 className="hgq-section-title"><i className="fas fa-user-check"></i> Present / Active</h3>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span className="hgq-count-badge">{students.length}</span>
                  <button 
                    className="hgq-btn outline" 
                    onClick={() => setShowAddPlayerModal(true)}
                    title="Add Offline Player"
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                  >
                    <i className="fas fa-user-plus"></i>
                  </button>
                </div>
              </div>
              <div
                className="hgq-list"
                onDragOver={(e) => { e.preventDefault(); setDropOverPresent(true); }}
                onDragLeave={() => setDropOverPresent(false)}
                onDrop={handleDropOnPresent}
              >
                {students.map(s => {
                  const isOffline = offlinePlayers.some(op => op.id === s.id);
                  return (
                  <div
                    key={s.id}
                    className={`hgq-list-item present`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, s.id)}
                      style={{ position: 'relative' }}
                  >
                    {studentTeamTag[s.id] && <span className="team-tag">{studentTeamTag[s.id]}</span>}
                    <div className="hgq-li-name">{s.name}</div>
                      <div className={`hgq-li-badge ${isOffline ? '' : 'present'}`}>
                        {isOffline ? 'Offline' : (s.isReady ? 'Ready' : 'Joining')}
                  </div>
                      {isOffline && (
                        <button
                          onClick={() => handleRemoveOfflinePlayer(s.id)}
                          style={{
                            position: 'absolute',
                            right: '0.5rem',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: '#dc2626',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '0.25rem 0.5rem',
                            cursor: 'pointer',
                            fontSize: '0.75rem'
                          }}
                          title="Remove offline player"
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      )}
                    </div>
                  );
                })}
                {students.length === 0 && (
                  <div className="hgq-empty">Waiting for students to join…</div>
                )}
              </div>
            </div>

            <div className="hgq-panel hgq-allplayers">
              <div className="hgq-teams-head">
                <h3 className="hgq-section-title"><i className="fas fa-users"></i> All Students</h3>
                <span className="hgq-count-badge">{allStudents.length}</span>
              </div>
              <div className="hgq-list">
                {allStudents.map(s => {
                  const presentSet = new Set((students || []).map(x => x.id));
                  const isPresent = presentSet.has(s.id);
                  return (
                    <div key={s.id} className={`hgq-list-item ${isPresent ? 'present' : 'absent'}`}>
                      <div className="hgq-li-name">{s.name}</div>
                      <div className={`hgq-li-badge ${isPresent ? 'present' : ''}`}>{isPresent ? 'Present' : 'Not Joined'}</div>
                    </div>
                  );
                })}
                {allStudents.length === 0 && (
                  <div className="hgq-empty">No enrolled students found for this subject.</div>
                )}
              </div>
          </div>

          <aside className="hgq-panel hgq-teams">
            <div className="hgq-teams-head">
              <h3 className="hgq-section-title"><i className="fas fa-layer-group"></i> Teams</h3>
              <span className="hgq-count-badge">{teams.length}</span>
            </div>
            <div className="teams">
              {teams.map(t => (
                <div
                  key={t.teamId}
                  className={`team-card${dropOverTeamId === t.teamId ? ' drop' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setDropOverTeamId(t.teamId); }}
                  onDragLeave={() => setDropOverTeamId(null)}
                  onDrop={(e) => handleDropOnTeam(e, t.teamId)}
                >
                  <div className="name">{t.name}</div>
                  <div className="count">{t.memberIds.length} member{t.memberIds.length === 1 ? '' : 's'}</div>
                  <div className="team-members">
                    {t.memberIds.length === 0 && (
                      <div className="hgq-empty">No members yet</div>
                    )}
                    {t.memberIds.map((mid) => {
                      const name = idToName[mid] || mid;
                      const isRep = reps[t.teamId] === mid;
                      return (
                        <div
                          className={`team-member${isRep ? ' rep' : ''}`}
                          key={mid}
                          draggable
                          onDragStart={(e) => handleDragStart(e, mid)}
                        >
                          <div className="tm-avatar">{(name || '?').charAt(0).toUpperCase()}</div>
                          <div className="tm-name">{name}</div>
                          {isRep && <span className="rep-badge">Rep</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </aside>
          
          <div className="hgq-panel hgq-wait">
            <h3 className="hgq-section-title"><i className="fas fa-hourglass-half"></i> Waiting for Students</h3>
            <div className="hgq-actions hgq-auto-group" style={{ alignItems: 'center', gap: '.5rem' }}>
              <label style={{ fontWeight: 700, color: '#7c2d12' }}>Auto Group:</label>
              <select
                value={groupCount}
                onChange={(e) => setGroupCount(Math.max(2, Math.min(8, Number(e.target.value))))}
                className="hgq-select"
              >
                {[2,3,4,5,6,7,8].map(n => (<option key={n} value={n}>{n} groups</option>))}
              </select>
              <button className="hgq-btn blue" onClick={() => autoGroup(groupCount)}>
                Apply
              </button>
            </div>
            <div className="hgq-actions hgq-start" style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
              <button className="hgq-btn outline" onClick={() => setShowQRCode(true)}><i className="fas fa-qrcode"></i> Show QR Code</button>
              <button className="hgq-btn primary" disabled={!teams.length} onClick={startBoard}><i className="fas fa-play"></i> Start Board</button>
            </div>
          </div>
        </div>
      </div>
      )}

      {phase === 'board' && (
        <>
          {isTileSelectionBlocked && (
            <div style={{
              background: '#fef3c7',
              border: '1px solid #f59e0b',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: '#92400e'
            }}>
              <i className="fas fa-info-circle"></i>
              <span style={{ fontWeight: '600' }}>Please choose students before selecting a tile.</span>
            </div>
          )}
          <div className="hgq-board">
            <GridQuestBoard
              categories={categories}
              grid={grid}
              onSelect={(catIdx, clueIdx) => {
                // Block tile selection if choosing is required
                if (isTileSelectionBlocked) {
                  console.log('Tile selection blocked. Please choose students first.');
                  return;
                }
                
                // mark taken and broadcast selection + reveal meta
                setGrid(prev => {
                  const next = prev.map(col => col.map(cell => ({ ...cell })));
                  next[catIdx][clueIdx].taken = true;
                  return next;
                });
                // store current clue details
                const clueMeta = taskData?.categories?.[catIdx]?.clues?.[clueIdx] || {};
                const nextClue = { catIdx, clueIdx, prompt: clueMeta.prompt || '', points: clueMeta.points, timeLimitSec: clueMeta.timeLimitSec, acceptedAnswers: clueMeta.acceptedAnswers || [] };
                setCurrentClue(nextClue);
                currentClueRef.current = nextClue; // Store in ref for timer access
                setTeamAnswers({});
                setAnswerResults({});
                if (socketRef.current) {
                  socketRef.current.emit('gq_select_clue', { roomCode, catIdx, clueIdx });
                  const points = Number(grid[catIdx]?.[clueIdx]?.label) || Number(clueMeta.points) || 100;
                  socketRef.current.emit('gq_clue_reveal', {
                    roomCode,
                    payload: {
                      catIdx,
                      clueIdx,
                      categoryName: categories[catIdx] || `Category ${catIdx + 1}`,
                      points,
                      prompt: clueMeta.prompt || '',
                      acceptedAnswers: clueMeta.acceptedAnswers || []
                    }
                  });
                }
                startClue();
              }}
            />
          </div>
          <div className="hgq-board-footer">
            <div className="hgq-board-actions">
              <button className="hgq-btn primary" onClick={() => setShowChooseModal(true)}>
                <i className="fas fa-users"></i> Choose
              </button>
              <button className="hgq-btn stop" onClick={end}><i className="fas fa-stop"></i> End</button>
            </div>
            <div className="hgq-scoreboard">
              {teams.map(t => {
                const choosenStudentId = choosenStudents[t.teamId];
                const choosenStudentName = choosenStudentId ? (idToName[choosenStudentId] || choosenStudentId) : null;
                return (
                  <div key={t.teamId} className="hgq-score-card">
                    {choosenStudentName && (
                      <div style={{ 
                        fontSize: '0.75rem', 
                        color: 'var(--gq-primary)', 
                        fontWeight: '600',
                        marginBottom: '0.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}>
                        <i className="fas fa-user-check" style={{ fontSize: '0.7rem' }}></i>
                        {choosenStudentName}
                      </div>
                    )}
                    <div className="hgq-score-team">{t.name}</div>
                    <div className="hgq-score-value">{Number.isFinite(scores[t.teamId] as any) ? (scores[t.teamId] || 0) : 0}</div>
                  </div>
                );
              })}
              {teams.length === 0 && (
                <div className="hgq-empty">No teams yet</div>
              )}
            </div>
          </div>
        </>
      )}

      {/* QR Code Modal */}
      {showQRCode && (
        <div className="hgq-modal-overlay" onClick={() => setShowQRCode(false)}>
          <div className="hgq-qr-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="hgq-modal-header">
              <h3>Join Grid Quest</h3>
              <button className="hgq-modal-close" onClick={() => setShowQRCode(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="hgq-qr-body">
              <p><center>Room Code: <strong>{roomCode}</strong></center></p>
              <div className="hgq-qr-container" style={{ display: 'flex', justifyContent: 'center' }}>
                <QRCode value={getQRCodeURL()} size={200} />
              </div>
            </div>
          </div>
        </div>
      )}

      {phase === 'clue' && (
        <>
          <div className="hgq-clue">
            <div className="hgq-clue-header">
              {countdown > 0 ? (
                <div className="hgq-loading-bar" aria-label={`Starting in ${countdown}`} title={`Starting in ${countdown}`}></div>
              ) : (
                (() => {
                  const total = Math.max(1, Number(currentClue?.timeLimitSec || 20));
                  const pct = Math.max(0, Math.min(100, Math.round((timeLeft / total) * 100)));
                  return (
                    <div className="hgq-progress" aria-label={`Time left ${timeLeft}s`} title={`Time left ${timeLeft}s`}>
                      <div className="hgq-progress-bar" style={{ width: `${pct}%` }} />
                    </div>
                  );
                })()
              )}
            </div>
            <div className="hgq-clue-content">
              <div className="hgq-clue-text">
                {currentClue?.prompt || 'Clue prompt goes here'}
              </div>
            </div>
          </div>
          <div className="hgq-board-footer">
            <div className="hgq-board-actions">
              <button className="hgq-btn stop" onClick={end}><i className="fas fa-stop"></i> End</button>
              <button className="hgq-btn reveal" onClick={reveal}><i className="fas fa-eye"></i> Reveal</button>
            </div>
            <div className="hgq-scoreboard">
              {teams.map(t => {
                const choosenStudentId = choosenStudents[t.teamId];
                const choosenStudentName = choosenStudentId ? (idToName[choosenStudentId] || choosenStudentId) : null;
                return (
                  <div key={t.teamId} className="hgq-score-card">
                    {choosenStudentName && (
                      <div style={{ 
                        fontSize: '0.75rem', 
                        color: 'var(--gq-primary)', 
                        fontWeight: '600',
                        marginBottom: '0.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}>
                        <i className="fas fa-user-check" style={{ fontSize: '0.7rem' }}></i>
                        {choosenStudentName}
                      </div>
                    )}
                    <div className="hgq-score-team">{t.name}</div>
                    <div className="hgq-score-value">{Number.isFinite(scores[t.teamId] as any) ? (scores[t.teamId] || 0) : 0}</div>
                  </div>
                );
              })}
              {teams.length === 0 && (
                <div className="hgq-empty">No teams yet</div>
              )}
            </div>
          </div>
        </>
      )}

      {phase === 'reveal' && (
        <>
          <div className="hgq-reveal">
            <div className="hgq-reveal-answers">
              <div className="hgq-true-answers">
                <div className="hgq-true-label">Correct Answer{(currentClue?.acceptedAnswers || []).length > 1 ? 's' : ''}:</div>
                <div className="hgq-true-text">{(currentClue?.acceptedAnswers || []).join(', ') || '—'}</div>
              </div>
              <div className="hgq-team-answers">
                {teams.map((t) => {
                  const ans = teamAnswers[t.teamId] || '';
                  const result = answerResults[t.teamId];
                  const isCorrect = result ? result.correct : false;
                  const pointsAwarded = result ? result.pointsAwarded : 0;
                  const displayText = result ? result.submittedText : ans;
                  return (
                    <div key={t.teamId} className={`hgq-team-answer ${isCorrect ? 'correct' : 'wrong'}`}>
                      <div className="team-name">{t.name}</div>
                      <div className="team-answer-text">{displayText || '—'}</div>
                      <div className={`badge ${isCorrect ? 'ok' : 'no'}`}>
                        {isCorrect ? 'Correct' : 'Wrong'} {pointsAwarded !== 0 && `(${pointsAwarded > 0 ? '+' : ''}${pointsAwarded})`}
                      </div>
                    </div>
                  );
                })}
                {teams.length === 0 && (
                  <div className="hgq-empty">No teams yet</div>
                )}
              </div>
            </div>
          </div>
          <div className="hgq-board-footer">
            <div className="hgq-board-actions">
              <button className="hgq-btn stop" onClick={end}><i className="fas fa-stop"></i> End</button>
              <button className="hgq-btn reveal" onClick={next}><i className="fas fa-forward"></i> Next</button>
            </div>
            <div className="hgq-scoreboard">
              {teams.map(t => {
                const cluePoints = Number(currentClue?.points) || 100;
                const choosenStudentId = choosenStudents[t.teamId];
                const choosenStudentName = choosenStudentId ? (idToName[choosenStudentId] || choosenStudentId) : null;
                return (
                <div key={t.teamId} className="hgq-score-card">
                  {choosenStudentName && (
                    <div style={{ 
                      fontSize: '0.75rem', 
                      color: 'var(--gq-primary)', 
                      fontWeight: '600',
                      marginBottom: '0.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}>
                      <i className="fas fa-user-check" style={{ fontSize: '0.7rem' }}></i>
                      {choosenStudentName}
                    </div>
                  )}
                  <div className="hgq-score-team">{t.name}</div>
                  <div className="hgq-score-value">{Number.isFinite(scores[t.teamId] as any) ? (scores[t.teamId] || 0) : 0}</div>
                    <div style={{ 
                      display: 'flex', 
                      gap: '0.25rem', 
                      marginTop: '0.5rem',
                      justifyContent: 'center'
                    }}>
                      <button
                        onClick={() => adjustScore(t.teamId, -cluePoints)}
                        style={{
                          background: 'var(--gq-accent)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          width: '32px',
                          height: '32px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1rem',
                          transition: 'all 0.2s ease'
                        }}
                        title={`Subtract ${cluePoints} points`}
                      >
                        <i className="fas fa-minus"></i>
                      </button>
                      <button
                        onClick={() => adjustScore(t.teamId, cluePoints)}
                        style={{
                          background: 'var(--gq-primary)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          width: '32px',
                          height: '32px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1rem',
                          transition: 'all 0.2s ease'
                        }}
                        title={`Add ${cluePoints} points`}
                      >
                        <i className="fas fa-plus"></i>
                      </button>
                </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {phase === 'finished' && (
        <div className="hgq-finished">
          <div className="hgq-finish-header">
            <div className="finish-icon">
              <i className="fas fa-trophy"></i>
        </div>
            <h1 className="finish-title">Game Complete!</h1>
            <p className="finish-subtitle">Here are your top performers</p>
          </div>

          <div className="hgq-podium-container">
            {(() => {
              // Calculate rankings
              const rankedTeams = [...teams]
                .map(team => ({
                  ...team,
                  score: scores[team.teamId] || 0
                }))
                .sort((a, b) => b.score - a.score);

              const top3 = rankedTeams.slice(0, 3);
              const [first, second, third] = top3;

              // Podium order: 2nd, 1st, 3rd (visual arrangement)
              const podiumOrder = [second, first, third].filter(Boolean);

              return (
                <>
                  <div className="hgq-podium">
                    {podiumOrder.map((team, idx) => {
                      const position = team === first ? 1 : team === second ? 2 : 3;
                      const heights = { 1: '180px', 2: '140px', 3: '100px' };
                      const colors = { 
                        1: 'linear-gradient(135deg, #ffd700 0%, #ffed4e 100%)', 
                        2: 'linear-gradient(135deg, #c0c0c0 0%, #e8e8e8 100%)', 
                        3: 'linear-gradient(135deg, #cd7f32 0%, #e6a057 100%)' 
                      };
                      const icons = { 1: 'crown', 2: 'medal', 3: 'award' };
                      const labels = { 1: '1st Place', 2: '2nd Place', 3: '3rd Place' };

                      return (
                        <div key={team.teamId} className={`podium-item position-${position}`}>
                          <div className="podium-content">
                            <div 
                              className="podium-icon"
                              style={{ 
                                background: colors[position as keyof typeof colors],
                                boxShadow: position === 1 ? '0 8px 20px rgba(255, 215, 0, 0.4)' : '0 4px 12px rgba(0,0,0,0.15)'
                              }}
                            >
                              <i className={`fas fa-${icons[position as keyof typeof icons]}`}></i>
                            </div>
                            <div className="podium-rank">{labels[position as keyof typeof labels]}</div>
                            <div className="podium-team-name">{team.name}</div>
                            <div className="podium-score">{team.score} pts</div>
                            <div className="podium-members">
                              {team.memberIds.slice(0, 3).map(memberId => {
                                const memberName = idToName[memberId] || memberId;
                                return (
                                  <div key={memberId} className="podium-member-avatar" title={memberName}>
                                    {getInitials(memberName)}
                                  </div>
                                );
                              })}
                              {team.memberIds.length > 3 && (
                                <div className="podium-member-more">+{team.memberIds.length - 3}</div>
                              )}
                            </div>
                          </div>
                          <div 
                            className="podium-stand" 
                            style={{ 
                              height: heights[position as keyof typeof heights],
                              background: colors[position as keyof typeof colors]
                            }}
                          >
                            <div className="podium-position-number">{position}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {rankedTeams.length > 3 && (
                    <div className="hgq-other-teams">
                      <h3 className="other-teams-title">Other Teams</h3>
                      <div className="other-teams-list">
                        {rankedTeams.slice(3).map((team, idx) => (
                          <div key={team.teamId} className="other-team-item">
                            <div className="other-team-rank">{idx + 4}</div>
                            <div className="other-team-info">
                              <div className="other-team-name">{team.name}</div>
                              <div className="other-team-members">{team.memberIds.length} members</div>
                            </div>
                            <div className="other-team-score">{team.score} pts</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          <div className="hgq-finish-actions">
            <button className="hgq-btn primary" onClick={() => window.location.reload()}>
              <i className="fas fa-play"></i> New Game
            </button>
            <button className="hgq-btn outline" onClick={() => setPhase('lobby')}>
              <i className="fas fa-home"></i> Back to Lobby
            </button>
          </div>
        </div>
      )}

      {/* Choose Modal */}
      {showChooseModal && (
        <div className="hgq-modal-overlay" onClick={() => {
          // Don't allow closing if tile selection is blocked (must choose first)
          if (!isTileSelectionBlocked) {
            setShowChooseModal(false);
          }
        }}>
          <div className="hgq-modal-content choose-modal" onClick={(e) => e.stopPropagation()}>
            <div className="hgq-modal-header">
              <h3><i className="fas fa-users"></i> Select Choosen Students</h3>
              <button 
                className="hgq-modal-close" 
                onClick={() => {
                  // Don't allow closing if tile selection is blocked (must choose first)
                  if (!isTileSelectionBlocked) {
                    setShowChooseModal(false);
                  }
                }}
                disabled={isTileSelectionBlocked}
                style={{ opacity: isTileSelectionBlocked ? 0.5 : 1, cursor: isTileSelectionBlocked ? 'not-allowed' : 'pointer' }}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="hgq-modal-body">
              {isChoosing ? (
                <div className="choosing-suspense">
                  <div className="suspense-content">
                    <div className="suspense-animation">
                      <div className="spinning-wheel">
                        <i className="fas fa-spinner"></i>
                      </div>
                      <div className="pulse-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                    <h3 className="suspense-title">Choosing Students...</h3>
                    <p className="suspense-subtitle">Randomly selecting the choosen ones</p>
                    <div className="team-names">
                      {teams.map(team => (
                        <span key={team.teamId} className="team-name-flash">{team.name}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="choose-info">
                    <div className="info-section">
                      <h4><i className="fas fa-info-circle"></i> Selection Complete!</h4>
                      <ul>
                        <li><strong>Choosers:</strong> {currentTeam} (current team)</li>
                        <li><strong>Choosen:</strong> One randomly selected student from each team</li>
                        <li><strong>Choosen One:</strong> The choosen from {currentTeam} who selects the tile</li>
                      </ul>
                    </div>
                  </div>

                  <div className="teams-selection">
                    {teams.map(team => (
                      <div key={team.teamId} className={`team-selection-card ${team.teamId === teams[currentTeamIdx]?.teamId ? 'current-team' : ''} ${Object.keys(choosenStudents).length > 0 ? 'revealed' : ''}`}>
                        <div className="team-header">
                          <h4>{team.name}</h4>
                          {team.teamId === teams[currentTeamIdx]?.teamId && (
                            <span className="current-indicator"><i className="fas fa-star"></i> Choosers</span>
                          )}
                          <span className="member-count">{team.memberIds.length} members</span>
                        </div>

                        <div className="team-members-list">
                          {team.memberIds.map(memberId => {
                            const memberName = idToName[memberId] || memberId;
                            const isRep = reps[team.teamId] === memberId;
                            const isChoosen = choosenStudents[team.teamId] === memberId;
                            const isChoosenOne = choosenOne === memberId;

                            return (
                              <div key={memberId} className={`member-item ${isChoosen ? 'choosen' : ''} ${isChoosenOne ? 'choosen-one' : ''} ${Object.keys(choosenStudents).length > 0 ? 'revealed' : ''}`}>
                                <div className="member-info">
                                  <div className="member-avatar">
                                    {getInitials(memberName)}
                                  </div>
                                  <div className="member-details">
                                    <span className="member-name">{memberName}</span>
                                    {isRep && <span className="member-role">Rep</span>}
                                  </div>
                                </div>
                                <div className="member-status">
                                  {isChoosenOne && <span className="status choosen-one"><i className="fas fa-crown"></i></span>}
                                  {isChoosen && !isChoosenOne && <span className="status choosen"><i className="fas fa-check"></i></span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="hgq-modal-actions">
              <button className="hgq-btn outline" onClick={resetChoosen} disabled={isChoosing}>
                <i className="fas fa-undo"></i> Reset
              </button>
              <button className="hgq-btn primary" onClick={handleChooseStudents} disabled={isChoosing}>
                {isChoosing ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i> Choosing...
                  </>
                ) : (
                  <>
                    <i className="fas fa-random"></i> Random Choose
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Offline Player Modal */}
      {showAddPlayerModal && (
        <div className="hgq-modal-overlay" onClick={() => setShowAddPlayerModal(false)}>
          <div className="hgq-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="hgq-modal-header">
              <h3><i className="fas fa-user-plus"></i> Add Offline Player</h3>
              <button className="hgq-modal-close" onClick={() => setShowAddPlayerModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="hgq-modal-body">
              <p style={{ marginBottom: '1rem', color: '#64748b', fontSize: '0.9rem' }}>
                Add a player who doesn't have a device to join the game online.
              </p>
              
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: 'var(--gq-ink)' }}>
                  Player Name:
                </label>
                <input
                  type="text"
                  value={newPlayerName}
                  onChange={(e) => {
                    setNewPlayerName(e.target.value);
                    setNewPlayerNameError('');
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleAddOfflinePlayer();
                    }
                  }}
                  placeholder="Enter player name"
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: newPlayerNameError ? '1px solid #dc2626' : '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '1rem'
                  }}
                  autoFocus
                />
                {newPlayerNameError && (
                  <p style={{ color: '#dc2626', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                    {newPlayerNameError}
                  </p>
                )}
              </div>

              {offlinePlayers.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: 'var(--gq-ink)' }}>
                    Current Offline Players:
                  </label>
                  <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                    {offlinePlayers.map(player => (
                      <div
                        key={player.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.5rem',
                          background: 'var(--gq-soft)',
                          border: '1px solid var(--gq-primary)',
                          borderRadius: '6px',
                          marginBottom: '0.5rem'
                        }}
                      >
                        <span style={{ fontWeight: '500' }}>{player.name}</span>
                        <button
                          onClick={() => handleRemoveOfflinePlayer(player.id)}
                          style={{
                            background: '#dc2626',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '0.25rem 0.5rem',
                            cursor: 'pointer',
                            fontSize: '0.75rem'
                          }}
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="hgq-modal-actions">
              <button className="hgq-btn outline" onClick={() => setShowAddPlayerModal(false)}>
                Cancel
              </button>
              <button className="hgq-btn primary" onClick={handleAddOfflinePlayer}>
                <i className="fas fa-plus"></i> Add Player
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HostGridQuest;
