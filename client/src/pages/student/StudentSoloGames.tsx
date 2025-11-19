import React from 'react';
import { Link } from 'react-router-dom';
import '../../styles/quiz_games.css';

const StudentSoloGames: React.FC = () => {
  return (
    <div className="quiz-games-container">
      <div className="quiz-games-grid">
        <Link to="/student/solo-games/quiz?mode=solo" className="quiz-game-card quiz">
          <i className="fas fa-question-circle game-icon"></i>
          <h2 className="game-title">Live Quiz Game</h2>
          <p className="game-subtitle">Fast-paced, competitive quiz experience!</p>
          <div className="game-features">
            <span><i className="fas fa-clock"></i> Speed matters</span>
            <span><i className="fas fa-fire"></i> Streak bonuses</span>
          </div>
        </Link>

        <Link to="/student/solo-games/flashcard/join" className="quiz-game-card puzzle">
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

export default StudentSoloGames; 