import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import '../../styles/results_leaderboard.css';
import '../../styles/quiz_analytics.css';
import { useDocumentTitle } from '../../utils/useDocumentTitle';

interface StudentAttempt {
  _id: string;
  studentId: {
    _id: string;
    userFname: string;
    userLname: string;
    userName: string;
  };
  status: string;
  finalScore: number;
  totalScore: number;
  bonusPoints: number;
  timeSpentSec: number;
  startedAt: string;
  answers: Array<{
    questionIndex: number;
    selectedOption: number;
    isCorrect: boolean;
    timeTakenSec: number; // Fixed: matches StudentLiveQuiz AnswerRecord
    pointsEarned: number;
  }>;
}

interface QuestionAnalysis {
  questionIndex: number;
  totalAttempts: number;
  correctAnswers: number;
  incorrectAnswers: number;
  averageTime: number;
  optionDistribution: Array<{
    option: string;
    count: number;
    percentage: number;
  }>;
}

const QuizSessionAnalytics: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [session, setSession] = useState<any>(null);
  const [attempts, setAttempts] = useState<StudentAttempt[]>([]);
  const [quiz, setQuiz] = useState<any>(null);
  useDocumentTitle('Quiz Analytics | Veritelligent');

  const subjectId = searchParams.get('subjectId');
  const taskId = searchParams.get('taskId');
  const sessionId = searchParams.get('sessionId');

  useEffect(() => {
    console.log('Analytics page loaded with params:', { subjectId, taskId, sessionId });
    
    if (!subjectId || !taskId || !sessionId) {
      setError('Missing required parameters');
      setLoading(false);
      return;
    }

    fetchSessionData();
    fetchAttemptsData();
    fetchQuizData();
  }, [subjectId, taskId, sessionId]);

  const fetchSessionData = async () => {
    try {
      setLoading(true);
      setError('');
      
      console.log('Fetching session data for:', { taskId, subjectId, sessionId });
      
      const response = await fetch(`http://localhost:5000/api/analytics/sessions?taskId=${taskId}&subjectId=${subjectId}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const sessions = await response.json();
      console.log('Sessions response:', sessions);
      
      const targetSession = sessions.find((s: any) => s._id === sessionId || s.id === sessionId);
      if (!targetSession) {
        throw new Error('Session not found');
      }
      
      console.log('Found target session:', targetSession);
      setSession(targetSession);
      
    } catch (err: any) {
      console.error('Failed to fetch session data:', err);
      setError(err.message || 'Failed to fetch session data');
    } finally {
      setLoading(false);
    }
  };

  const fetchAttemptsData = async () => {
    try {
      if (!sessionId) return;
      
      console.log('Fetching attempts for session:', sessionId);
      
      const response = await fetch(`http://localhost:5000/api/analytics/attempts?sessionId=${sessionId}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Attempts response:', data);
      
      setAttempts(Array.isArray(data) ? data : []);
      
    } catch (err: any) {
      console.error('Failed to fetch attempts:', err);
      setError(err.message || 'Failed to fetch attempts data');
    }
  };

  const fetchQuizData = async () => {
    try {
      if (!taskId) return;
      
      const response = await fetch(`http://localhost:5000/api/quiz/${taskId}`);
      if (response.ok) {
        const quizData = await response.json();
        setQuiz(quizData);
      }
    } catch (err) {
      console.error('Failed to fetch quiz data:', err);
    }
  };

  // Computed analytics data
  const analytics = useMemo(() => {
    console.log('=== ANALYTICS COMPUTATION DEBUG ===');
    console.log('Attempts:', attempts);
    console.log('Quiz:', quiz);
    
    if (!attempts.length || !quiz) {
      console.log('❌ No attempts or quiz data available');
      return null;
    }

    const completedAttempts = attempts.filter(a => a.status === 'completed');
    console.log('Completed attempts:', completedAttempts);
    
    const totalQuestions = quiz.questions?.length || 0;
    console.log('Total questions:', totalQuestions);
    
    // Student ranking
    const studentRanking = completedAttempts
      .map(attempt => {
        const accuracy = totalQuestions > 0 ? (attempt.answers?.filter(a => a.isCorrect).length / totalQuestions) * 100 : 0;
        const averageTimePerQuestion = totalQuestions > 0 ? attempt.timeSpentSec / totalQuestions : 0;
        
        console.log(`Student ${attempt.studentId?.userFname}:`, {
          finalScore: attempt.finalScore,
          answers: attempt.answers,
          correctAnswers: attempt.answers?.filter(a => a.isCorrect).length,
          accuracy,
          averageTimePerQuestion
        });
        
        return {
          ...attempt,
          accuracy,
          averageTimePerQuestion
        };
      })
      .sort((a, b) => b.finalScore - a.finalScore)
      .map((attempt, index) => ({ ...attempt, rank: index + 1 }));

    console.log('Student ranking:', studentRanking);
    
    // Question analysis
    const questionAnalysis: QuestionAnalysis[] = [];
    for (let i = 0; i < totalQuestions; i++) {
      const questionAttempts = completedAttempts.filter(a => a.answers?.some(ans => ans.questionIndex === i));
      const correctCount = questionAttempts.filter(a => 
        a.answers?.find(ans => ans.questionIndex === i)?.isCorrect
      ).length;
      
      const optionCounts = new Array(4).fill(0);
      questionAttempts.forEach(attempt => {
        const answer = attempt.answers?.find(ans => ans.questionIndex === i);
        if (answer && answer.selectedOption >= 0 && answer.selectedOption < 4) {
          optionCounts[answer.selectedOption]++;
        }
      });

      const totalAttemptsForQuestion = questionAttempts.length;
      const questionData = {
        questionIndex: i,
        totalAttempts: totalAttemptsForQuestion,
        correctAnswers: correctCount,
        incorrectAnswers: totalAttemptsForQuestion - correctCount,
        averageTime: questionAttempts.reduce((sum, a) => {
          const answer = a.answers?.find(ans => ans.questionIndex === i);
          return sum + (answer?.timeTakenSec || 0); // Fixed: use timeTakenSec instead of timeTaken
        }, 0) / totalAttemptsForQuestion || 0,
        optionDistribution: optionCounts.map((count, optionIndex) => ({
          option: ['A','B','C','D'][optionIndex],
          count,
          percentage: totalAttemptsForQuestion > 0 ? (count / totalAttemptsForQuestion) * 100 : 0
        }))
      };
      
      console.log(`Question ${i + 1} analysis:`, questionData);
      questionAnalysis.push(questionData);
    }

    const result = {
      studentRanking,
      questionAnalysis,
      totalStudents: attempts.length,
      completedStudents: completedAttempts.length,
      averageScore: completedAttempts.length > 0 
        ? Math.round(completedAttempts.reduce((sum, a) => sum + a.finalScore, 0) / completedAttempts.length)
        : 0,
      averageTime: completedAttempts.length > 0
        ? Math.round(completedAttempts.reduce((sum, a) => sum + a.timeSpentSec, 0) / completedAttempts.length)
        : 0
    };
    
    console.log('Final analytics result:', result);
    return result;
  }, [attempts, quiz]);

  const handleExport = () => {
    try {
      const lines: string[] = [];
      lines.push('Section,Field,Value');
      // Session metadata
      lines.push(`Session,Session ID,${sessionId || ''}`);
      lines.push(`Session,Subject,${session?.subjectId?.code || ''} ${session?.subjectId?.name || ''}`);
      lines.push(`Session,Task Title,${session?.taskId?.title || ''}`);
      lines.push(`Session,Status,${session?.status || ''}`);
      lines.push(`Session,Started,${session?.startedAt ? new Date(session.startedAt).toLocaleString() : ''}`);
      lines.push(`Session,Ended,${session?.endedAt ? new Date(session.endedAt).toLocaleString() : ''}`);

      // Overview stats
      if (analytics) {
        lines.push(`Overview,Total Students,${analytics.totalStudents}`);
        lines.push(`Overview,Completed Students,${analytics.completedStudents}`);
        lines.push(`Overview,Average Score,${analytics.averageScore}`);
        lines.push(`Overview,Average Time (sec),${analytics.averageTime}`);
      }

      // Student Ranking
      lines.push('');
      lines.push('Student Ranking,Rank,Student,Score,Bonus,Time Spent (sec),Avg Time/Question (sec),Accuracy (%)');
      (analytics?.studentRanking || []).forEach(attempt => {
        const studentName = `${attempt.studentId?.userFname || ''} ${attempt.studentId?.userLname || ''}`.trim();
        lines.push([
          'Student Ranking',
          attempt.rank,
          `"${studentName}"`,
          attempt.finalScore,
          attempt.bonusPoints || 0,
          attempt.timeSpentSec || 0,
          (attempt.averageTimePerQuestion || 0).toFixed(2),
          (attempt.accuracy || 0).toFixed(0)
        ].join(','));
      });

      // Question Analysis
      lines.push('');
      lines.push('Question Analysis,Question #,Total Attempts,Correct,Incorrect,Avg Time (sec),A Count,B Count,C Count,D Count');
      (analytics?.questionAnalysis || []).forEach(q => {
        const a = q.optionDistribution?.[0]?.count || 0;
        const b = q.optionDistribution?.[1]?.count || 0;
        const c = q.optionDistribution?.[2]?.count || 0;
        const d = q.optionDistribution?.[3]?.count || 0;
        lines.push([
          'Question Analysis',
          q.questionIndex + 1,
          q.totalAttempts,
          q.correctAnswers,
          q.incorrectAnswers,
          (q.averageTime || 0).toFixed(2),
          a, b, c, d
        ].join(','));
      });

      const csv = lines.join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const baseTitle = session?.taskId?.title || 'quiz-session';
      a.download = `${baseTitle}-analytics.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export failed:', e);
      alert('Failed to export analytics.');
    }
  };

  if (loading) {
  return (
    <div className="rlb-page">
      <div className="rlb-header">
          <h2>Quiz Session Analytics</h2>
          <div className="rlb-subtitle">Loading data...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rlb-page">
        <div className="rlb-header">
          <h2>Quiz Session Analytics</h2>
          <div className="rlb-subtitle" style={{ color: 'red' }}>{error}</div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="rlb-page">
        <div className="rlb-header">
          <h2>Quiz Session Analytics</h2>
          <div className="rlb-subtitle">Session not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="rlb-page quiz-analytics">
      <div className="rlb-header">
        <div>
          <h2>Quiz Session Analytics</h2>
          <div className="rlb-subtitle">
            {session.taskId?.title || 'Unknown Quiz'} • {session.subjectId?.code || 'Unknown'} • {session.subjectId?.name || 'Unknown Subject'}
          </div>
        </div>
        <div className="rlb-actions">
          <button className="rlb-btn rlb-btn-secondary" onClick={handleExport} title="Export analytics CSV">
            <i className="fas fa-download" aria-hidden="true"></i> Export
          </button>
          <button className="qm-back-btn" onClick={() => navigate(-1)} title="Back">
            <i className="fas fa-arrow-left"></i> Back
          </button>
        </div>
      </div>

      {/* Session Overview */}
      <section className="rlb-card">
        <div className="rlb-card-head">
          <h3>Session Overview</h3>
        </div>
        <div className="rlb-metrics">
          <div className="metric-card">
            <div className="metric-value">{analytics?.totalStudents || 0}</div>
            <div className="metric-label">Total Students</div>
          </div>
          <div className="metric-card">
            <div className="metric-value">{analytics?.completedStudents || 0}</div>
            <div className="metric-label">Completed</div>
        </div>
          <div className="metric-card">
            <div className="metric-value">{analytics?.averageScore || 0}</div>
            <div className="metric-label">Average Score</div>
          </div>
          <div className="metric-card">
            <div className="metric-value">
              {quiz?.questions?.reduce((sum: number, q: any) => sum + (q.points || 0), 0) || 0}
            </div>
            <div className="metric-label">Total Points</div>
          </div>
      </div>
      </section>

      {/* Student Ranking */}
      {analytics?.studentRanking && analytics.studentRanking.length > 0 && (
        <section className="rlb-card">
          <div className="rlb-card-head">
            <h3>Student Ranking & Performance</h3>
          </div>
          <div className="rlb-table-wrap">
            <table className="rlb-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Student Name</th>
                  <th>Score</th>
                  <th>Time Spent</th>
                  <th>Avg. Time/Question</th>
                  <th>Performance</th>
                </tr>
              </thead>
              <tbody>
                {analytics.studentRanking.map((attempt) => (
                  <tr key={attempt._id}>
                    <td>
                      <span className="rlb-badge rlb-badge-info">
                        #{attempt.rank}
                      </span>
                    </td>
                    <td>
                      <strong>{attempt.studentId?.userFname} {attempt.studentId?.userLname}</strong>
                      <br />
                      <small style={{ color: '#666' }}>@{attempt.studentId?.userName}</small>
                    </td>
                    <td>
                      <strong style={{ fontSize: '1.2em' }}>
                        {attempt.finalScore}/{quiz?.questions?.reduce((sum: number, q: any) => sum + (q.points || 0), 0) || 0}
                      </strong>
                      {attempt.bonusPoints > 0 && (
                        <span style={{ fontSize: '0.8em', color: '#10b981' }}>
                          (+{attempt.bonusPoints})
                        </span>
                      )}
                    </td>
                    {/* Accuracy cell removed per request */}
                    <td>
                      {attempt.timeSpentSec ? `${Math.round(attempt.timeSpentSec / 60)}m ${attempt.timeSpentSec % 60}s` : '-'}
                    </td>
                    <td>
                      {attempt.averageTimePerQuestion ? `${attempt.averageTimePerQuestion.toFixed(1)}s` : '-'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ 
                          width: '60px', 
                          height: '8px', 
                          background: '#e5e7eb', 
                          borderRadius: '4px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${attempt.accuracy}%`,
                            height: '100%',
                            background: attempt.accuracy >= 80 ? '#10b981' : 
                                       attempt.accuracy >= 60 ? '#3b82f6' : '#f59e0b'
                          }} />
                        </div>
                        <span style={{ fontSize: '0.8em', color: '#666' }}>
                          {attempt.accuracy.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Question Analysis */}
      {analytics?.questionAnalysis && analytics.questionAnalysis.length > 0 && (
        <section className="rlb-card">
          <div className="rlb-card-head">
            <h3>Question Analysis</h3>
          </div>
          <div style={{ padding: '1rem' }}>
            {analytics.questionAnalysis.map((question, index) => (
              <div key={index} style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 1rem 0', color: '#374151' }}>
                  Question {question.questionIndex + 1}
                  {quiz?.questions?.[question.questionIndex]?.text && (
                    <span style={{ fontSize: '0.9em', fontWeight: 'normal', color: '#6b7280', marginLeft: '0.5rem' }}>
                      "{quiz.questions[question.questionIndex].text.substring(0, 50)}..."
                    </span>
                  )}
                </h4>
                
                <div className="qsa-question-grid">
                  <div>
                    <h5 style={{ margin: '0 0 0.5rem 0', color: '#6b7280' }}>Performance Summary</h5>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                      <div style={{ textAlign: 'center', padding: '0.5rem', background: '#f3f4f6', borderRadius: '4px' }}>
                        <div style={{ fontSize: '1.2em', fontWeight: 'bold', color: '#10b981' }}>
                          {question.correctAnswers}
                        </div>
                        <div style={{ fontSize: '0.8em', color: '#6b7280' }}>Correct</div>
                      </div>
                      <div style={{ textAlign: 'center', padding: '0.5rem', background: '#f3f4f6', borderRadius: '4px' }}>
                        <div style={{ fontSize: '1.2em', fontWeight: 'bold', color: '#ef4444' }}>
                          {question.incorrectAnswers}
                        </div>
                        <div style={{ fontSize: '0.8em', color: '#6b7280' }}>Incorrect</div>
                      </div>
                    </div>
                    <div style={{ marginTop: '0.5rem', fontSize: '0.9em', color: '#6b7280' }}>
                      Success Rate: {question.totalAttempts > 0 ? ((question.correctAnswers / question.totalAttempts) * 100).toFixed(1) : 0}%
                    </div>
                    <div style={{ fontSize: '0.9em', color: '#6b7280' }}>
                      Avg. Time: {question.averageTime.toFixed(1)}s
                    </div>
                  </div>
                  
                  <div>
                    <h5 style={{ margin: '0 0 0.5rem 0', color: '#6b7280' }}>Answer Distribution</h5>
                    <div style={{ width: '100%', maxWidth: 520, margin: '0 auto' }}>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={question.optionDistribution} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" domain={[0, 'dataMax + 1']} allowDecimals={false} />
                          <YAxis type="category" dataKey="option" width={30} />
                          <Tooltip />
                          <Bar dataKey="count" fill="#3b82f6" barSize={14} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ fontSize: '0.8em', color: '#6b7280', textAlign: 'center' }}>
                      A: {question.optionDistribution[0]?.count || 0} | 
                      B: {question.optionDistribution[1]?.count || 0} | 
                      C: {question.optionDistribution[2]?.count || 0} | 
                      D: {question.optionDistribution[3]?.count || 0}
                    </div>
                  </div>
                </div>

                {/* Legend mapping A–D to option texts */}
                <div style={{ fontSize: '0.85em', color: '#4b5563' }}>
                  <strong>Legend:</strong>
                  <span style={{ marginLeft: 8 }}>A = {quiz?.questions?.[question.questionIndex]?.options?.[0]?.text || '-'}</span>
                  <span style={{ marginLeft: 12 }}>B = {quiz?.questions?.[question.questionIndex]?.options?.[1]?.text || '-'}</span>
                  <span style={{ marginLeft: 12 }}>C = {quiz?.questions?.[question.questionIndex]?.options?.[2]?.text || '-'}</span>
                  <span style={{ marginLeft: 12 }}>D = {quiz?.questions?.[question.questionIndex]?.options?.[3]?.text || '-'}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}


      {/* Performance Metrics */}
      {analytics && (
        <section className="rlb-card">
          <div className="rlb-card-head">
            <h3>Performance Metrics</h3>
          </div>
          <div style={{ padding: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div style={{ padding: '1rem', background: '#f3f4f6', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#10b981' }}>
                  {analytics.completedStudents > 0 ? ((analytics.completedStudents / analytics.totalStudents) * 100).toFixed(1) : 0}%
                </div>
                <div style={{ color: '#6b7280' }}>Completion Rate</div>
              </div>
              
              <div style={{ padding: '1rem', background: '#f3f4f6', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#3b82f6' }}>
                  {analytics.averageScore}
                </div>
                <div style={{ color: '#6b7280' }}>Average Score</div>
              </div>
              
              <div style={{ padding: '1rem', background: '#f3f4f6', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#f59e0b' }}>
                  {analytics.averageTime ? `${Math.round(analytics.averageTime / 60)}m ${analytics.averageTime % 60}s` : '-'}
                </div>
                <div style={{ color: '#6b7280' }}>Average Time</div>
              </div>
              
              <div style={{ padding: '1rem', background: '#f3f4f6', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#8b5cf6' }}>
                  {analytics.studentRanking?.[0]?.finalScore || 0}
                </div>
                <div style={{ color: '#6b7280' }}>Highest Score</div>
              </div>
            </div>
            </div>
          </section>
      )}

    </div>
  );
};

export default QuizSessionAnalytics;
