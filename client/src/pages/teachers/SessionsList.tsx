import React, { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../../styles/results_leaderboard.css';
import { useDocumentTitle } from '../../utils/useDocumentTitle';
import type { GameSession, TaskSummary, SubjectRef } from '../../types/game';

const getSessionIdentifier = (session: any): string => {
  if (!session) return '';
  const raw = session._id ?? session.id;
  if (!raw) return '';
  return typeof raw === 'string' ? raw : raw.toString();
};

interface SessionRow extends GameSession {
  taskTitle: string;
  subjectLabel: string;
  startedLabel: string;
  endedLabel: string;
}

const SessionsList: React.FC = () => {
  const [subjectId, setSubjectId] = useState<string>('all');
  useDocumentTitle('Teacher Sessions | Veritelligent');
  const [status, setStatus] = useState<string>('all');
  const [gameTypeFilter, setGameTypeFilter] = useState<string>('all');
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [subjects, setSubjects] = useState<SubjectRef[]>([]);
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [textSearch, setTextSearch] = useState<string>('');
  const navigate = useNavigate();
  const taskTitleFromQuery = useMemo(() => new URLSearchParams(window.location.search).get('taskTitle') || '', []);

  // Fetch subjects
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        setError('');
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const response = await fetch(`http://localhost:5000/api/subjects?teacherId=${user._id}`);
        if (!response.ok) throw new Error('Failed to fetch subjects');
        const data = await response.json();
        
        // Normalize the data structure - handle both _id and id fields
        const normalizedSubjects = data.map((subject: any) => ({
          id: subject._id || subject.id, // Use _id if available, fallback to id
          code: subject.subjectCode || subject.code || 'Unknown', // Use subjectCode if available, fallback to code
          name: subject.subjectName || subject.name || 'Unknown Subject' // Use subjectName if available, fallback to name
        }));
        
        // Validate and filter out subjects with missing required fields
        const validSubjects = normalizedSubjects.filter((subject: any) => subject && subject.id && subject.code && subject.name);
        console.log('Raw subjects from API:', data);
        console.log('Normalized subjects:', normalizedSubjects);
        console.log('Valid subjects:', validSubjects);
        
        setSubjects(validSubjects);
      } catch (err) {
        console.error('Failed to fetch subjects:', err);
        setError('Failed to load subjects');
      }
    };

    fetchSubjects();
  }, []); // Empty dependency array - only run once on mount

  // Fetch tasks (quizzes, grid quest, flashcard)
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        setError('');
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        console.log('Fetching tasks for user:', user._id);
        
        let allTasks: any[] = [];
        
        // Fetch Quiz tasks
        try {
          console.log('Fetching quiz tasks...');
          const response = await fetch('http://localhost:5000/api/quiz');
          if (response.ok) {
            const quizData = await response.json();
            console.log('Quiz tasks:', quizData.length);
            allTasks = [...allTasks, ...quizData];
          }
        } catch (err) {
          console.log('Failed to fetch quiz tasks:', err);
        }
        
        // Fetch Grid Quest tasks
        try {
          console.log('Fetching Grid Quest tasks...');
          const response = await fetch(`http://localhost:5000/api/gridquest/tasks?teacherId=${user._id}`);
          if (response.ok) {
            const gridQuestData = await response.json();
            console.log('Grid Quest tasks:', gridQuestData.length);
            allTasks = [...allTasks, ...gridQuestData];
          }
        } catch (err) {
          console.log('Failed to fetch Grid Quest tasks:', err);
        }
        
        // Fetch Flashcard tasks
        try {
          console.log('Fetching Flashcard tasks...');
          const response = await fetch(`http://localhost:5000/api/flashcard/tasks?teacherId=${user._id}`);
          if (response.ok) {
            const flashcardData = await response.json();
            console.log('Flashcard tasks:', flashcardData.length);
            allTasks = [...allTasks, ...flashcardData];
          }
        } catch (err) {
          console.log('Failed to fetch Flashcard tasks:', err);
        }
        
        // Fetch Buzzer Battle tasks
        try {
          console.log('Fetching Buzzer Battle tasks...');
          const response = await fetch(`http://localhost:5000/api/buzzerbattle/tasks?teacherId=${user._id}`);
          if (response.ok) {
            const buzzerBattleData = await response.json();
            console.log('Buzzer Battle tasks:', buzzerBattleData.length);
            allTasks = [...allTasks, ...buzzerBattleData];
          }
        } catch (err) {
          console.log('Failed to fetch Buzzer Battle tasks:', err);
        }
        
        if (allTasks.length === 0) {
          console.log('No tasks found from any endpoint');
          setTasks([]);
          return;
        }
        
        // Normalize the data structure - handle different field names
        const normalizedTasks = allTasks.map((task: any) => ({
          id: task._id || task.id, // Use _id if available, fallback to id
          title: task.title || task.taskTopic || task.taskName || task.name || 'Untitled Task', // Multiple fallbacks for title
          taskTopic: task.title || task.taskTopic || 'Untitled',
          description: task.description || '',
          subjectId: task.subjectId || task.subject || 'Unknown',
          totalPoints: task.totalPoints || 0,
          isGameMode: task.isGameMode !== undefined ? task.isGameMode : true,
          status: task.status || 'active',
          dueDate: task.dueDate,
          gameSettings: task.gameSettings || {}
        } as TaskSummary)).filter((task: any) => task && task.id && task.title); // Filter out invalid tasks
        
        console.log('Total normalized tasks:', normalizedTasks.length);
        console.log('Task IDs:', normalizedTasks.map((t: any) => t.id));
        console.log('Task titles:', normalizedTasks.map((t: any) => t.title));
        
        setTasks(normalizedTasks);
        
      } catch (err: any) {
        console.error('Failed to fetch tasks:', err);
        setError(err.message || 'Failed to fetch tasks');
        
        // Auto-retry after 5 seconds for connection errors
        if (err.message.includes('Database service unavailable') || err.message.includes('Failed to fetch')) {
          setTimeout(() => {
            console.log('Retrying task fetch...');
            fetchTasks();
          }, 5000);
        }
      }
    };

    fetchTasks();
  }, []);

  // Fetch sessions (extracted so we can trigger via Reload button)
  const fetchSessions = async () => {
      try {
        setLoading(true);
        setError('');
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        console.log('Fetching sessions for user:', user._id);
        
        const response = await fetch(`http://localhost:5000/api/analytics/sessions?teacherId=${user._id}`);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          if (response.status === 503) {
            throw new Error('Database service unavailable. Please try again in a few moments.');
          }
          throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Raw sessions data:', data);
        
        // Validate and filter out sessions with missing required fields
        const validSessions = data.filter((session: any) => 
          session && (session._id || session.id) && session.taskId && session.subjectId
        );
        
        console.log('Valid sessions:', validSessions.length);
        // Normalize _id -> id to align with UI types
        const normalizedSessions = validSessions.map((s: any) => ({
          ...s,
          id: s._id || s.id,
          // Handle populated data from analytics endpoint
          taskId: s.taskId._id || s.taskId,
          subjectId: s.subjectId._id || s.subjectId,
          // Store the populated data for display
          _taskData: s.taskId.title ? s.taskId : null,
          _subjectData: s.subjectId.name ? s.subjectId : null
        }));
        setSessions(normalizedSessions);
        setSelectedSessionIds(prev => {
          if (prev.size === 0) return prev;
          const validIds = new Set(
            normalizedSessions
              .map((sess: any) => getSessionIdentifier(sess))
              .filter(Boolean)
          );
          const filteredSelection = Array.from(prev).filter(id => validIds.has(id));
          if (filteredSelection.length === prev.size) {
            return prev;
          }
          return new Set(filteredSelection);
        });

      } catch (err: any) {
        console.error('Failed to fetch sessions:', err);
        setError(err.message || 'Failed to fetch sessions');
        
        // Auto-retry after 5 seconds for connection errors
        if (err.message.includes('Database service unavailable') || err.message.includes('Failed to fetch')) {
          setTimeout(() => {
            console.log('Retrying session fetch...');
            fetchSessions();
          }, 5000);
        }
      } finally {
        setLoading(false);
      }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const subjectsWithAll = useMemo(() => [
    { id: 'all', code: 'All', name: 'All Subjects' }, 
    ...subjects.filter(sub => sub && sub.id) // Filter out subjects with undefined IDs
  ], [subjects]);

  const statuses = ['all', 'scheduled', 'active', 'ended', 'archived'];
  const gameTypeOptions = ['all', 'quiz', 'grid_quest', 'flashcard', 'buzzer_battle'];

  const rows = useMemo(() => {
    return sessions
      .filter(s => subjectId === 'all' || s.subjectId === subjectId)
      .filter(s => status === 'all' || s.status === status)
      .filter(s => gameTypeFilter === 'all' || s.gameType === gameTypeFilter)
      .map(s => {
        const task = tasks.find(t => t.id === s.taskId);
        const subj = subjects.find(sub => sub && sub.id && sub.id === s.subjectId);
        
        // Use populated data from analytics endpoint if available
        let foundTask = s._taskData ? { id: s._taskData._id, title: s._taskData.title } : task;
        let foundSubject = s._subjectData ? { id: s._subjectData._id, code: s._subjectData.code, name: s._subjectData.name } : subj;
        
        // Debug logging to help identify issues
        console.log('Session:', s.id, 'Subject ID:', s.subjectId, 'Found Subject:', foundSubject);
        console.log('Session Task ID:', s.taskId, 'Available Task IDs:', tasks.map(t => t.id));
        console.log('Found Task:', foundTask);
        console.log('Session Status:', s.status, 'Started:', s.startedAt, 'Ended:', s.endedAt);
        console.log('Available subjects:', subjects.filter(sub => sub && sub.id).map(s => ({ id: s.id, code: s.code, name: s.name })));
        
        // Try to find subject by different ID formats, but only if subject has valid ID
        if (!foundSubject && s.subjectId) {
          // Try to find by string comparison (case-insensitive)
          foundSubject = subjects.find(sub => 
            sub && sub.id && 
            sub.id.toString().toLowerCase() === s.subjectId.toString().toLowerCase()
          );
        }
        if (!foundSubject && s.subjectId) {
          // Try to find by MongoDB ObjectId comparison
          foundSubject = subjects.find(sub => sub && sub.id && sub.id === s.subjectId);
        }
        
        // Additional fallback: try to find by subject code if available
        if (!foundSubject && s.subjectId) {
          foundSubject = subjects.find(sub => 
            sub && sub.code && 
            sub.code.toLowerCase().includes(s.subjectId.toString().toLowerCase())
          );
        }
        
        // Try to find task by different ID formats if not found
        if (!foundTask && s.taskId) {
          // Try to find by exact string match first
          foundTask = tasks.find(t => 
            t && t.id && t.id.toString() === s.taskId.toString()
          );
        }
        if (!foundTask && s.taskId) {
          // Try to find by string comparison (case-insensitive)
          foundTask = tasks.find(t => 
            t && t.id && 
            t.id.toString().toLowerCase() === s.taskId.toString().toLowerCase()
          );
        }
        if (!foundTask && s.taskId) {
          // Try to find by MongoDB ObjectId comparison
          foundTask = tasks.find(t => t && t.id && t.id === s.taskId);
        }
        
        // Additional fallback: try to find by partial ID match (last 8 characters)
        if (!foundTask && s.taskId) {
          const sessionIdSuffix = s.taskId.toString().slice(-8);
          foundTask = tasks.find(t => 
            t && t.id && 
            t.id.toString().includes(sessionIdSuffix)
          );
        }
        
        // Debug logging to help identify issues
        if (!foundTask) {
          console.log('Task not found for session:', s.id);
          console.log('Session taskId:', s.taskId, 'Type:', typeof s.taskId);
          console.log('Available task IDs:', tasks.map((t: any) => ({ id: t.id, type: typeof t.id, title: t.title })));
        } else {
          console.log('Task found for session:', s.id, 'Task:', foundTask.title);
        }
        
        const taskTitle = foundTask ? foundTask.title : `Task ID: ${s.taskId}`;
        
        return {
          ...s,
          taskTitle: taskTitle,
          subjectLabel: foundSubject ? `${foundSubject.code} · ${foundSubject.name}` : `Subject ID: ${s.subjectId}`,
          startedLabel: s.startedAt ? new Date(s.startedAt).toLocaleString() : '-',
          endedLabel: s.endedAt ? new Date(s.endedAt).toLocaleString() : '-',
        };
      });
  }, [sessions, subjects, tasks, subjectId, status, gameTypeFilter]);

  const formatGameTypeLabel = (value: string) => {
    if (value === 'all') return 'All Types';
    const map: Record<string, string> = {
      quiz: 'Quiz',
      grid_quest: 'Grid Quest',
      flashcard: 'Flashcard',
      buzzer_battle: 'Buzzer Battle'
    };
    return map[value] || value;
  };

  const formatStatusLabel = (value: string) => {
    if (value === 'all') return 'All Statuses';
    return value.charAt(0).toUpperCase() + value.slice(1);
  };

  const filteredRows = useMemo(() => {
    let workingRows = rows;
    if (taskTitleFromQuery) {
      const needle = taskTitleFromQuery.toLowerCase();
      workingRows = workingRows.filter(r => (r.taskTitle || '').toLowerCase().includes(needle));
    }

    if (textSearch.trim()) {
      const q = textSearch.trim().toLowerCase();
      workingRows = workingRows.filter(r => {
        return (
          (r.taskTitle || '').toLowerCase().includes(q) ||
          (r.subjectLabel || '').toLowerCase().includes(q) ||
          (r.roomCode || '').toLowerCase().includes(q) ||
          (r.status || '').toLowerCase().includes(q)
        );
      });
    }

    if (!sortConfig) {
      return workingRows;
    }

    const { key, direction } = sortConfig;
    const sorted = [...workingRows].sort((a, b) => {
      const dirMultiplier = direction === 'asc' ? 1 : -1;

      const getValue = (row: any) => {
        switch (key) {
          case 'subject':
            return row.subjectLabel || '';
          case 'task':
            return row.taskTitle || '';
          case 'type':
            return row.gameType ? formatGameTypeLabel(row.gameType) : '';
          case 'room':
            return row.roomCode || '';
          case 'status':
            return row.status ? formatStatusLabel(row.status) : '';
          case 'started':
            return row.startedAt ? new Date(row.startedAt).getTime() : 0;
          case 'ended':
            return row.endedAt ? new Date(row.endedAt).getTime() : 0;
          default:
            return '';
        }
      };

      const aValue = getValue(a);
      const bValue = getValue(b);

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return (aValue - bValue) * dirMultiplier;
      }

      return aValue.toString().localeCompare(bValue.toString(), undefined, { sensitivity: 'base' }) * dirMultiplier;
    });

    return sorted;
  }, [rows, taskTitleFromQuery, sortConfig, textSearch]);

  const handleSort = (key: string) => {
    setSortConfig(prev => {
      if (prev && prev.key === key) {
        const nextDirection = prev.direction === 'asc' ? 'desc' : 'asc';
        return { key, direction: nextDirection };
      }
      return { key, direction: 'asc' };
    });
  };

  const getSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) return 'fa-sort';
    return sortConfig.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  };

  const getAriaSort = (key: string): 'ascending' | 'descending' | 'none' => {
    if (!sortConfig || sortConfig.key !== key) return 'none';
    return sortConfig.direction === 'asc' ? 'ascending' : 'descending';
  };

  const handleToggleSession = (session: SessionRow) => {
    const sessionId = getSessionIdentifier(session);
    if (!sessionId) return;
    setSelectedSessionIds(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedSessionIds(prev => {
      const next = new Set(prev);
      if (checked) {
        filteredRows.forEach(row => {
          const id = getSessionIdentifier(row);
          if (id) {
            next.add(id);
          }
        });
      } else {
        filteredRows.forEach(row => {
          const id = getSessionIdentifier(row);
          if (id) {
            next.delete(id);
          }
        });
      }
      return next;
    });
  };

  const handleBulkDeleteConfirm = async () => {
    const ids = Array.from(selectedSessionIds);
    if (ids.length === 0) {
      setShowBulkDeleteConfirm(false);
      return;
    }

    setIsBulkDeleting(true);
    try {
      const response = await fetch('http://localhost:5000/api/analytics/sessions/bulk', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sessionIds: ids })
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.message || 'Failed to delete selected sessions');
      }

      const result = await response.json().catch(() => ({}));
      console.log('Bulk delete result:', result);

      const idsSet = new Set(ids);
      setSessions(prev => prev.filter(session => !idsSet.has(getSessionIdentifier(session))));
      setSelectedSessionIds(new Set<string>());
      setShowBulkDeleteConfirm(false);

      if (result?.missingSessionIds?.length) {
        alert(`Some sessions could not be found and were skipped: ${result.missingSessionIds.join(', ')}`);
      }
    } catch (err: any) {
      console.error('Bulk delete failed:', err);
      alert(err.message || 'Failed to delete selected sessions');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const selectedCount = selectedSessionIds.size;
  const allFilteredSelected = filteredRows.length > 0 && filteredRows.every(row => {
    const id = getSessionIdentifier(row);
    return id && selectedSessionIds.has(id);
  });
  const hasSelection = selectedCount > 0;

  const getAnalyticsRoute = (session: GameSession) => {
    // Route to different analytics based on game type
    // Use the original _id for database queries, not the normalized id
    const sessionId = (session as any)._id || session.id;
    
    switch (session.gameType) {
      case 'quiz':
        return `/teacher/quiz-analytics?view=results&scope=session&subjectId=${session.subjectId}&taskId=${session.taskId}&sessionId=${sessionId}`;
      case 'grid_quest':
        return `/teacher/grid-quest-analytics/${sessionId}`;
      case 'flashcard':
        return `/teacher/flashcard-analytics/${sessionId}`;
      case 'buzzer_battle':
        return `/teacher/buzzer-battle-analytics/${sessionId}`;
      default:
        return `/teacher/quiz-analytics?view=results&scope=session&subjectId=${session.subjectId}&taskId=${session.taskId}&sessionId=${sessionId}`;
    }
  };

  if (loading) {
    return (
      <div className="rlb-page">
        <div className="rlb-header">
          <h2>Game Sessions</h2>
          <div className="rlb-subtitle">Loading sessions...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rlb-page">
        <div className="rlb-header">
          <h2>Game Sessions</h2>
          <div className="rlb-subtitle" style={{ color: 'red' }}>{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="rlb-page">
      <div className="rlb-header">
        <div>
          <h2>Game Sessions</h2>
          <div className="rlb-subtitle">Select a session to view results and leaderboards</div>
        </div>
        <button className="qm-back-btn" onClick={() => navigate('/home')} title="Back">
          <i className="fas fa-arrow-left"></i> Back
        </button>
      </div>

      <div className="rlb-toolbar">

              {/* Session Statistics */}
        <div className="rlb-metrics" style={{ marginBottom: '1rem' }}>
          <div className="metric-card">
            <div className="metric-value">{loading ? '...' : sessions.length}</div>
            <div className="metric-label">Total Sessions</div>
          </div>
          <div className="metric-card">
            <div className="metric-value">{loading ? '...' : sessions.filter(s => s.status === 'ended').length}</div>
            <div className="metric-label">Completed</div>
          </div>
          <div className="metric-card">
            <div className="metric-value">{loading ? '...' : sessions.filter(s => s.gameType === 'quiz').length}</div>
            <div className="metric-label">Quiz Sessions</div>
          </div>
          <div className="metric-card">
            <div className="metric-value">{loading ? '...' : sessions.filter(s => s.gameType === 'grid_quest').length}</div>
            <div className="metric-label">Grid Quest Sessions</div>
          </div>
          <div className="metric-card">
            <div className="metric-value">{loading ? '...' : sessions.filter(s => s.gameType === 'flashcard').length}</div>
            <div className="metric-label">Flashcard Sessions</div>
          </div>
          <div className="metric-card">
            <div className="metric-value">{loading ? '...' : sessions.filter(s => s.gameType === 'buzzer_battle').length}</div>
            <div className="metric-label">Buzzer Battle Sessions</div>
          </div>
        </div>
        <div className="rlb-sorter">
        <div className="rlb-field">
          <label>Subject</label>
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            {subjectsWithAll.map(s => (
              <option key={s.id} value={s.id}>{`${s.code} · ${s.name}`}</option>
            ))}
          </select>
        </div>
        <div className="rlb-field">
          <label>Type</label>
          <select value={gameTypeFilter} onChange={(e) => setGameTypeFilter(e.target.value)}>
            {gameTypeOptions.map(type => (
              <option key={type} value={type}>
                {formatGameTypeLabel(type)}
              </option>
            ))}
          </select>
        </div>
        <div className="rlb-field">
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {statuses.map(state => (
              <option key={state} value={state}>
                {formatStatusLabel(state)}
              </option>
            ))}
          </select>
        </div>
        </div>

        {/* Inline search below filters */}
        <div className="rlb-search-inline" style={{ marginTop: '0.75rem', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <i className="fas fa-search" style={{ color: '#6b7280' }}></i>
          <input
            type="text"
            placeholder="Search by task, subject, room, or status..."
            value={textSearch}
            onChange={(e) => setTextSearch(e.target.value)}
            style={{ flex: 1, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6 }}
          />
          {textSearch && (
            <button className="rlb-btn" onClick={() => setTextSearch('')} title="Clear search">
              Clear
            </button>
          )}
        </div>
        
      </div>



      {/* Error Display */}
      {error && (
        <div className="rlb-card" style={{ marginBottom: '1rem', background: '#fef2f2', border: '1px solid #fecaca' }}>
          <div style={{ padding: '1rem', color: '#dc2626' }}>
            <strong>Error:</strong> {error}
            <button 
              onClick={() => window.location.reload()} 
              style={{ 
                marginLeft: '1rem', 
                padding: '0.5rem 1rem', 
                background: '#dc2626', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Loading Indicator */}
      {loading && (
        <div className="rlb-card" style={{ marginBottom: '1rem', textAlign: 'center', padding: '2rem' }}>
          <div style={{ color: '#6b7280' }}>
            <i className="fas fa-spinner fa-spin" style={{ fontSize: '2rem', marginBottom: '1rem' }}></i>
            <p>Loading sessions...</p>
          </div>
        </div>
      )}

      <section className="rlb-card">
        <div className="rlb-card-head">
          <div>
            <h3>Sessions</h3>
            <div className="muted">Total: {filteredRows.length}</div>
          </div>
          <div className="rlb-card-head-actions">
            <div className="rlb-selected-count">
              Selected: {selectedCount}
            </div>
            <button
              className="rlb-btn"
              onClick={fetchSessions}
              title="Reload sessions"
              style={{ marginRight: '8px' }}
            >
              <i className="fas fa-sync-alt" style={{ marginRight: 6 }}></i> Reload
            </button>
            <button
              className="rlb-btn rlb-btn-danger"
              disabled={!hasSelection || isBulkDeleting}
              onClick={() => hasSelection && setShowBulkDeleteConfirm(true)}
            >
              {isBulkDeleting ? 'Deleting...' : 'Delete Selected'}
            </button>
          </div>
        </div>
        
        {!loading && filteredRows.length === 0 && !error && (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
            <i className="fas fa-inbox" style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}></i>
            <p>No sessions found. Try hosting a quiz to create your first session.</p>
          </div>
        )}
        
        {!loading && filteredRows.length > 0 && (
          <div className="rlb-table-wrap">
            <table className="rlb-table">
            <thead>
              <tr>
                <th className="rlb-select-col">
                  <input
                    type="checkbox"
                    aria-label="Select all sessions"
                    checked={allFilteredSelected}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </th>
                <th className="rlb-left" aria-sort={getAriaSort('subject')}>
                  <button
                    type="button"
                    className="rlb-sortable"
                    onClick={() => handleSort('subject')}
                    aria-label={`Sort by subject (${getAriaSort('subject')})`}
                  >
                    <span>Subject</span>
                    <i className={`fas ${getSortIcon('subject')} rlb-sort-icon`} aria-hidden="true"></i>
                  </button>
                </th>
                <th className="rlb-left" aria-sort={getAriaSort('task')}>
                  <button
                    type="button"
                    className="rlb-sortable"
                    onClick={() => handleSort('task')}
                    aria-label={`Sort by task (${getAriaSort('task')})`}
                  >
                    <span>Task</span>
                    <i className={`fas ${getSortIcon('task')} rlb-sort-icon`} aria-hidden="true"></i>
                  </button>
                </th>
                <th className="rlb-left" aria-sort={getAriaSort('type')}>
                  <button
                    type="button"
                    className="rlb-sortable"
                    onClick={() => handleSort('type')}
                    aria-label={`Sort by type (${getAriaSort('type')})`}
                  >
                    <span>Type</span>
                    <i className={`fas ${getSortIcon('type')} rlb-sort-icon`} aria-hidden="true"></i>
                  </button>
                </th>
                <th className="rlb-left" aria-sort={getAriaSort('room')}>
                  <button
                    type="button"
                    className="rlb-sortable"
                    onClick={() => handleSort('room')}
                    aria-label={`Sort by room (${getAriaSort('room')})`}
                  >
                    <span>Room</span>
                    <i className={`fas ${getSortIcon('room')} rlb-sort-icon`} aria-hidden="true"></i>
                  </button>
                </th>
                <th className="rlb-left" aria-sort={getAriaSort('status')}>
                  <button
                    type="button"
                    className="rlb-sortable"
                    onClick={() => handleSort('status')}
                    aria-label={`Sort by status (${getAriaSort('status')})`}
                  >
                    <span>Status</span>
                    <i className={`fas ${getSortIcon('status')} rlb-sort-icon`} aria-hidden="true"></i>
                  </button>
                </th>
                <th className="rlb-left" aria-sort={getAriaSort('started')}>
                  <button
                    type="button"
                    className="rlb-sortable"
                    onClick={() => handleSort('started')}
                    aria-label={`Sort by start time (${getAriaSort('started')})`}
                  >
                    <span>Start</span>
                    <i className={`fas ${getSortIcon('started')} rlb-sort-icon`} aria-hidden="true"></i>
                  </button>
                </th>
                <th className="rlb-left" aria-sort={getAriaSort('ended')}>
                  <button
                    type="button"
                    className="rlb-sortable"
                    onClick={() => handleSort('ended')}
                    aria-label={`Sort by end time (${getAriaSort('ended')})`}
                  >
                    <span>End</span>
                    <i className={`fas ${getSortIcon('ended')} rlb-sort-icon`} aria-hidden="true"></i>
                  </button>
                </th>
                <th className="rlb-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((s) => {
                const rowId = getSessionIdentifier(s);
                const isSelected = rowId ? selectedSessionIds.has(rowId) : false;

                return (
                  <tr key={rowId || s.id} className={isSelected ? 'rlb-row-selected' : ''}>
                    <td className="rlb-select-col" data-label="Select">
                      <input
                        type="checkbox"
                        aria-label={`Select session ${s.taskTitle}`}
                        checked={isSelected}
                        onChange={() => handleToggleSession(s)}
                      />
                    </td>
                    <td data-label="Subject">{s.subjectLabel}</td>
                    <td data-label="Task">{s.taskTitle}</td>
                    <td data-label="Type">
                      <span className="rlb-badge rlb-badge-info">
                        {s.gameType === 'quiz' ? 'Quiz' : 
                         s.gameType === 'grid_quest' ? 'Grid Quest' :
                         s.gameType === 'flashcard' ? 'Flashcard' :
                         s.gameType === 'buzzer_battle' ? 'Buzzer Battle' : s.gameType}
                      </span>
                    </td>
                    <td data-label="Room">{s.roomCode ?? '-'}</td>
                    <td data-label="Status">
                      <span className={`rlb-badge ${
                        s.status === 'active' ? 'rlb-badge-info' : 
                        s.status === 'ended' ? 'rlb-badge-success' : 
                        'rlb-badge-muted'
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td data-label="Start">{s.startedLabel}</td>
                    <td data-label="End">{s.endedLabel}</td>
                    <td data-label="Actions" className="rlb-right rlb-actions-cell">
                      
                      <Link
                        className="rlb-btn rlb-btn-primary"
                        to={getAnalyticsRoute(s)}
                      >
                        Analytics
                      </Link>
                      <button
                        className="rlb-btn rlb-btn-danger"
                        title="Delete Session"
                        onClick={async () => {
                          if (!window.confirm('Delete this session and all related attempts?')) return;
                          try {
                            const sessionKey = getSessionIdentifier(s);
                            const res = await fetch(`http://localhost:5000/api/analytics/sessions/${sessionKey}`, { method: 'DELETE' });
                            if (!res.ok) {
                              const err = await res.json().catch(() => ({}));
                              throw new Error(err.message || 'Failed to delete session');
                            }
                            const info = await res.json();
                            console.log('Delete result:', info);
                            setSessions(list => list.filter(x => getSessionIdentifier(x) !== sessionKey));
                            setSelectedSessionIds(prev => {
                              if (!sessionKey || !prev.has(sessionKey)) return prev;
                              const next = new Set(prev);
                              next.delete(sessionKey);
                              return next;
                            });
                          } catch (e: any) {
                            alert(e.message || 'Failed to delete');
                          }
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td className="empty" colSpan={9}>No sessions found</td></tr>
              )}
            </tbody>
            </table>
          </div>
        )}
      </section>
      {showBulkDeleteConfirm && (
        <div className="rlb-modal-backdrop" role="dialog" aria-modal="true">
          <div className="rlb-modal">
            <h4>Delete Sessions</h4>
            <p>
              Are you sure you want to delete {selectedCount === 1 ? 'the selected session' : `all ${selectedCount} selected sessions`}?
              This action cannot be undone.
            </p>
            <div className="rlb-modal-actions">
              <button
                className="rlb-btn rlb-btn-secondary"
                onClick={() => setShowBulkDeleteConfirm(false)}
                disabled={isBulkDeleting}
              >
                Cancel
              </button>
              <button
                className="rlb-btn rlb-btn-danger"
                onClick={handleBulkDeleteConfirm}
                disabled={isBulkDeleting}
              >
                {isBulkDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionsList;