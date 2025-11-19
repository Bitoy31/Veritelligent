import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import QuizForm from '../../components/QuizForm';
import '../../styles/quiz_management.css';
import QRCode from 'react-qr-code';
import TeacherProfile from '../../components/TeacherProfile';

interface Quiz {
  _id: string;
  title: string;
  description: string;
  subjectId: string;
  status: 'draft' | 'published' | 'closed';
  questions: any[];
  settings: any;
  dateCreated: string;
  lastModified: string;
}

const QuizManagement: React.FC = () => {
  const navigate = useNavigate();
  const { mode, quizId } = useParams<{ mode?: string; quizId?: string }>();
  const location = useLocation();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [subjects, setSubjects] = useState<any[]>([]);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrQuiz, setQrQuiz] = useState<Quiz | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        // Fetch quizzes
        const quizResponse = await fetch(`http://localhost:5000/api/quiz/teacher/${user._id}`);
        const quizData = await quizResponse.json();
        setQuizzes(quizData);

        // Fetch subjects
        const subjectResponse = await fetch(`http://localhost:5000/api/subjects?teacherId=${user._id}`);
        const subjectData = await subjectResponse.json();
        setSubjects(subjectData);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleCreateQuiz = async (quizData: any) => {
    try {
      const response = await fetch('http://localhost:5000/api/quiz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(quizData),
      });

      if (!response.ok) {
        throw new Error('Failed to create quiz');
      }

      const newQuiz = await response.json();
      setQuizzes([newQuiz, ...quizzes]);
    } catch (error) {
      console.error('Error creating quiz:', error);
      throw error;
    }
  };

  const handleUpdateQuiz = async (quizData: any) => {
    try {
      const response = await fetch(`http://localhost:5000/api/quiz/${quizId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(quizData),
      });

      if (!response.ok) {
        throw new Error('Failed to update quiz');
      }

      const updatedQuiz = await response.json();
      setQuizzes(quizzes.map(q => q._id === quizId ? updatedQuiz : q));
    } catch (error) {
      console.error('Error updating quiz:', error);
      throw error;
    }
  };

  const handleDeleteQuiz = async (quizId: string) => {
    if (!window.confirm('Are you sure you want to delete this quiz?')) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:5000/api/quiz/${quizId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const msg = data?.message || 'Failed to delete quiz';
        throw new Error(msg);
      }

      setQuizzes(quizzes.filter(q => q._id !== quizId));
    } catch (error) {
      console.error('Error deleting quiz:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete quiz');
    }
  };

  const handleStatusChange = async (quizId: string, newStatus: string) => {
    try {
      const response = await fetch(`http://localhost:5000/api/quiz/${quizId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update quiz status');
      }

      const updatedQuiz = await response.json();
      setQuizzes(quizzes.map(q => q._id === quizId ? updatedQuiz : q));
    } catch (error) {
      console.error('Error updating quiz status:', error);
      alert('Failed to update quiz status');
    }
  };

  const filteredQuizzes = quizzes
    .filter(quiz => 
      quiz.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (statusFilter === 'all' || quiz.status === statusFilter)
    )
    .sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());

  const getSubjectName = (subjectId: string) => {
    const subject = subjects.find(s => s._id === subjectId);
    return subject ? `${subject.code} - ${subject.name}` : 'Unknown Subject';
  };

  // Generate join link for QR code
  const getJoinLink = (quiz: Quiz) => {
    // You may want to use your deployed URL in production
    return `${window.location.origin}/student/quiz/${quiz._id}`;
  };

  // Check if we're on the create page
  if (location.pathname === '/teacher/quiz/create') {
    return (
      <div className="qm-container">
        <button className="qm-back-btn" onClick={() => navigate('/teacher/quiz')}>
          <i className="fas fa-arrow-left"></i> Back to Quizzes
        </button>
        <div className="qm-header">
          <h1 className="qm-title">Create New Quiz</h1>
          <p className="qm-subtitle">Design your quiz questions and settings</p>
        </div>
        <QuizForm onSubmit={handleCreateQuiz} />
      </div>
    );
  }

  // Check if we're on the edit page
  if (quizId) {
    const quiz = quizzes.find(q => q._id === quizId);
    return (
      <div className="qm-container">
        <button className="qm-back-btn" onClick={() => navigate('/teacher/quiz')}>
          <i className="fas fa-arrow-left"></i> Back to Quizzes
        </button>
        <div className="qm-header">
          <h1 className="qm-title">Edit Quiz</h1>
          <p className="qm-subtitle">Modify your quiz questions and settings</p>
        </div>
        {quiz ? (
          <QuizForm
            quizId={quizId}
            initialData={quiz}
            onSubmit={handleUpdateQuiz}
          />
        ) : (
          <div>Loading quiz data...</div>
        )}
      </div>
    );
  }

  // Default view - quiz list
  return (
    <div className="qm-container">
      <TeacherProfile />
      <button className="qm-back-btn" onClick={() => navigate('/teacher/solo-games')}>
        <i className="fas fa-arrow-left"></i> Back to Games
      </button>

      <div className="qm-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 className="qm-title">Quiz Management</h1>
          <p className="qm-subtitle">Create and manage your class quizzes</p>
        </div>
        <button className="qm-create-btn" onClick={() => navigate('/teacher/sessions')}>
          View Sessions
        </button>
      </div>

      <div className="qm-controls">
        <div className="qm-search-group">
          <input
            type="text"
            placeholder="Search quizzes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="qm-search-input"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="qm-status-select"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        <button
          className="qm-create-btn"
          onClick={() => navigate('/teacher/quiz/create')}
        >
          Create New Quiz
        </button>
      </div>

      {loading ? (
        <div className="qm-grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="qm-card qm-skeleton">
              <div className="qm-title-skeleton" />
              <div className="qm-desc-skeleton" />
              <div className="qm-meta-skeleton" />
            </div>
          ))}
        </div>
      ) : filteredQuizzes.length === 0 ? (
        <div className="qm-empty-state">
          <h3>No Quizzes Found</h3>
          <p>Get started by creating your first quiz!</p>
        </div>
      ) : (
        <div className="qm-grid">
          {filteredQuizzes.map((quiz) => (
            <div
              key={quiz._id}
              className={`qm-card${quiz.status === 'published' ? '' : ''}`}
              onClick={() => navigate(`/teacher/sessions?taskTitle=${encodeURIComponent(quiz.title)}`)}
              style={{ cursor: 'pointer' }}
            >
              <div className="qm-card-header">
                <h3 className="qm-card-title">{quiz.title}</h3>
                <span className={`qm-status-badge ${quiz.status}`}>{quiz.status.charAt(0).toUpperCase() + quiz.status.slice(1)}</span>
              </div>
              <div className="qm-card-content">
                <p className="qm-description">{quiz.description || 'No description'}</p>
                <div className="qm-meta">
                  <div className="qm-meta-item">
                    <i className="fas fa-book"></i>
                    <span>{getSubjectName(quiz.subjectId)}</span>
                  </div>
                  <div className="qm-meta-item">
                    <i className="fas fa-question-circle"></i>
                    <span>{quiz.questions.length} Questions</span>
                  </div>
                  <div className="qm-meta-item">
                    <i className="fas fa-clock"></i>
                    <span>Modified: {new Date(quiz.lastModified).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="qm-actions" onClick={e => e.stopPropagation()}>
                  {(quiz.status === 'draft' || quiz.status === 'closed') && (
                    <button
                      className="qm-action-btn qm-edit-btn"
                      onClick={() => navigate(`/teacher/quiz/edit/${quiz._id}`)}
                    >
                      Edit
                    </button>
                  )}
                  {quiz.status === 'draft' && (
                    <>
                      <button
                        className="qm-action-btn"
                        onClick={() => handleStatusChange(quiz._id, 'published')}
                      >
                        Publish
                      </button>
                      <button
                        className="qm-action-btn qm-delete-btn"
                        onClick={() => handleDeleteQuiz(quiz._id)}
                      >
                        Delete
                      </button>
                    </>
                  )}
                  {quiz.status === 'published' && (
                    <>
                      <button
                        className="qm-action-btn qm-host-btn"
                        onClick={() => navigate(`/teacher/quiz/host/${quiz._id}`)}
                      >
                        Host
                      </button>
                      <button
                        className="qm-action-btn"
                        onClick={() => handleStatusChange(quiz._id, 'closed')}
                      >
                        Close
                      </button>
                    </>
                  )}
                  {quiz.status === 'closed' && (
                    <>
                      <button
                        className="qm-action-btn"
                        onClick={() => handleStatusChange(quiz._id, 'published')}
                      >
                        Publish
                      </button>
                      <button
                        className="qm-action-btn qm-delete-btn"
                        onClick={() => handleDeleteQuiz(quiz._id)}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* QR Code Modal */}
      {qrModalOpen && qrQuiz && (
        <div className="qm-modal-overlay" onClick={() => setQrModalOpen(false)}>
          <div className="qm-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 350, width: '90%', textAlign: 'center' }}>
            <h2>Join Quiz: {qrQuiz.title}</h2>
            <QRCode value={getJoinLink(qrQuiz)} size={220} style={{ margin: '20px auto' }} />
            <div style={{ wordBreak: 'break-all', margin: '10px 0', fontSize: 14 }}>
              <span>Or visit: </span>
              <a href={getJoinLink(qrQuiz)} target="_blank" rel="noopener noreferrer">{getJoinLink(qrQuiz)}</a>
            </div>
            <button className="qm-btn qm-btn-secondary" onClick={() => setQrModalOpen(false)} style={{ marginTop: 16 }}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuizManagement; 