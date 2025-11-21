import React, { useState, useEffect } from 'react';
import '../../styles/game_management.css';

interface Game {
  id: string;
  type: 'solo' | 'party';
  name: string;
  subject: string;
  status: 'draft' | 'active' | 'completed';
  createdAt: Date;
  lastPlayed?: Date;
  playCount: number;
}

const GameManagement: React.FC = () => {
  const [activeGameType, setActiveGameType] = useState<'solo' | 'party'>('solo');
  const [games, setGames] = useState<Game[]>([]);
  const [showNewGameModal, setShowNewGameModal] = useState(false);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('');

  // Fetch teacher's subjects
  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    if (userData?._id) {
      fetch(`https://api.veritelligent.fun/api/subjects?teacherId=${userData._id}`)
        .then(res => res.json())
        .then(data => setSubjects(data))
        .catch(console.error);
    }
  }, []);

  const GameCard: React.FC<{ game: Game }> = ({ game }) => (
    <div className="game-management-card">
      <div className="game-management-card-header">
        <h3>{game.name}</h3>
        <span className={`status-badge ${game.status}`}>{game.status}</span>
      </div>
      <div className="game-management-card-body">
        <p><strong>Subject:</strong> {game.subject}</p>
        <p><strong>Type:</strong> {game.type}</p>
        <p><strong>Played:</strong> {game.playCount} times</p>
        {game.lastPlayed && (
          <p><strong>Last played:</strong> {new Date(game.lastPlayed).toLocaleDateString()}</p>
        )}
      </div>
      <div className="game-management-card-actions">
        <button className="edit-btn">
          <i className="fas fa-edit"></i> Edit
        </button>
        <button className="play-btn">
          <i className="fas fa-play"></i> Start Game
        </button>
        <button className="stats-btn">
          <i className="fas fa-chart-bar"></i> Stats
        </button>
      </div>
    </div>
  );

  const NewGameModal: React.FC = () => (
    <div className="modal-overlay">
      <div className="modal-content game-modal">
        <h2>Create New Game</h2>
        <div className="game-type-selector">
          <div className={`game-type solo ${activeGameType === 'solo' ? 'selected' : ''}`}
               onClick={() => setActiveGameType('solo')}>
            <i className="fas fa-user"></i>
            <h3>Solo Games</h3>
            <p>Individual student challenges</p>
          </div>
          <div className={`game-type party ${activeGameType === 'party' ? 'selected' : ''}`}
               onClick={() => setActiveGameType('party')}>
            <i className="fas fa-users"></i>
            <h3>Party Games</h3>
            <p>Multiplayer team challenges</p>
          </div>
        </div>
        
        {activeGameType === 'solo' && (
          <div className="game-templates">
            <h3>Choose Game Type</h3>
            <div className="template-grid">
              <div className="template-card">
                <i className="fas fa-clock"></i>
                <h4>Quick Quiz</h4>
                <p>Rapid-fire multiple choice questions</p>
              </div>
              <div className="template-card">
                <i className="fas fa-running"></i>
                <h4>Knowledge Race</h4>
                <p>Progressive difficulty challenges</p>
              </div>
              <div className="template-card">
                <i className="fas fa-puzzle-piece"></i>
                <h4>Concept Match</h4>
                <p>Match terms with definitions</p>
              </div>
            </div>
          </div>
        )}
        
        {activeGameType === 'party' && (
          <div className="game-templates">
            <h3>Choose Game Type</h3>
            <div className="template-grid">
              <div className="template-card">
                <i className="fas fa-shield-alt"></i>
                <h4>Team Battle</h4>
                <p>Teams compete to answer questions</p>
              </div>
              <div className="template-card">
                <i className="fas fa-exchange-alt"></i>
                <h4>Knowledge Relay</h4>
                <p>Teams work in sequence</p>
              </div>
              <div className="template-card">
                <i className="fas fa-users-cog"></i>
                <h4>Group Challenge</h4>
                <p>Collaborative problem solving</p>
              </div>
            </div>
          </div>
        )}
        
        <div className="modal-actions">
          <button className="cancel-btn" onClick={() => setShowNewGameModal(false)}>Cancel</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="game-management">
      <div className="game-management-header">
        <div className="header-left">
          <h2>Game Management</h2>
          <div className="game-type-tabs">
            <button 
              className={`tab-btn ${activeGameType === 'solo' ? 'active' : ''}`}
              onClick={() => setActiveGameType('solo')}
            >
              <i className="fas fa-user"></i> Solo Games
            </button>
            <button 
              className={`tab-btn ${activeGameType === 'party' ? 'active' : ''}`}
              onClick={() => setActiveGameType('party')}
            >
              <i className="fas fa-users"></i> Party Games
            </button>
          </div>
        </div>
        <button className="new-game-btn" onClick={() => setShowNewGameModal(true)}>
          <i className="fas fa-plus"></i> New Game
        </button>
      </div>

      <div className="game-filters">
        <select 
          value={selectedSubject} 
          onChange={(e) => setSelectedSubject(e.target.value)}
          className="subject-filter"
        >
          <option value="">All Subjects</option>
          {subjects.map(subject => (
            <option key={subject._id} value={subject._id}>
              {subject.code} - {subject.name}
            </option>
          ))}
        </select>
      </div>

      <div className="games-management-grid">
        {/* Example games - replace with actual data */}
        <GameCard game={{
          id: '1',
          type: 'solo',
          name: 'Quick Quiz: Introduction',
          subject: 'Introduction to Computing',
          status: 'active',
          createdAt: new Date(),
          playCount: 15
        }} />
        <GameCard game={{
          id: '2',
          type: 'party',
          name: 'Team Battle: Programming Basics',
          subject: 'Programming 101',
          status: 'draft',
          createdAt: new Date(),
          playCount: 0
        }} />
      </div>

      {showNewGameModal && <NewGameModal />}
    </div>
  );
};

export default GameManagement; 