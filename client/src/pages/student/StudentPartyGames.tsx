import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/quiz_games.css';

const StudentPartyGames: React.FC = () => {
  const navigate = useNavigate();

  const handleJoinGridQuest = () => {
    navigate('/student/party-games/grid-quest/join');
  };

  const handleJoinBuzzerBattle = () => {
    navigate('/student/party-games/buzzer-battle/join');
  };

  return (
    <div className="student-party-games quiz-games-container">
      <div className="party-games-header">
        <h1>🎉 Party Games</h1>
        <p>Challenge your friends and compete together!</p>
      </div>
      <div className="quiz-games-grid">
        <button onClick={handleJoinGridQuest} className="quiz-game-card quiz-battle" style={{ textAlign: 'left' }}>
          <i className="fas fa-th-large game-icon"></i>
          <h2 className="game-title">Grid Quest</h2>
          <p className="game-subtitle">Enter room code to join</p>
          <div className="game-features">
            <span><i className="fas fa-clock"></i> Turn-based</span>
            <span><i className="fas fa-users"></i> Teams</span>
          </div>
        </button>
        
        <button onClick={handleJoinBuzzerBattle} className="quiz-game-card buzzer-battle" style={{ textAlign: 'left' }}>
          <i className="fas fa-bell game-icon"></i>
          <h2 className="game-title">Buzzer Battle</h2>
          <p className="game-subtitle">Fast-paced buzzer action</p>
          <div className="game-features">
            <span><i className="fas fa-bolt"></i> Speed buzz-in</span>
            <span><i className="fas fa-users"></i> Teams</span>
          </div>
        </button>
        
      </div>
    </div>
  );
};

export default StudentPartyGames; 