import React, { useEffect, useMemo, useState } from 'react';
import '../../styles/results_leaderboard.css';
import type { GameAttempt, GameSession, SubjectRef } from '../../types/game';

type AttemptWithMeta = GameAttempt & {
  taskTitle?: string;
  subjectCode?: string;
  subjectName?: string;
};

const StudentSessions: React.FC = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const currentStudentId = user?._id;

  const [subjects, setSubjects] = useState<SubjectRef[]>([]);
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [attempts, setAttempts] = useState<AttemptWithMeta[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const [subjectId, setSubjectId] = useState<string>('all');

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/subjects/student/${currentStudentId}/all`);
        if (res.status === 401) {
          localStorage.clear();
          sessionStorage.clear();
          window.location.href = '/login';
          return;
        }
        if (!res.ok) throw new Error('Failed to load subjects');
        const data = await res.json();
        const normalized: SubjectRef[] = data
          .filter((subject: any) => subject && (subject._id || subject.id))
          .map((subject: any) => ({
            id: subject._id || subject.id,
            code: subject.code || subject.subjectCode || 'N/A',
            name: subject.name || subject.subjectName || 'Untitled Subject'
          }));
        setSubjects([{ id: 'all', code: 'All', name: 'All Subjects' }, ...normalized]);
      } catch (err: any) {
        console.error('Failed to fetch subjects:', err);
        setSubjects([{ id: 'all', code: 'All', name: 'All Subjects' }]);
      }
    };

    if (currentStudentId) {
      fetchSubjects();
    } else {
      setSubjects([{ id: 'all', code: 'All', name: 'All Subjects' }]);
    }
  }, [currentStudentId]);

  useEffect(() => {
    const fetchData = async () => {
      if (!currentStudentId) {
        setError('Missing student information. Please sign in again.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const attemptsRes = await fetch(`http://localhost:5000/api/analytics/attempts?studentId=${currentStudentId}`);

        if (attemptsRes.status === 401) {
          localStorage.clear();
          sessionStorage.clear();
          window.location.href = '/login';
          return;
        }

        if (!attemptsRes.ok) {
          const errBody = await attemptsRes.json().catch(() => ({}));
          throw new Error(errBody.message || 'Failed to load attempts');
        }

        const attemptsData = await attemptsRes.json();
        const normalizedAttempts: AttemptWithMeta[] = attemptsData
          .filter((attempt: any) => attempt && attempt.sessionId)
          .map((attempt: any) => {
            const sessionId = attempt.sessionId?._id || attempt.sessionId;
            const taskId = attempt.taskId?._id || attempt.taskId;
            const subjectId = attempt.subjectId?._id || attempt.subjectId;
            const taskTitle = attempt.taskId?.title || attempt.taskTitle || undefined;
            const subjectCode = attempt.subjectId?.code;
            const subjectName = attempt.subjectId?.name;
            return {
              id: attempt._id || attempt.id,
              taskId,
              sessionId,
              subjectId,
              studentId: attempt.studentId?._id || attempt.studentId,
              category: attempt.category,
              gameType: attempt.gameType,
              attemptNo: attempt.attemptNo ?? 1,
              startedAt: attempt.startedAt,
              endedAt: attempt.endedAt,
              timeSpentSec: attempt.timeSpentSec,
              answers: attempt.answers || [],
              scoringPolicy: attempt.scoringPolicy || { totalPointsPossible: attempt.totalScore || 0 },
              totalScore: attempt.totalScore ?? 0,
              bonusPoints: attempt.bonusPoints ?? 0,
              finalScore: attempt.finalScore ?? 0,
              accuracyPct: attempt.accuracyPct,
              status: attempt.status || 'completed',
              teamId: attempt.teamId,
              taskTitle,
              subjectCode,
              subjectName
            } as AttemptWithMeta;
          });

        setAttempts(normalizedAttempts);

        const sessionIds = Array.from(
          new Set(
            normalizedAttempts
              .map(att => att.sessionId)
              .filter((id): id is string => Boolean(id))
          )
        );

        if (sessionIds.length === 0) {
          setSessions([]);
          setLoading(false);
          return;
        }

        const sessionsRes = await fetch(`http://localhost:5000/api/analytics/sessions?sessionIds=${sessionIds.join(',')}`);

        if (!sessionsRes.ok) {
          const errBody = await sessionsRes.json().catch(() => ({}));
          throw new Error(errBody.message || 'Failed to load sessions');
        }

        const sessionsData = await sessionsRes.json();
        const normalizedSessions: GameSession[] = sessionsData.map((session: any) => ({
          ...session,
          id: session._id || session.id,
          taskId: session.taskId?._id || session.taskId,
          subjectId: session.subjectId?._id || session.subjectId,
          teacherId: session.teacherId?._id || session.teacherId,
          _taskData: session.taskId && session.taskId.title ? { _id: session.taskId._id, title: session.taskId.title } : session._taskData,
          _subjectData: session.subjectId && session.subjectId.name ? { _id: session.subjectId._id, name: session.subjectId.name, code: session.subjectId.code } : session._subjectData
        }));

        setSessions(normalizedSessions);
      } catch (err: any) {
        console.error('Failed to fetch student sessions:', err);
        setError(err.message || 'Failed to load sessions');
        setSessions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentStudentId]);

  const formatGameTypeLabel = (value: string) => {
    const map: Record<string, string> = {
      quiz: 'Quiz',
      grid_quest: 'Grid Quest',
      flashcard: 'Flashcard',
      buzzer_battle: 'Buzzer Battle'
    };
    return map[value] || value;
  };

  const attemptsBySession = useMemo(() => {
    const map = new Map<string, AttemptWithMeta>();
    attempts.forEach(att => {
      if (!att.sessionId) return;
      const existing = map.get(att.sessionId);
      if (!existing) {
        map.set(att.sessionId, att);
        return;
      }
      const existingEnded = existing.endedAt ? new Date(existing.endedAt).getTime() : 0;
      const currentEnded = att.endedAt ? new Date(att.endedAt).getTime() : 0;
      if (currentEnded >= existingEnded) {
        map.set(att.sessionId, att);
      }
    });
    return map;
  }, [attempts]);

  const rows = useMemo(() => {
    return sessions
      .filter(session => subjectId === 'all' || session.subjectId === subjectId)
      .map(session => {
        const subject = subjects.find(sub => sub.id === session.subjectId);
        const attempt = session.id ? attemptsBySession.get(session.id) : undefined;

        const subjectLabel = subject
          ? `${subject.code} · ${subject.name}`
          : attempt && attempt.subjectCode && attempt.subjectName
            ? `${attempt.subjectCode} · ${attempt.subjectName}`
            : session._subjectData
              ? `${session._subjectData.code} · ${session._subjectData.name}`
              : session.subjectId;

        const taskTitle = session._taskData?.title || attempt?.taskTitle || session.taskId;

        return {
          ...session,
          subjectLabel,
          taskTitle,
          gameTypeLabel: formatGameTypeLabel(session.gameType),
          startedLabel: session.startedAt ? new Date(session.startedAt).toLocaleString() : '-',
          endedLabel: session.endedAt ? new Date(session.endedAt).toLocaleString() : '-',
          myScore: attempt?.finalScore,
          myAccuracy: attempt?.accuracyPct
        };
      });
  }, [attemptsBySession, sessions, subjectId, subjects]);

  return (
    <div className="rlb-page">
      <div className="rlb-header">
        <div>
          <h2>My Recent Sessions</h2>
          <div className="rlb-subtitle">Review your past games and results</div>
        </div>
      </div>

      <div className="rlb-toolbar">
        <div className="rlb-field">
          <label>Subject</label>
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            {subjects.map(s => (
              <option key={s.id} value={s.id}>{`${s.code} · ${s.name}`}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="rlb-card" style={{ marginBottom: '1rem', background: '#fef2f2', border: '1px solid #fecaca' }}>
          <div style={{ padding: '1rem', color: '#dc2626' }}>
            <strong>Error:</strong> {error}
          </div>
        </div>
      )}

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
          <h3>Sessions</h3>
          <div className="muted">Total: {rows.length}</div>
        </div>
        <div className="rlb-table-wrap">
          <table className="rlb-table">
            <thead>
              <tr>
                <th className="rlb-left">Subject</th>
                <th className="rlb-left">Task</th>
                <th className="rlb-left">Type</th>
                <th className="rlb-left">Status</th>
                <th className="rlb-left">Start</th>
                <th className="rlb-left">End</th>
                <th className="rlb-right">My Score</th>
                <th className="rlb-right">My Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(session => (
                <tr key={session.id}>
                  <td data-label="Subject">{session.subjectLabel}</td>
                  <td data-label="Task">{session.taskTitle}</td>
                  <td data-label="Type">
                    <span className="rlb-badge rlb-badge-info">{session.gameTypeLabel}</span>
                  </td>
                  <td data-label="Status">
                    <span className={`rlb-badge ${
                      session.status === 'active'
                        ? 'rlb-badge-info'
                        : session.status === 'ended'
                          ? 'rlb-badge-success'
                          : 'rlb-badge-muted'
                    }`}>
                      {session.status}
                    </span>
                  </td>
                  <td data-label="Start">{session.startedLabel}</td>
                  <td data-label="End">{session.endedLabel}</td>
                  <td data-label="My Score" className="rlb-right">{session.myScore ?? '-'}</td>
                  <td data-label="My Accuracy" className="rlb-right">
                    {session.myAccuracy !== undefined && session.myAccuracy !== null
                      ? `${Math.round(session.myAccuracy)}%`
                      : '-'}
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr><td className="empty" colSpan={8}>No sessions found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default StudentSessions;