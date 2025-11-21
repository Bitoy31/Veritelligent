import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../../styles/student_quiz.css';

interface Question {
  text: string;
  options: {
    text: string;
    isCorrect: boolean;
  }[];
  points: number;
  timeLimit: number;
}

interface Quiz {
  _id: string;
  title: string;
  description: string;
  questions: Question[];
  settings: {
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
    showFeedbackAfterEach: boolean;
    timeLimit: number;
    passingScore: number;
    allowRetake: boolean;
    maxAttempts: number;
  };
}

const QuizTaking: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<number[][]>([]);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [questionTimeLeft, setQuestionTimeLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        const response = await fetch(`https://api.veritelligent.fun/api/quiz/${quizId}`);
        const data = await response.json();
        
        // Shuffle questions if enabled
        let questions = [...data.questions];
        if (data.settings.shuffleQuestions) {
          questions = shuffleArray(questions);
        }
        
        // Shuffle options for each question if enabled
        if (data.settings.shuffleOptions) {
          questions = questions.map(q => ({
            ...q,
            options: shuffleArray(q.options)
          }));
        }
        
        setQuiz({ ...data, questions });
        setAnswers(new Array(questions.length).fill([]));
        
        // Set overall quiz timer if enabled
        if (data.settings.timeLimit > 0) {
          setTimeLeft(data.settings.timeLimit * 60); // Convert minutes to seconds
        }
        
        // Set question timer if the first question has a time limit
        if (questions[0]?.timeLimit > 0) {
          setQuestionTimeLeft(questions[0].timeLimit);
        }
      } catch (error) {
        console.error('Failed to fetch quiz:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [quizId]);

  // Overall quiz timer effect
  useEffect(() => {
    if (!timeLeft || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev: number | null) => {
        if (!prev || prev <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  // Question timer effect
  useEffect(() => {
    if (!questionTimeLeft || questionTimeLeft <= 0 || !quiz) return;

    const timer = setInterval(() => {
      setQuestionTimeLeft((prev: number | null) => {
        if (!prev || prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [questionTimeLeft, quiz]);

  // Handle question timer timeout
  useEffect(() => {
    if (questionTimeLeft === 0 && quiz) {
      // Auto-move to next question when time is up (no points for unanswered)
      const timeoutId = setTimeout(() => {
        if (currentQuestion < quiz.questions.length - 1) {
          setCurrentQuestion(prevQuestion => prevQuestion + 1);
        } else {
          // If it's the last question, submit the quiz
          handleSubmit();
        }
      }, 100); // Small delay to ensure state consistency

      return () => clearTimeout(timeoutId);
    }
  }, [questionTimeLeft, currentQuestion, quiz]);

  // Reset question timer when question changes
  useEffect(() => {
    if (quiz && quiz.questions[currentQuestion]?.timeLimit > 0) {
      setQuestionTimeLeft(quiz.questions[currentQuestion].timeLimit);
    } else {
      setQuestionTimeLeft(null);
    }
  }, [currentQuestion, quiz]);

  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const handleAnswerSelect = (optionIndex: number) => {
    if (!quiz || currentQuestion >= quiz.questions.length) return;
    
    const newAnswers = [...answers];
    const currentAnswers = newAnswers[currentQuestion] || [];
    
    // Toggle answer selection
    if (currentAnswers.includes(optionIndex)) {
      newAnswers[currentQuestion] = currentAnswers.filter(i => i !== optionIndex);
    } else {
      newAnswers[currentQuestion] = [...currentAnswers, optionIndex];
    }
    
    setAnswers(newAnswers);
  };

  const handleSubmit = async () => {
    if (!quiz) return;
    
    setSubmitting(true);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const response = await fetch('https://api.veritelligent.fun/api/quiz/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quizId,
          studentId: user._id,
          answers: answers.map((selectedIndices, questionIndex) => ({
            questionIndex,
            selectedOptions: selectedIndices,
          })),
          timeSpent: quiz.settings.timeLimit * 60 - (timeLeft || 0),
        }),
      });

      if (!response.ok) throw new Error('Failed to submit quiz');

      const result = await response.json();
      navigate(`/student/quiz/${quizId}/results`, { state: { result } });
    } catch (error) {
      console.error('Error submitting quiz:', error);
    }
  };

  if (loading || !quiz) {
    return (
      <div className="quiz-taking">
        <div className="loading">
          <i className="fas fa-spinner fa-spin"></i>
          <span>Loading quiz...</span>
        </div>
      </div>
    );
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="quiz-taking">
      <button 
        className="back-button"
        onClick={() => navigate(-1)}
        style={{
          position: 'absolute',
          top: '1rem',
          left: '1rem',
          background: 'rgba(255, 255, 255, 0.9)',
          border: 'none',
          borderRadius: '50px',
          padding: '0.75rem 1.5rem',
          fontSize: '0.9rem',
          fontWeight: '600',
          color: '#4a5568',
          cursor: 'pointer',
          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)',
          backdropFilter: 'blur(10px)',
          transition: 'all 0.3s ease',
          zIndex: 10
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.15)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.1)';
        }}
      >
        <i className="fas fa-arrow-left" style={{ marginRight: '0.5rem' }}></i>
        Back to Quizzes
      </button>
      
      <div className="quiz-header">
        <h2>{quiz.title}</h2>
        <div className="timer-container">
          {/* Question Timer */}
          {questionTimeLeft !== null && questionTimeLeft > 0 && (
            <div className={`timer question-timer ${
              questionTimeLeft <= 10 ? 'timer-critical' : 
              questionTimeLeft <= 30 ? 'timer-warning' : ''
            }`}>
              <i className="fas fa-hourglass-half"></i>
              Question: {formatTime(questionTimeLeft)}
            </div>
          )}
          
          {/* Overall Quiz Timer */}
          {timeLeft !== null && timeLeft > 0 && (
            <div className={`timer quiz-timer ${
              timeLeft <= 60 ? 'timer-critical' : 
              timeLeft <= 300 ? 'timer-warning' : ''
            }`}>
              <i className="fas fa-clock"></i>
              Total: {formatTime(timeLeft)}
            </div>
          )}
        </div>
      </div>

      <div className="quiz-progress">
        <div className="progress-header">
          <div className="question-count">
            <i className="fas fa-question-circle"></i>
            Question {currentQuestion + 1} of {quiz.questions.length}
          </div>
          <div className="progress-stats">
            <div className="progress-percentage">
              <i className="fas fa-chart-pie"></i>
              {Math.round(((currentQuestion + 1) / quiz.questions.length) * 100)}% Complete
            </div>
            {quiz.questions[currentQuestion] && quiz.questions[currentQuestion].points > 1 && (
              <div className="question-points">
                <i className="fas fa-star"></i>
                {quiz.questions[currentQuestion].points} points
              </div>
            )}
          </div>
        </div>
        <div className="progress-bar-container">
          <div 
            className="progress-bar" 
            style={{ width: `${((currentQuestion + 1) / quiz.questions.length) * 100}%` }}
          />
        </div>
      </div>

      {quiz.questions[currentQuestion] && (
        <div className="question-container">
          <div className="question-header-info">
            <p className="question-text">{quiz.questions[currentQuestion].text}</p>
            {quiz.settings.showFeedbackAfterEach && (
              <div className="question-hint">
                <i className="fas fa-info-circle"></i>
                <span>You'll see feedback after answering this question</span>
              </div>
            )}
          </div>
          <div className="options-list">
            {quiz.questions[currentQuestion].options.map((option, index) => (
              <button
                key={index}
                className={`option-button ${answers[currentQuestion] && answers[currentQuestion].includes(index) ? 'selected' : ''}`}
                onClick={() => handleAnswerSelect(index)}
              >
                {option.text}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="quiz-navigation">
        <button
          className="nav-button"
          onClick={() => setCurrentQuestion(prev => prev - 1)}
          disabled={currentQuestion === 0}
        >
          <i className="fas fa-chevron-left"></i> Previous
        </button>
        {currentQuestion < quiz.questions.length - 1 ? (
          <button
            className="nav-button"
            onClick={() => setCurrentQuestion(prev => prev + 1)}
          >
            Next <i className="fas fa-chevron-right"></i>
          </button>
        ) : (
          <button
            className="submit-button"
            onClick={() => setShowConfirmSubmit(true)}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <i className="fas fa-spinner fa-spin"></i> Submitting...
              </>
            ) : (
              <>
                <i className="fas fa-check"></i> Submit Quiz
              </>
            )}
          </button>
        )}
      </div>

      {/* Quiz Info Footer */}
      <div className="quiz-info-footer">
        <div className="quiz-stats">
          <div className="stat-item">
            <i className="fas fa-questions"></i>
            <span>{quiz.questions.length} Questions</span>
          </div>
          <div className="stat-item">
            <i className="fas fa-percentage"></i>
            <span>{quiz.settings.passingScore}% to Pass</span>
          </div>
          {quiz.settings.allowRetake && (
            <div className="stat-item">
              <i className="fas fa-redo"></i>
              <span>Retakes Allowed</span>
            </div>
          )}
        </div>
      </div>

      {showConfirmSubmit && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Submit Quiz?</h3>
            <p>Are you sure you want to submit your quiz? You cannot change your answers after submission.</p>
            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => setShowConfirmSubmit(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i> Submitting...
                  </>
                ) : (
                  'Submit'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuizTaking; 