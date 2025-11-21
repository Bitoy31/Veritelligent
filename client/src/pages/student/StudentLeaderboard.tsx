import React, { useState, useEffect } from 'react';
import '../../styles/results_leaderboard.css';
import type { SubjectRef } from '../../types/game';
import { formatGameTypeLabel, getCategoryGames, type LeaderboardEntry } from '../../utils/leaderboard';

const StudentLeaderboard: React.FC = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const currentStudentId = user?._id;

  const [subjectId, setSubjectId] = useState<string>('');
  const [subjects, setSubjects] = useState<SubjectRef[]>([]);
  const [activeTab, setActiveTab] = useState<'overall' | 'solo' | 'party'>('overall');
  const [activeGameType, setActiveGameType] = useState<string>('');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch enrolled subjects
  useEffect(() => {
    const fetchSubjects = async () => {
      if (!currentStudentId) return;
      
      try {
        const response = await fetch(`https://api.veritelligent.fun/api/subjects/student/${currentStudentId}/all`);
        if (response.status === 401) {
          localStorage.clear();
          sessionStorage.clear();
          window.location.href = '/login';
          return;
        }
        if (!response.ok) throw new Error('Failed to fetch subjects');
        const data = await response.json();
        
        const normalizedSubjects = data
          .filter((subject: any) => subject && (subject._id || subject.id))
          .map((subject: any) => ({
            id: subject._id || subject.id,
            code: subject.code || subject.subjectCode || 'N/A',
            name: subject.name || subject.subjectName || 'Untitled Subject'
          }));
        
        setSubjects(normalizedSubjects);
        if (normalizedSubjects.length > 0 && !subjectId) {
          setSubjectId(normalizedSubjects[0].id);
        }
      } catch (err: any) {
        console.error('Failed to fetch subjects:', err);
        setError('Failed to load subjects');
      }
    };

    fetchSubjects();
  }, [currentStudentId]);

  // Fetch leaderboard data
  useEffect(() => {
    if (!subjectId) return;

    const fetchLeaderboard = async () => {
      setLoading(true);
      setError('');
      
      try {
        let url = `https://api.veritelligent.fun/api/analytics/leaderboard?subjectId=${subjectId}`;
        
        if (activeTab === 'solo' || activeTab === 'party') {
          url += `&category=${activeTab}`;
        }
        
        if (activeGameType && activeTab !== 'overall') {
          url += `&gameType=${activeGameType}`;
        }
        
        const response = await fetch(url);
        if (response.status === 401) {
          localStorage.clear();
          sessionStorage.clear();
          window.location.href = '/login';
          return;
        }
        if (!response.ok) throw new Error('Failed to fetch leaderboard');
        const data = await response.json();
        
        setLeaderboard(data);
      } catch (err: any) {
        console.error('Failed to fetch leaderboard:', err);
        setError(err.message || 'Failed to load leaderboard');
        setLeaderboard([]);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [subjectId, activeTab, activeGameType]);

  const handleTabChange = (tab: 'overall' | 'solo' | 'party') => {
    setActiveTab(tab);
    setActiveGameType(''); // Reset game type when changing category
  };

  const selectedSubject = subjects.find(s => s.id === subjectId);
  const categoryGames = activeTab === 'solo' || activeTab === 'party' 
    ? getCategoryGames(activeTab) 
    : [];

  return (
    <div className="rlb-page">
      <div className="rlb-header">
        <div>
          <h2 style={{ marginTop: '0.5rem', marginBottom: '0.25rem' }}>Leaderboard</h2>
          <div className="rlb-subtitle">View rankings and your performance</div>
        </div>
      </div>

      <div className="rlb-toolbar">
        <div className="rlb-field" style={{ flex: '1', maxWidth: '300px' }}>
          <label>Subject</label>
          <select 
            value={subjectId} 
            onChange={(e) => setSubjectId(e.target.value)}
            disabled={subjects.length === 0}
          >
            {subjects.length === 0 ? (
              <option value="">No subjects available</option>
            ) : (
              subjects.map(s => (
                <option key={s.id} value={s.id}>
                  {s.code} · {s.name}
                </option>
              ))
            )}
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

      {subjectId && (
        <>
          {/* Main Category Tabs */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '2px solid #e5e7eb' }}>
            <button
              onClick={() => handleTabChange('overall')}
              style={{
                padding: '12px 24px',
                border: 'none',
                background: activeTab === 'overall' ? '#03a696' : 'transparent',
                color: activeTab === 'overall' ? '#ffffff' : '#6b7280',
                fontWeight: activeTab === 'overall' ? 600 : 400,
                cursor: 'pointer',
                borderBottom: activeTab === 'overall' ? '3px solid #03a696' : '3px solid transparent',
                marginBottom: '-2px'
              }}
            >
              Overall
            </button>
            <button
              onClick={() => handleTabChange('solo')}
              style={{
                padding: '12px 24px',
                border: 'none',
                background: activeTab === 'solo' ? '#03a696' : 'transparent',
                color: activeTab === 'solo' ? '#ffffff' : '#6b7280',
                fontWeight: activeTab === 'solo' ? 600 : 400,
                cursor: 'pointer',
                borderBottom: activeTab === 'solo' ? '3px solid #03a696' : '3px solid transparent',
                marginBottom: '-2px'
              }}
            >
              Solo
            </button>
            <button
              onClick={() => handleTabChange('party')}
              style={{
                padding: '12px 24px',
                border: 'none',
                background: activeTab === 'party' ? '#03a696' : 'transparent',
                color: activeTab === 'party' ? '#ffffff' : '#6b7280',
                fontWeight: activeTab === 'party' ? 600 : 400,
                cursor: 'pointer',
                borderBottom: activeTab === 'party' ? '3px solid #03a696' : '3px solid transparent',
                marginBottom: '-2px'
              }}
            >
              Party
            </button>
          </div>

          {/* Game Type Tabs (only for Solo/Party) */}
          {activeTab !== 'overall' && categoryGames.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              {categoryGames.map(gameType => (
                <button
                  key={gameType}
                  onClick={() => setActiveGameType(activeGameType === gameType ? '' : gameType)}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    background: activeGameType === gameType ? '#eff6ff' : '#ffffff',
                    color: activeGameType === gameType ? '#1e40af' : '#6b7280',
                    fontWeight: activeGameType === gameType ? 600 : 400,
                    cursor: 'pointer'
                  }}
                >
                  {formatGameTypeLabel(gameType)}
                </button>
              ))}
            </div>
          )}

          {/* Leaderboard Table */}
          <section className="rlb-card">
            <div className="rlb-card-head">
              <h3>
                {activeTab === 'overall' 
                  ? 'Overall Leaderboard' 
                  : activeGameType 
                    ? `${formatGameTypeLabel(activeGameType)} Leaderboard`
                    : `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Games Leaderboard`}
                {selectedSubject && ` - ${selectedSubject.code}`}
              </h3>
              <div className="muted">Total: {leaderboard.length}</div>
            </div>
            <div className="rlb-table-wrap">
              {loading ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                  <i className="fas fa-spinner fa-spin" style={{ fontSize: '2rem', marginBottom: '1rem' }}></i>
                  <p>Loading leaderboard...</p>
                </div>
              ) : leaderboard.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                  <p>No leaderboard data available for this selection.</p>
                </div>
              ) : (
                <table className="rlb-table">
                  <thead>
                    <tr>
                      <th className="rlb-center">Rank</th>
                      <th className="rlb-left">Student Name</th>
                      <th className="rlb-right">Score</th>
                      <th className="rlb-right">Accuracy</th>
                      <th className="rlb-center">Games Played</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((entry) => {
                      const isCurrentUser = String(entry.studentId) === String(currentStudentId);
                      const rowClass = entry.rank === 1 ? 'rlb-top-1' 
                        : entry.rank === 2 ? 'rlb-top-2' 
                        : entry.rank === 3 ? 'rlb-top-3' 
                        : '';
                      return (
                        <tr 
                          key={entry.studentId} 
                          className={rowClass}
                          style={isCurrentUser ? { 
                            background: '#fef3c7', 
                            fontWeight: 600,
                            borderLeft: '4px solid #f59e0b'
                          } : {}}
                        >
                          <td data-label="Rank" className="rlb-center">
                            <strong>{entry.rank}</strong>
                            {entry.rank <= 3 && (
                              <span style={{ marginLeft: '8px' }}>
                                {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉'}
                              </span>
                            )}
                            {isCurrentUser && <span style={{ marginLeft: '8px', color: '#f59e0b' }}>(You)</span>}
                          </td>
                          <td data-label="Student Name">
                            {entry.studentName}
                            {isCurrentUser && <span style={{ marginLeft: '8px', color: '#f59e0b' }}>⭐</span>}
                          </td>
                          <td data-label="Score" className="rlb-right">
                            <strong>{entry.finalScore.toLocaleString()}</strong>
                          </td>
                          <td data-label="Accuracy" className="rlb-right">
                            {entry.accuracyPct !== undefined && entry.accuracyPct !== null
                              ? `${Math.round(entry.accuracyPct)}%`
                              : '-'}
                          </td>
                          <td data-label="Games Played" className="rlb-center">{entry.gamesPlayed}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default StudentLeaderboard; 