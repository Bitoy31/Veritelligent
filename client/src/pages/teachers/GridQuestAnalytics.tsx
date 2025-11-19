import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../../styles/grid_quest_analytics.css';
import { useDocumentTitle } from '../../utils/useDocumentTitle';

interface SessionMetadata {
  sessionId: string;
  roomCode: string;
  taskTitle: string;
  startedAt: string;
  endedAt: string;
  durationMinutes: number | null;
  status: string;
  teacher: string;
}

interface Summary {
  totalRounds: number;
  cluesCompleted: number;
  totalTeams: number;
  totalPlayers: number;
  offlinePlayerCount: number;
  manualScoreAdjustments: number;
}

interface TeamStats {
  teamId: string;
  teamName: string;
  finalScore: number;
  members: string[];
  memberCount: number;
  statistics: {
    cluesAnswered: number;
    correctAnswers: number;
    wrongAnswers: number;
    accuracyPct: number;
    avgResponseTimeSec: number | null;
    totalPointsEarned: number;
    totalPointsLost: number;
  };
}

interface TeamAttempt {
  teamName: string;
  teamId: string;
  studentName: string;
  studentId: string;
  isOffline: boolean;
  submittedAnswer: string;
  isCorrect: boolean;
  pointsAwarded: number;
  responseTimeSec: number | null;
  wasAutoSubmitted: boolean;
}

interface ClueBreakdown {
  categoryName: string;
  catIdx: number;
  clueIdx: number;
  prompt: string;
  points: number;
  roundNumber: number;
  accuracyPct: number;
  correctCount: number;
  wrongCount: number;
  teamAttempts: TeamAttempt[];
}

interface StudentParticipation {
  studentId: string;
  studentName: string;
  isOffline: boolean;
  teamName: string;
  timesChosen: number;
  correctAnswers: number;
  wrongAnswers: number;
  totalPointsContributed: number;
}

interface CategoryPerformance {
  categoryName: string;
  cluesAttempted: number;
  correctCount: number;
  wrongCount: number;
  accuracyPct: number;
}

interface AnalyticsData {
  session: SessionMetadata;
  summary: Summary;
  teams: TeamStats[];
  clueBreakdown: ClueBreakdown[];
  studentParticipation: StudentParticipation[];
  categoryPerformance: CategoryPerformance[];
}

const GridQuestAnalytics: React.FC = () => {
  useDocumentTitle('Grid Quest Analytics | Veritelligent');
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'teams' | 'clues' | 'students' | 'categories'>('overview');
  const [expandedClue, setExpandedClue] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        setError('');
        
        const response = await fetch(`http://localhost:5000/api/gridquest/sessions/${sessionId}/analytics`);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to fetch analytics');
        }
        
        const data = await response.json();
        setAnalytics(data);
        
      } catch (err: any) {
        console.error('Failed to fetch Grid Quest analytics:', err);
        setError(err.message || 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };

    if (sessionId) {
      fetchAnalytics();
    }
  }, [sessionId]);

  const handleExport = async () => {
    try {
      setExporting(true);
      
      const response = await fetch(`http://localhost:5000/api/gridquest/sessions/${sessionId}/export`);
      
      if (!response.ok) {
        throw new Error('Failed to export analytics');
      }
      
      // Get the filename from the Content-Disposition header
      const disposition = response.headers.get('Content-Disposition');
      const filename = disposition 
        ? disposition.split('filename=')[1]?.replace(/"/g, '') 
        : `GridQuest_Analytics_${sessionId}.xlsx`;
      
      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
    } catch (err: any) {
      console.error('Export failed:', err);
      alert(err.message || 'Failed to export analytics');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="gqa-page">
        <div className="gqa-loading">
          <i className="fas fa-spinner fa-spin"></i>
          <p>Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="gqa-page">
        <div className="gqa-error">
          <i className="fas fa-exclamation-circle"></i>
          <h3>Error Loading Analytics</h3>
          <p>{error || 'Analytics data not available'}</p>
          <button className="gqa-btn gqa-btn-primary" onClick={() => navigate('/teacher/sessions')}>
            Back to Sessions
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="gqa-page">
      {/* Header */}
      <div className="gqa-header">
        <div className="gqa-header-content">
          <button className="gqa-back-btn" onClick={() => navigate('/teacher/sessions')}>
            <i className="fas fa-arrow-left"></i> Back
          </button>
          <div className="gqa-header-info">
            <h1>
              <i className="fas fa-chart-bar"></i> Grid Quest Analytics
            </h1>
            <div className="gqa-header-meta">
              <span><i className="fas fa-trophy"></i> {analytics.session.taskTitle}</span>
              <span><i className="fas fa-hashtag"></i> {analytics.session.roomCode}</span>
              <span><i className="fas fa-calendar"></i> {new Date(analytics.session.startedAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
        <button 
          className="gqa-btn gqa-btn-export"
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting ? (
            <>
              <i className="fas fa-spinner fa-spin"></i> Exporting...
            </>
          ) : (
            <>
              <i className="fas fa-file-excel"></i> Export to Excel
            </>
          )}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="gqa-summary">
        <div className="gqa-card gqa-card-primary">
          <div className="gqa-card-icon">
            <i className="fas fa-tasks"></i>
          </div>
          <div className="gqa-card-content">
            <div className="gqa-card-value">{analytics.summary.totalRounds}</div>
            <div className="gqa-card-label">Total Rounds</div>
          </div>
        </div>
        
        <div className="gqa-card gqa-card-success">
          <div className="gqa-card-icon">
            <i className="fas fa-users"></i>
          </div>
          <div className="gqa-card-content">
            <div className="gqa-card-value">{analytics.summary.totalTeams}</div>
            <div className="gqa-card-label">Teams</div>
          </div>
        </div>
        
        <div className="gqa-card gqa-card-info">
          <div className="gqa-card-icon">
            <i className="fas fa-user-friends"></i>
          </div>
          <div className="gqa-card-content">
            <div className="gqa-card-value">{analytics.summary.totalPlayers}</div>
            <div className="gqa-card-label">Total Players</div>
          </div>
        </div>
        
        <div className="gqa-card gqa-card-warning">
          <div className="gqa-card-icon">
            <i className="fas fa-clock"></i>
          </div>
          <div className="gqa-card-content">
            <div className="gqa-card-value">{analytics.session.durationMinutes || 'N/A'}</div>
            <div className="gqa-card-label">Duration (min)</div>
          </div>
        </div>

        {analytics.summary.offlinePlayerCount > 0 && (
          <div className="gqa-card gqa-card-purple">
            <div className="gqa-card-icon">
              <i className="fas fa-user-slash"></i>
            </div>
            <div className="gqa-card-content">
              <div className="gqa-card-value">{analytics.summary.offlinePlayerCount}</div>
              <div className="gqa-card-label">Offline Players</div>
            </div>
          </div>
        )}
        
        {analytics.summary.manualScoreAdjustments > 0 && (
          <div className="gqa-card gqa-card-accent">
            <div className="gqa-card-icon">
              <i className="fas fa-edit"></i>
            </div>
            <div className="gqa-card-content">
              <div className="gqa-card-value">{analytics.summary.manualScoreAdjustments}</div>
              <div className="gqa-card-label">Manual Adjustments</div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="gqa-tabs">
        <button 
          className={`gqa-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <i className="fas fa-chart-pie"></i> Overview
        </button>
        <button 
          className={`gqa-tab ${activeTab === 'teams' ? 'active' : ''}`}
          onClick={() => setActiveTab('teams')}
        >
          <i className="fas fa-users"></i> Teams
        </button>
        <button 
          className={`gqa-tab ${activeTab === 'clues' ? 'active' : ''}`}
          onClick={() => setActiveTab('clues')}
        >
          <i className="fas fa-puzzle-piece"></i> Clues
        </button>
        <button 
          className={`gqa-tab ${activeTab === 'students' ? 'active' : ''}`}
          onClick={() => setActiveTab('students')}
        >
          <i className="fas fa-user-graduate"></i> Students
        </button>
        <button 
          className={`gqa-tab ${activeTab === 'categories' ? 'active' : ''}`}
          onClick={() => setActiveTab('categories')}
        >
          <i className="fas fa-list"></i> Categories
        </button>
      </div>

      {/* Tab Content */}
      <div className="gqa-content">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="gqa-tab-content">
            {/* Top 3 Teams Podium */}
            <div className="gqa-section">
              <h2 className="gqa-section-title">
                <i className="fas fa-trophy"></i> Final Rankings
              </h2>
              <div className="gqa-podium">
                {analytics.teams.slice(0, 3).map((team, index) => {
                  const position = index + 1;
                  const colors = {
                    1: { bg: 'linear-gradient(135deg, #ffd700 0%, #ffed4e 100%)', icon: 'crown' },
                    2: { bg: 'linear-gradient(135deg, #c0c0c0 0%, #e8e8e8 100%)', icon: 'medal' },
                    3: { bg: 'linear-gradient(135deg, #cd7f32 0%, #e6a057 100%)', icon: 'award' }
                  };
                  const heights = { 1: '120px', 2: '90px', 3: '70px' };
                  
                  return (
                    <div key={team.teamId} className={`gqa-podium-item position-${position}`}>
                      <div className="gqa-podium-content">
                        <div 
                          className="gqa-podium-icon"
                          style={{ background: colors[position as keyof typeof colors].bg }}
                        >
                          <i className={`fas fa-${colors[position as keyof typeof colors].icon}`}></i>
                        </div>
                        <div className="gqa-podium-rank">#{position}</div>
                        <div className="gqa-podium-team">{team.teamName}</div>
                        <div className="gqa-podium-score">{team.finalScore} pts</div>
                        <div className="gqa-podium-accuracy">{team.statistics.accuracyPct}% accuracy</div>
                      </div>
                      <div 
                        className="gqa-podium-stand"
                        style={{ 
                          height: heights[position as keyof typeof heights],
                          background: colors[position as keyof typeof colors].bg 
                        }}
                      >
                        <span>{position}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Category Performance Chart */}
            <div className="gqa-section">
              <h2 className="gqa-section-title">
                <i className="fas fa-chart-bar"></i> Category Performance
              </h2>
              <div className="gqa-chart-container">
                {analytics.categoryPerformance.map(cat => (
                  <div key={cat.categoryName} className="gqa-chart-row">
                    <div className="gqa-chart-label">{cat.categoryName}</div>
                    <div className="gqa-chart-bar-container">
                      <div 
                        className="gqa-chart-bar"
                        style={{ width: `${cat.accuracyPct}%` }}
                      >
                        <span>{cat.accuracyPct}%</span>
                      </div>
                    </div>
                    <div className="gqa-chart-stats">
                      <span className="correct">{cat.correctCount} ✓</span>
                      <span className="wrong">{cat.wrongCount} ✗</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Teams Tab */}
        {activeTab === 'teams' && (
          <div className="gqa-tab-content">
            <div className="gqa-section">
              <h2 className="gqa-section-title">
                <i className="fas fa-users"></i> Team Performance
              </h2>
              <div className="gqa-table-container">
                <table className="gqa-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Team</th>
                      <th>Final Score</th>
                      <th>Answered</th>
                      <th>Correct</th>
                      <th>Wrong</th>
                      <th>Accuracy</th>
                      <th>Avg Time (s)</th>
                      <th>Members</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.teams.map((team, index) => (
                      <tr key={team.teamId}>
                        <td className="rank">#{index + 1}</td>
                        <td className="team-name">{team.teamName}</td>
                        <td className="score">{team.finalScore}</td>
                        <td>{team.statistics.cluesAnswered}</td>
                        <td className="correct">{team.statistics.correctAnswers}</td>
                        <td className="wrong">{team.statistics.wrongAnswers}</td>
                        <td>
                          <div className="gqa-progress-mini">
                            <div 
                              className="gqa-progress-mini-fill"
                              style={{ width: `${team.statistics.accuracyPct}%` }}
                            ></div>
                            <span>{team.statistics.accuracyPct}%</span>
                          </div>
                        </td>
                        <td>{team.statistics.avgResponseTimeSec?.toFixed(1) || 'N/A'}</td>
                        <td className="members">{team.members.join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Clues Tab */}
        {activeTab === 'clues' && (
          <div className="gqa-tab-content">
            <div className="gqa-section">
              <h2 className="gqa-section-title">
                <i className="fas fa-puzzle-piece"></i> Clue-by-Clue Breakdown
              </h2>
              <div className="gqa-clue-list">
                {analytics.clueBreakdown.map((clue, index) => (
                  <div key={`${clue.catIdx}-${clue.clueIdx}`} className="gqa-clue-item">
                    <div 
                      className="gqa-clue-header"
                      onClick={() => setExpandedClue(expandedClue === index ? null : index)}
                    >
                      <div className="gqa-clue-info">
                        <span className="gqa-clue-round">Round #{clue.roundNumber}</span>
                        <span className="gqa-clue-category">{clue.categoryName}</span>
                        <span className="gqa-clue-prompt">{clue.prompt}</span>
                      </div>
                      <div className="gqa-clue-stats">
                        <span className="gqa-clue-points">{clue.points} pts</span>
                        <span className={`gqa-clue-accuracy ${clue.accuracyPct >= 70 ? 'high' : clue.accuracyPct >= 40 ? 'med' : 'low'}`}>
                          {clue.accuracyPct}% accuracy
                        </span>
                        <span className="gqa-clue-correct">{clue.correctCount} ✓</span>
                        <span className="gqa-clue-wrong">{clue.wrongCount} ✗</span>
                        <i className={`fas fa-chevron-${expandedClue === index ? 'up' : 'down'}`}></i>
                      </div>
                    </div>
                    {expandedClue === index && (
                      <div className="gqa-clue-details">
                        <h4>Team Responses:</h4>
                        <table className="gqa-mini-table">
                          <thead>
                            <tr>
                              <th>Team</th>
                              <th>Student</th>
                              <th>Answer</th>
                              <th>Result</th>
                              <th>Points</th>
                              <th>Time</th>
                            </tr>
                          </thead>
                          <tbody>
                            {clue.teamAttempts.map((attempt, i) => (
                              <tr key={i}>
                                <td>{attempt.teamName}</td>
                                <td>
                                  {attempt.studentName}
                                  {attempt.isOffline && <span className="offline-badge">Offline</span>}
                                </td>
                                <td className="answer-text">{attempt.submittedAnswer || '(no answer)'}</td>
                                <td>
                                  <span className={`result-badge ${attempt.isCorrect ? 'correct' : 'wrong'}`}>
                                    {attempt.isCorrect ? '✓ Correct' : '✗ Wrong'}
                                  </span>
                                </td>
                                <td className={attempt.pointsAwarded >= 0 ? 'points-positive' : 'points-negative'}>
                                  {attempt.pointsAwarded > 0 ? '+' : ''}{attempt.pointsAwarded}
                                </td>
                                <td>
                                  {attempt.responseTimeSec ? `${attempt.responseTimeSec.toFixed(1)}s` : 'N/A'}
                                  {attempt.wasAutoSubmitted && <span className="auto-badge">Auto</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Students Tab */}
        {activeTab === 'students' && (
          <div className="gqa-tab-content">
            <div className="gqa-section">
              <h2 className="gqa-section-title">
                <i className="fas fa-user-graduate"></i> Student Participation
              </h2>
              <div className="gqa-table-container">
                <table className="gqa-table">
                  <thead>
                    <tr>
                      <th>Student Name</th>
                      <th>Team</th>
                      <th>Type</th>
                      <th>Times Chosen</th>
                      <th>Correct</th>
                      <th>Wrong</th>
                      <th>Points Contributed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.studentParticipation.map(student => (
                      <tr key={student.studentId}>
                        <td className="student-name">{student.studentName}</td>
                        <td>{student.teamName}</td>
                        <td>
                          {student.isOffline ? (
                            <span className="offline-badge">Offline</span>
                          ) : (
                            <span className="online-badge">Online</span>
                          )}
                        </td>
                        <td>{student.timesChosen}</td>
                        <td className="correct">{student.correctAnswers}</td>
                        <td className="wrong">{student.wrongAnswers}</td>
                        <td className={student.totalPointsContributed >= 0 ? 'points-positive' : 'points-negative'}>
                          {student.totalPointsContributed > 0 ? '+' : ''}{student.totalPointsContributed}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Categories Tab */}
        {activeTab === 'categories' && (
          <div className="gqa-tab-content">
            <div className="gqa-section">
              <h2 className="gqa-section-title">
                <i className="fas fa-list"></i> Category Difficulty Analysis
              </h2>
              <div className="gqa-category-grid">
                {analytics.categoryPerformance.map(cat => {
                  const difficultyLevel = cat.accuracyPct >= 70 ? 'easy' : cat.accuracyPct >= 40 ? 'medium' : 'hard';
                  const difficultyLabel = cat.accuracyPct >= 70 ? 'Easy' : cat.accuracyPct >= 40 ? 'Medium' : 'Hard';
                  
                  return (
                    <div key={cat.categoryName} className={`gqa-category-card ${difficultyLevel}`}>
                      <h3 className="gqa-category-name">{cat.categoryName}</h3>
                      <div className="gqa-category-difficulty">
                        Difficulty: <strong>{difficultyLabel}</strong>
                      </div>
                      <div className="gqa-category-accuracy">
                        <div className="gqa-accuracy-circle" style={{ background: `conic-gradient(#10b981 ${cat.accuracyPct * 3.6}deg, #e5e7eb 0deg)` }}>
                          <span>{cat.accuracyPct}%</span>
                        </div>
                      </div>
                      <div className="gqa-category-stats">
                        <div className="gqa-stat">
                          <span className="label">Clues</span>
                          <span className="value">{cat.cluesAttempted}</span>
                        </div>
                        <div className="gqa-stat">
                          <span className="label">Correct</span>
                          <span className="value correct">{cat.correctCount}</span>
                        </div>
                        <div className="gqa-stat">
                          <span className="label">Wrong</span>
                          <span className="value wrong">{cat.wrongCount}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GridQuestAnalytics;

