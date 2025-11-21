import React from 'react';
import { Link } from 'react-router-dom';
import '../../styles/student.css';

const StudentGames: React.FC = () => {
  return (
    <div className="games-container">
      <div className="games-grid">
        <Link to="/student/solo-games" className="game-card solo">
          <span className="big-title">SOLO</span>
          <span className="thin-title">GAMES</span>
        </Link>
        <Link to="/student/party-games" className="game-card party">
          <span className="big-title">PARTY</span>
          <span className="thin-title">GAMES</span>
        </Link>
      </div>
    </div>
  );
};

export default StudentGames;