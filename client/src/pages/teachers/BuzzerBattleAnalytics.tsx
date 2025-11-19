import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../../styles/buzzer_analytics.css';
import { useDocumentTitle } from '../../utils/useDocumentTitle';

interface Analytics {
  session: {
    sessionId: string;
    roomCode: string;
    taskTitle: string;
    startedAt: string;
    endedAt: string;
    durationMinutes: number;
    status: string;
    teacher: string;
  };
  summary: {
    totalQuestions: number;
    totalBuzzes: number;
    totalTeams: number;
    totalPlayers: number;
    stealsAttempted: number;
    stealsSuccessful: number;
    teamsFrozen: number;
  };
  teams: Array<{
    teamId: string;
    teamName: string;
    finalScore: number;
    members: string[];
    memberCount: number;
    statistics: {
      questionsAnswered: number;
      correctAnswers: number;
      wrongAnswers: number;
      accuracyPct: number;
      avgBuzzTimeSec: number;
      stealsAttempted: number;
      stealsSuccessful: number;
      stealSuccessRate: number;
      longestStreak: number;
      timesFrozen: number;
    };
  }>;
  questionBreakdown: Array<{
    questionIndex: number;
    questionText: string;
    points: number;
    difficulty: string;
    category: string;
    totalBuzzes: number;
    correctBuzzes: number;
    wrongBuzzes: number;
    wasStolen: boolean;
    firstBuzzTeam: string;
    firstBuzzTimeMs: number;
    firstBuzzWasPartial: boolean;
    firstBuzzCorrect: boolean;
    answeredBy?: string;
    teamAttempts?: Array<{
      teamName: string;
      teamId: string;
      studentId?: string;
      studentName?: string;
      answeredBy?: string;
      answeredByName?: string;
      buzzTimeMs: number;
      sawFullQuestion: boolean;
      submittedAnswer: string;
      isCorrect: boolean;
      pointsAwarded: number;
      wasSteal: boolean;
      responseTimeSec: number;
    }>;
  }>;
}

const BuzzerBattleAnalytics: React.FC = () => {
  useDocumentTitle('Buzzer Battle Analytics | Veritelligent');
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'teams' | 'questions'>('overview');

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await fetch(`http://localhost:5000/api/buzzerbattle/sessions/${sessionId}/analytics`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch analytics');
        }
        
        const data = await response.json();
        setAnalytics(data);
      } catch (err: any) {
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
      const response = await fetch(`http://localhost:5000/api/buzzerbattle/sessions/${sessionId}/export`);
      
      if (!response.ok) {
        throw new Error('Failed to export data');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `buzzer-battle-${sessionId}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to export analytics');
    }
  };

  if (loading) {
    return (
      <div className="bba-page">
        <div className="bba-loading">
          <i className="fas fa-spinner fa-spin"></i>
          <p>Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="bba-page">
        <div className="bba-error">
          <i className="fas fa-exclamation-circle"></i>
          <h3>Error Loading Analytics</h3>
          <p>{error || 'Analytics data not found'}</p>
          <button onClick={() => navigate('/teacher/buzzer-battle')}>
            Back to Management
          </button>
        </div>
      </div>
    );
  }

  const sortedTeams = [...analytics.teams].sort((a, b) => b.finalScore - a.finalScore);

  return (
    <div className="bba-page">
      {/* Header */}
      <div className="bba-header">
        <button className="bba-back-btn" onClick={() => navigate('/teacher/sessions')}>
          <i className="fas fa-arrow-left"></i> Back
        </button>
        <div className="bba-header-content">
          <h1>Buzzer Battle Analytics</h1>
          <p className="bba-subtitle">{analytics.session.taskTitle}</p>
        </div>  
        <button className="bba-export-btn" onClick={handleExport}>
          <i className="fas fa-download"></i> Export to Excel
        </button>
      </div>

      {/* Session Info */}
      <div className="bba-session-info">
        <div className="bba-info-item">
          <i className="fas fa-clock"></i>
          <div>
            <strong>Duration</strong>
            <span>{analytics.session.durationMinutes} minutes</span>
          </div>
        </div>
        <div className="bba-info-item">
          <i className="fas fa-users"></i>
          <div>
            <strong>Players</strong>
            <span>{analytics.summary.totalPlayers} students</span>
          </div>
        </div>
        <div className="bba-info-item">
          <i className="fas fa-users-cog"></i>
          <div>
            <strong>Teams</strong>
            <span>{analytics.summary.totalTeams} teams</span>
          </div>
        </div>
        <div className="bba-info-item">
          <i className="fas fa-question-circle"></i>
          <div>
            <strong>Questions</strong>
            <span>{analytics.summary.totalQuestions} total</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bba-tabs">
        <button
          className={activeTab === 'overview' ? 'active' : ''}
          onClick={() => setActiveTab('overview')}
        >
          <i className="fas fa-chart-pie"></i> Overview
        </button>
        <button
          className={activeTab === 'teams' ? 'active' : ''}
          onClick={() => setActiveTab('teams')}
        >
          <i className="fas fa-users"></i> Teams
        </button>
        <button
          className={activeTab === 'questions' ? 'active' : ''}
          onClick={() => setActiveTab('questions')}
        >
          <i className="fas fa-list"></i> Questions
        </button>
      </div>

      {/* Tab Content */}
      <div className="bba-content">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="bba-overview">
            <div className="bba-stats-grid">
              <div className="bba-stat-card">
                <i className="fas fa-bell"></i>
                <div className="bba-stat-value">{analytics.summary.totalBuzzes}</div>
                <div className="bba-stat-label">Total Buzzes</div>
              </div>
              <div className="bba-stat-card">
                <i className="fas fa-bolt"></i>
                <div className="bba-stat-value">{analytics.summary.stealsAttempted}</div>
                <div className="bba-stat-label">Steal Attempts</div>
              </div>
              <div className="bba-stat-card">
                <i className="fas fa-check-circle"></i>
                <div className="bba-stat-value">{analytics.summary.stealsSuccessful}</div>
                <div className="bba-stat-label">Successful Steals</div>
              </div>
              <div className="bba-stat-card">
                <i className="fas fa-snowflake"></i>
                <div className="bba-stat-value">{analytics.summary.teamsFrozen}</div>
                <div className="bba-stat-label">Teams Frozen</div>
              </div>
            </div>

            <div className="bba-section">
              <h3>Top Teams</h3>
              {sortedTeams.slice(0, 3).map((team, index) => (
                <div key={team.teamId} className={`bba-top-team rank-${index + 1}`}>
                  <div className="bba-rank-badge">#{index + 1}</div>
                  <div className="bba-team-info">
                    <h4>{team.teamName}</h4>
                    <p>{team.memberCount} members</p>
                  </div>
                  <div className="bba-team-score">{team.finalScore} pts</div>
                </div>
              ))}
            </div>

            <div className="bba-section">
              <h3>Quick Stats</h3>
              <div className="bba-quick-stats">
                <div className="bba-quick-stat">
                  <span>Avg Buzz Time</span>
                  <strong>
                    {(analytics.teams.reduce((sum, t) => sum + (t.statistics.avgBuzzTimeSec || 0), 0) / analytics.teams.length).toFixed(2)}s
                  </strong>
                </div>
                <div className="bba-quick-stat">
                  <span>Steal Success Rate</span>
                  <strong>
                    {analytics.summary.stealsAttempted > 0
                      ? Math.round((analytics.summary.stealsSuccessful / analytics.summary.stealsAttempted) * 100)
                      : 0}%
                  </strong>
                </div>
                <div className="bba-quick-stat">
                  <span>Questions with Steals</span>
                  <strong>{analytics.questionBreakdown.filter(q => q.wasStolen).length}</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Teams Tab */}
        {activeTab === 'teams' && (
          <div className="bba-teams">
            {sortedTeams.map((team, index) => (
              <div key={team.teamId} className="bba-team-card">
                <div className="bba-team-header">
                  <div className="bba-team-rank">#{index + 1}</div>
                  <div className="bba-team-title">
                    <h3>{team.teamName}</h3>
                    <p>{team.members.join(', ')}</p>
                  </div>
                  <div className="bba-team-final-score">{team.finalScore} pts</div>
                </div>
                
                <div className="bba-team-stats">
                  <div className="bba-team-stat">
                    <div className="bba-team-stat-label">Questions Answered</div>
                    <div className="bba-team-stat-value">{team.statistics.questionsAnswered}</div>
                  </div>
                  <div className="bba-team-stat">
                    <div className="bba-team-stat-label">Accuracy</div>
                    <div className="bba-team-stat-value">{team.statistics.accuracyPct}%</div>
                  </div>
                  <div className="bba-team-stat">
                    <div className="bba-team-stat-label">Correct</div>
                    <div className="bba-team-stat-value success">{team.statistics.correctAnswers}</div>
                  </div>
                  <div className="bba-team-stat">
                    <div className="bba-team-stat-label">Wrong</div>
                    <div className="bba-team-stat-value error">{team.statistics.wrongAnswers}</div>
                  </div>
                  <div className="bba-team-stat">
                    <div className="bba-team-stat-label">Avg Buzz Time</div>
                    <div className="bba-team-stat-value">
                      {team.statistics.avgBuzzTimeSec ? `${team.statistics.avgBuzzTimeSec}s` : 'N/A'}
                    </div>
                  </div>
                  <div className="bba-team-stat">
                    <div className="bba-team-stat-label">Longest Streak</div>
                    <div className="bba-team-stat-value">{team.statistics.longestStreak}</div>
                  </div>
                  <div className="bba-team-stat">
                    <div className="bba-team-stat-label">Steals</div>
                    <div className="bba-team-stat-value">
                      {team.statistics.stealsSuccessful}/{team.statistics.stealsAttempted}
                    </div>
                  </div>
                  <div className="bba-team-stat">
                    <div className="bba-team-stat-label">Times Frozen</div>
                    <div className="bba-team-stat-value">{team.statistics.timesFrozen}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Questions Tab */}
        {activeTab === 'questions' && (
          <div className="bba-questions">
            {analytics.questionBreakdown.map((question, index) => (
              <div key={index} className="bba-question-card">
                <div className="bba-question-header">
                  <span className="bba-question-number">Q{index + 1}</span>
                  <span className="bba-question-points">{question.points} pts</span>
                  <span className={`bba-question-difficulty ${question.difficulty}`}>
                    {question.difficulty}
                  </span>
                  {question.category && (
                    <span className="bba-question-category">{question.category}</span>
                  )}
                </div>
                
                <div className="bba-question-text">{question.questionText}</div>
                
                <div className="bba-question-stats">
                  <div className="bba-q-stat">
                    <i className="fas fa-bell"></i>
                    <span>{question.totalBuzzes} buzzes</span>
                  </div>
                  <div className="bba-q-stat success">
                    <i className="fas fa-check"></i>
                    <span>{question.correctBuzzes} correct</span>
                  </div>
                  <div className="bba-q-stat error">
                    <i className="fas fa-times"></i>
                    <span>{question.wrongBuzzes} wrong</span>
                  </div>
                  {question.wasStolen && (
                    <div className="bba-q-stat steal">
                      <i className="fas fa-bolt"></i>
                      <span>Stolen</span>
                    </div>
                  )}
                </div>
                
                <div className="bba-question-first-buzz">
                  <strong>First Buzz:</strong> {question.firstBuzzTeam} 
                  ({(question.firstBuzzTimeMs / 1000).toFixed(2)}s)
                  {question.firstBuzzWasPartial && ' - Partial'}
                  {question.firstBuzzCorrect ? ' ✓' : ' ✗'}
                </div>
                
                {question.answeredBy && (
                  <div className="bba-question-answered-by">
                    <strong>Answered By:</strong> {question.answeredBy}
                  </div>
                )}
                
                {question.teamAttempts && question.teamAttempts.length > 0 && (
                  <div className="bba-question-attempts">
                    <strong>All Attempts:</strong>
                    <ul className="bba-attempts-list">
                      {question.teamAttempts.map((attempt, idx) => (
                        <li key={idx} className={attempt.isCorrect ? 'correct' : 'wrong'}>
                          <span className="bba-attempt-team">{attempt.teamName}</span>
                          {attempt.studentName && (
                            <span className="bba-attempt-buzzer"> (Buzzed: {attempt.studentName})</span>
                          )}
                          {attempt.answeredByName && attempt.answeredByName !== attempt.studentName && (
                            <span className="bba-attempt-answerer"> → Answered: {attempt.answeredByName}</span>
                          )}
                          {!attempt.answeredByName && attempt.studentName && (
                            <span className="bba-attempt-answerer"> → Answered: {attempt.studentName}</span>
                          )}
                          <span className="bba-attempt-answer"> - "{attempt.submittedAnswer}"</span>
                          <span className={`bba-attempt-result ${attempt.isCorrect ? 'correct' : 'wrong'}`}>
                            {attempt.isCorrect ? ' ✓' : ' ✗'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BuzzerBattleAnalytics;

