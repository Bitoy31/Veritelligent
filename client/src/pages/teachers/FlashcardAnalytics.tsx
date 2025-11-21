import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../../styles/flashcard_analytics.css';
import { useDocumentTitle } from '../../utils/useDocumentTitle';

const FlashcardAnalytics: React.FC = () => {
  useDocumentTitle('Flashcard Analytics | Veritelligent');
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAnalytics();
  }, [sessionId]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      console.log('Fetching flashcard analytics for session:', sessionId);
      const response = await fetch(`https://api.veritelligent.fun/api/flashcard/analytics/${sessionId}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to fetch analytics:', response.status, errorData);
        throw new Error(errorData.error || `Failed to fetch analytics (${response.status})`);
      }

      const analyticsData = await response.json();
      console.log('Flashcard analytics data received:', analyticsData);
      setData(analyticsData);
    } catch (err: any) {
      console.error('Error in fetchAnalytics:', err);
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!data) return;

    const csv = generateCSV(data);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flashcard-analytics-${sessionId}.csv`;
    a.click();
  };

  const generateCSV = (data: any) => {
    let csv = 'Flashcard Session Analytics\n\n';
    csv += `Task: ${data.session.taskTitle}\n`;
    csv += `Subject: ${data.session.subjectLabel}\n`;
    csv += `Date: ${new Date(data.session.startedAt).toLocaleString()}\n\n`;
    
    csv += 'Student Participation\n';
    csv += 'Student,Turns,Correct,Wrong,Points,Life Cards Used,Helped Others\n';
    data.studentParticipation.forEach((s: any) => {
      csv += `${s.studentName},${s.turnsTaken},${s.correctAnswers},${s.incorrectAnswers},${s.totalPoints},${s.lifeCardsUsed.callFriend + s.lifeCardsUsed.hint + s.lifeCardsUsed.redraw},${s.helpedOthers}\n`;
    });

    return csv;
  };

  if (loading) {
    return (
      <div className="fca-page">
        <div className="fca-loading">
          <i className="fas fa-spinner fa-spin"></i>
          <p>Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fca-page">
        <div className="fca-error">
          <i className="fas fa-exclamation-circle"></i>
          <h3>Error Loading Analytics</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="fca-page">
      {/* Header */}
      <div className="fca-header">
        <div className="fca-header-content">
          <button className="fca-back-btn" onClick={() => navigate('/teacher/sessions')}>
            <i className="fas fa-arrow-left"></i> Back to Sessions
          </button>
          <div className="fca-header-info">
            <h1>{data.session.taskTitle}</h1>
            <div className="fca-header-meta">
              <span><i className="fas fa-book"></i> {data.session.subjectLabel}</span>
              <span><i className="fas fa-calendar"></i> {new Date(data.session.startedAt).toLocaleDateString()}</span>
              <span><i className="fas fa-clock"></i> {data.session.durationMinutes || 0} min</span>
            </div>
          </div>
        </div>
        <button className="fca-btn-export" onClick={handleExport}>
          <i className="fas fa-download"></i> Export CSV
        </button>
      </div>

      {/* Summary Cards */}
      <div className="fca-summary">
        <div className="fca-card fca-card-primary">
          <div className="fca-card-icon"><i className="fas fa-users"></i></div>
          <div className="fca-card-content">
            <div className="fca-card-value">{data.summary.totalStudents}</div>
            <div className="fca-card-label">Students</div>
          </div>
        </div>
        <div className="fca-card fca-card-info">
          <div className="fca-card-icon"><i className="fas fa-question-circle"></i></div>
          <div className="fca-card-content">
            <div className="fca-card-value">{data.summary.totalQuestions}</div>
            <div className="fca-card-label">Questions</div>
          </div>
        </div>
        <div className="fca-card fca-card-success">
          <div className="fca-card-icon"><i className="fas fa-check-circle"></i></div>
          <div className="fca-card-content">
            <div className="fca-card-value">{data.summary.accuracyPct}%</div>
            <div className="fca-card-label">Accuracy</div>
          </div>
        </div>
        <div className="fca-card fca-card-warning">
          <div className="fca-card-icon"><i className="fas fa-hands-helping"></i></div>
          <div className="fca-card-content">
            <div className="fca-card-value">{data.summary.callFriendSuccessRate || 0}%</div>
            <div className="fca-card-label">Call Friend Success</div>
          </div>
        </div>
      </div>

      {/* Life Cards Usage */}
      <div className="fca-section">
        <h2 className="fca-section-title">Life Cards Used</h2>
        <div className="fca-summary">
          <div className="fca-card">
            <div className="fca-card-icon" style={{ color: '#4ecdc4' }}><i className="fas fa-phone"></i></div>
            <div className="fca-card-content">
              <div className="fca-card-value">{data.summary.lifeCardsUsed.callFriend}</div>
              <div className="fca-card-label">Call a Friend</div>
            </div>
          </div>
          <div className="fca-card">
            <div className="fca-card-icon" style={{ color: '#f7b731' }}><i className="fas fa-lightbulb"></i></div>
            <div className="fca-card-content">
              <div className="fca-card-value">{data.summary.lifeCardsUsed.hint}</div>
              <div className="fca-card-label">Hint</div>
            </div>
          </div>
          <div className="fca-card">
            <div className="fca-card-icon" style={{ color: '#9b59b6' }}><i className="fas fa-sync-alt"></i></div>
            <div className="fca-card-content">
              <div className="fca-card-value">{data.summary.lifeCardsUsed.redraw}</div>
              <div className="fca-card-label">Re-draw</div>
            </div>
          </div>
        </div>
      </div>

      {/* Student Participation Table */}
      <div className="fca-section">
        <h2 className="fca-section-title">Student Participation</h2>
        <div className="fca-table-container">
          <table className="fca-table">
            <thead>
              <tr>
                <th className="fca-left">Student</th>
                <th className="fca-center">Turns</th>
                <th className="fca-center">Correct</th>
                <th className="fca-center">Wrong</th>
                <th className="fca-center">Points</th>
                <th className="fca-center">Life Cards</th>
                <th className="fca-center">Helped Others</th>
              </tr>
            </thead>
            <tbody>
              {data.studentParticipation.map((student: any, idx: number) => (
                <tr key={idx}>
                  <td className="fca-left">{student.studentName}</td>
                  <td className="fca-center">{student.turnsTaken}</td>
                  <td className="fca-center fca-correct">{student.correctAnswers}</td>
                  <td className="fca-center fca-wrong">{student.incorrectAnswers}</td>
                  <td className="fca-center fca-score">{student.totalPoints}</td>
                  <td className="fca-center">
                    {student.lifeCardsUsed.callFriend + student.lifeCardsUsed.hint + student.lifeCardsUsed.redraw}
                  </td>
                  <td className="fca-center">{student.helpedOthers} ({student.helpedCorrectly} ✓)</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Question Breakdown */}
      <div className="fca-section">
        <h2 className="fca-section-title">Question Breakdown</h2>
        <div className="fca-question-list">
          {data.questionBreakdown.map((q: any) => (
            <div key={q.questionIndex} className="fca-question-item">
              <div className="fca-question-header">
                <div className="fca-question-info">
                  <span className="fca-question-number">Q{q.questionIndex + 1}</span>
                  <span className="fca-question-text">{q.questionText}</span>
                </div>
                <div className="fca-question-stats">
                  <span className="fca-question-points">{q.points} pts</span>
                  <span className={`fca-question-accuracy ${q.accuracyPct >= 70 ? 'high' : q.accuracyPct >= 40 ? 'med' : 'low'}`}>
                    {q.accuracyPct}%
                  </span>
                </div>
              </div>
              <div className="fca-question-details">
                <span className="fca-correct">✓ {q.correctAttempts}</span>
                <span className="fca-wrong">✗ {q.incorrectAttempts}</span>
                {q.avgTimeSec && <span>⏱ {q.avgTimeSec}s avg</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FlashcardAnalytics;

