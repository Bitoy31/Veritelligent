import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../../styles/quiz_games.css';

const SoloGames: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="quiz-games-container">
      <button className="qm-back-btn" onClick={() => navigate('/home')}>
        <i className="fas fa-arrow-left"></i> Back
      </button>
      <div className="quiz-games-grid">
        <Link to="/teacher/quiz" className="quiz-game-card quiz">
          <i className="fas fa-question-circle game-icon"></i>
          <h2 className="game-title">Live Quiz Game</h2>
          <p className="game-subtitle">Create and host live quizzes</p>
          <div className="game-features">
            <span><i className="fas fa-clock"></i> Timed</span>
            <span><i className="fas fa-chart-line"></i> Scores</span>
          </div>
        </Link>

        <Link to="/teacher/flashcard" className="quiz-game-card puzzle">
          <i className="fas fa-cards-blank game-icon"></i>
          <h2 className="game-title">Flashcard</h2>
          <p className="game-subtitle">Recitation-style card game</p>
          <div className="game-features">
            <span><i className="fas fa-user"></i> 1-by-1</span>
            <span><i className="fas fa-life-ring"></i> Life Cards</span>
          </div>
        </Link>
      </div>
    </div>
  );
};

export default SoloGames;