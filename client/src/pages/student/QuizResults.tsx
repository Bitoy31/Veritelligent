import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import '../../styles/student_quiz.css';

interface QuizResult {
  score: number;
  totalPoints: number;
  timeSpent: number;
  answers: {
    questionIndex: number;
    selectedOptions: number[];
    correct: boolean;
    points: number;
  }[];
  dateTaken: string;
}

interface Question {
  text: string;
  options: {
    text: string;
    isCorrect: boolean;
  }[];
  points: number;
}

interface Quiz {
  _id: string;
  title: string;
  description: string;
  questions: Question[];
  settings: {
    passingScore: number;
    showFeedbackAfterEach: boolean;
  };
}

const QuizResults: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAnswers, setShowAnswers] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get quiz data
        const quizResponse = await fetch(`http://localhost:5000/api/quiz/${quizId}`);
        const quizData = await quizResponse.json();
        setQuiz(quizData);

        // Get result data
        if (location.state?.result) {
          setResult(location.state.result);
        } else {
          const user = JSON.parse(localStorage.getItem('user') || '{}');
          const resultResponse = await fetch(`http://localhost:5000/api/quiz/${quizId}/result/${user._id}`);
          const resultData = await resultResponse.json();
          setResult(resultData);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [quizId, location.state]);

  if (loading || !quiz || !result) {
    return <div className="loading">Loading results...</div>;
  }

  const percentage = (result.score / result.totalPoints) * 100;
  const passed = percentage >= quiz.settings.passingScore;
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div className="quiz-results">
      <button className="back-button" onClick={() => navigate(-1)}>
        <i className="fas fa-arrow-left"></i> Back to Quizzes
      </button>

      <div className="results-header">
        <h2>{quiz.title} - Results</h2>
        <div className="results-meta">
          <div className="meta-item">
            <i className="fas fa-calendar"></i>
            <span>Taken on: {new Date(result.dateTaken).toLocaleDateString()}</span>
          </div>
          <div className="meta-item">
            <i className="fas fa-clock"></i>
            <span>Time spent: {formatTime(result.timeSpent)}</span>
          </div>
        </div>
      </div>

      <div className="results-summary">
        <div className={`score-card ${passed ? 'passed' : 'failed'}`}>
          <div className="score-header">
            <h3>Final Score</h3>
            <div className="score-badge">
              {passed ? 'PASSED' : 'FAILED'}
            </div>
          </div>
          <div className="score-details">
            <div className="score-percentage">{percentage.toFixed(1)}%</div>
            <div className="score-points">
              {result.score} / {result.totalPoints} points
            </div>
            <div className="passing-score">
              Passing Score: {quiz.settings.passingScore}%
            </div>
          </div>
        </div>
      </div>

      <div className="results-actions">
        <button
          className="toggle-answers-btn"
          onClick={() => setShowAnswers(!showAnswers)}
        >
          {showAnswers ? 'Hide Answers' : 'Show Answers'}
        </button>
      </div>

      {showAnswers && (
        <div className="answers-review">
          {result.answers.map((answer, index) => {
            const question = quiz.questions[answer.questionIndex];
            return (
              <div key={index} className={`question-review ${answer.correct ? 'correct' : 'incorrect'}`}>
                <div className="question-header">
                  <h4>Question {index + 1}</h4>
                  <span className="points">
                    {answer.points} / {question.points} points
                  </span>
                </div>
                <p className="question-text">{question.text}</p>
                <div className="options-review">
                  {question.options.map((option, optIndex) => {
                    const isSelected = answer.selectedOptions.includes(optIndex);
                    const className = `option ${
                      isSelected && option.isCorrect ? 'correct' :
                      isSelected && !option.isCorrect ? 'incorrect' :
                      !isSelected && option.isCorrect ? 'missed' : ''
                    }`;
                    return (
                      <div key={optIndex} className={className}>
                        <i className={`fas ${
                          isSelected && option.isCorrect ? 'fa-check' :
                          isSelected && !option.isCorrect ? 'fa-times' :
                          !isSelected && option.isCorrect ? 'fa-check' : 'fa-circle'
                        }`}></i>
                        <span>{option.text}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default QuizResults; 