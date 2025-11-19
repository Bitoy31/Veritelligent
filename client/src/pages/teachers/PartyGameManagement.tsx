import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/game_management.css';

interface PartyGame {
  id: string;
  gameType: 'quiz-battle' | 'team-challenge';
  name: string;
  subject: string;
  roomCode?: string;
  status: 'draft' | 'waiting' | 'active' | 'completed';
  maxPlayers: number;
  currentPlayers: number;
  createdAt: Date;
  hostedBy: string;
}

const PartyGameManagement: React.FC = () => {
  const navigate = useNavigate();
  const [games, setGames] = useState<PartyGame[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedGameType, setSelectedGameType] = useState<string>('');
  const [gridQuestTasks, setGridQuestTasks] = useState<any[]>([]);
  const [buzzerBattleTasks, setBuzzerBattleTasks] = useState<any[]>([]);

  // Fetch teacher's subjects
  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    if (userData?._id) {
      fetch(`http://localhost:5000/api/subjects?teacherId=${userData._id}`)
        .then(res => res.json())
        .then(data => setSubjects(data))
        .catch(console.error);
      // Load Grid Quest tasks
      fetch('http://localhost:5000/api/gridquest/tasks')
        .then(r => r.json())
        .then(setGridQuestTasks)
        .catch(() => {});
      // Load Buzzer Battle tasks
      fetch(`http://localhost:5000/api/buzzerbattle/tasks?teacherId=${userData._id}`)
        .then(r => r.json())
        .then(setBuzzerBattleTasks)
        .catch(() => {});
    }
  }, []);

  const gameTemplates = [
    {
      type: 'grid-quest',
      name: 'Grid Quest',
      icon: 'fas fa-th-large',
      description: 'Team-based category grid game',
      maxPlayers: 32,
      minPlayers: 2,
      color: '#f59e0b'
    },
    {
      type: 'buzzer-battle',
      name: 'Buzzer Battle',
      icon: 'fas fa-bell',
      description: 'Fast-paced team buzzer competition',
      maxPlayers: 32,
      minPlayers: 2,
      color: '#8b5cf6'
    },
  ];

  const generateRoomCode = () => {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
  };

  const PartyGameCard: React.FC<{ game: PartyGame }> = ({ game }) => {
    const template = gameTemplates.find(t => t.type === game.gameType);
    
    return (
      <div className="party-game-card">
        <div className="party-game-header" style={{ background: template?.color }}>
          <div className="game-info">
            <i className={template?.icon}></i>
            <div>
              <h3>{game.name}</h3>
              <p>{template?.description}</p>
            </div>
          </div>
          <span className={`game-status-badge ${game.status}`}>
            {game.status.charAt(0).toUpperCase() + game.status.slice(1)}
          </span>
        </div>
        
        <div className="party-game-body">
          <div className="game-details">
            <div className="detail-item">
              <i className="fas fa-book"></i>
              <span>{game.subject}</span>
            </div>
            {game.roomCode && (
              <div className="detail-item room-code">
                <i className="fas fa-key"></i>
                <span className="code">{game.roomCode}</span>
              </div>
            )}
            <div className="detail-item">
              <i className="fas fa-users"></i>
              <span>{game.currentPlayers}/{game.maxPlayers} players</span>
            </div>
            <div className="detail-item">
              <i className="fas fa-calendar-alt"></i>
              <span>{new Date(game.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
        
        <div className="party-game-actions">
          {game.status === 'draft' && (
            <>
              <button className="action-btn edit-btn">
                <i className="fas fa-edit"></i>
                Edit Game
              </button>
              <button className="action-btn start-btn" onClick={() => startGame(game.id)}>
                <i className="fas fa-play"></i>
                Start Hosting
              </button>
            </>
          )}
          {game.status === 'waiting' && (
            <>
              <button className="action-btn monitor-btn">
                <i className="fas fa-eye"></i>
                Monitor Room
              </button>
              <button className="action-btn begin-btn" onClick={() => beginGame(game.id)}>
                <i className="fas fa-rocket"></i>
                Begin Game
              </button>
            </>
          )}
          {game.status === 'active' && (
            <>
              <button className="action-btn control-btn">
                <i className="fas fa-gamepad"></i>
                Game Control
              </button>
              <button className="action-btn stop-btn" onClick={() => stopGame(game.id)}>
                <i className="fas fa-stop"></i>
                End Game
              </button>
            </>
          )}
          {game.status === 'completed' && (
            <button className="action-btn results-btn">
              <i className="fas fa-chart-bar"></i>
              View Results
            </button>
          )}
        </div>
      </div>
    );
  };

  const startGame = (gameId: string) => {
    // Generate room code and update game status to waiting
    const roomCode = generateRoomCode();
    setGames(prev => prev.map(game => 
      game.id === gameId 
        ? { ...game, status: 'waiting', roomCode }
        : game
    ));
  };

  const beginGame = (gameId: string) => {
    setGames(prev => prev.map(game => 
      game.id === gameId 
        ? { ...game, status: 'active' }
        : game
    ));
  };

  const stopGame = (gameId: string) => {
    setGames(prev => prev.map(game => 
      game.id === gameId 
        ? { ...game, status: 'completed' }
        : game
    ));
  };

  const CreateGameModal: React.FC = () => (
    <div className="party-modal-overlay">
      <div className="party-modal-content create-party-game-modal">
        <div className="party-modal-header">
          <h2>🎉 Create Party Game</h2>
          <button className="party-modal-close-btn" onClick={() => setShowCreateModal(false)}>
            <i className="fas fa-times"></i>
          </button>
        </div>
        
        <div className="party-game-type-selection">
          <h3>Choose Game Type</h3>
          <div className="party-game-types-grid">
            {gameTemplates.map(template => (
              <div 
                key={template.type}
                className={`party-game-type-card ${selectedGameType === template.type ? 'selected' : ''}`}
                onClick={() => setSelectedGameType(template.type)}
                style={{ borderColor: selectedGameType === template.type ? template.color : '#e5e7eb' }}
              >
                <div className="party-game-type-icon" style={{ color: template.color }}>
                  <i className={template.icon}></i>
                </div>
                <h4>{template.name}</h4>
                <p>{template.description}</p>
                <div className="party-game-type-meta">
                  <span><i className="fas fa-users"></i> {template.minPlayers}-{template.maxPlayers} players</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {selectedGameType && (
          <div className="party-game-setup-form">
            {(selectedGameType === 'grid-quest' || selectedGameType === 'buzzer-battle') ? (
              <div className="party-form-group">
                <p>
                  {selectedGameType === 'grid-quest' 
                    ? 'Manage categories and clues in Grid Quest Management. Click "Create / Manage" to go there.'
                    : 'Manage questions and settings in Buzzer Battle Management. Click "Create / Manage" to go there.'
                  }
                </p>
              </div>
            ) : (
              <>
                <div className="party-form-group">
                  <label>Game Name</label>
                  <input 
                    type="text" 
                    placeholder="Enter game name"
                    className="party-form-input"
                  />
                </div>
                <div className="party-form-group">
                  <label>Subject</label>
                  <select className="party-form-select">
                    <option value="">Select Subject</option>
                    {subjects.map(subject => (
                      <option key={subject._id} value={subject._id}>
                        {subject.code} - {subject.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="party-form-group">
                  <label>Maximum Players</label>
                  <input 
                    type="number" 
                    min={gameTemplates.find(t => t.type === selectedGameType)?.minPlayers || 2}
                    max={gameTemplates.find(t => t.type === selectedGameType)?.maxPlayers || 16}
                    defaultValue={gameTemplates.find(t => t.type === selectedGameType)?.maxPlayers || 8}
                    className="party-form-input"
                  />
                </div>
              </>
            )}
          </div>
        )}
        
        <div className="party-modal-actions">
          <button className="party-btn-secondary" onClick={() => setShowCreateModal(false)}>
            Cancel
          </button>
          <button 
            className="party-btn-primary" 
            disabled={!selectedGameType}
            style={{ 
              background: selectedGameType ? gameTemplates.find(t => t.type === selectedGameType)?.color : '#d1d5db' 
            }}
            onClick={() => {
              if (selectedGameType === 'grid-quest') {
                setShowCreateModal(false);
                navigate('/teacher/grid-quest');
              } else if (selectedGameType === 'buzzer-battle') {
                setShowCreateModal(false);
                navigate('/teacher/buzzer-battle');
              }
            }}
          >
            {(selectedGameType === 'grid-quest' || selectedGameType === 'buzzer-battle') ? 'Create / Manage' : 'Create Game'}
          </button>
        </div>
      </div>
    </div>
  );

  const filteredGridQuestTasks = selectedSubject 
    ? gridQuestTasks.filter((t: any) => String(t.subjectId) === String(selectedSubject))
    : gridQuestTasks;

  const filteredBuzzerBattleTasks = selectedSubject 
    ? buzzerBattleTasks.filter((t: any) => String(t.subjectId) === String(selectedSubject))
    : buzzerBattleTasks;

  const allTasks = [
    ...filteredGridQuestTasks.map(t => ({ ...t, gameType: 'grid-quest' })),
    ...filteredBuzzerBattleTasks.map(t => ({ ...t, gameType: 'buzzer-battle' }))
  ];

  return (
    <div className="party-game-management">
      <div className="page-header">
        <button className="qm-back-btn" onClick={() => navigate('/home')}>
          <i className="fas fa-arrow-left"></i>
          Back
        </button> 
        <div className="header-content">
          <h1>🎉 Party Game Management</h1>
          <p>Host and manage multiplayer games for your students</p>
        </div>
        <button className="create-game-btn" onClick={() => setShowCreateModal(true)}>
          <i className="fas fa-plus"></i>
          Create Party Game
        </button>
      </div>

      <div className="filters-section">
        <div className="filter-group">
          <label>Filter by Subject:</label>
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
      </div>

      <div className="party-games-grid">
        {allTasks.length === 0 ? (
          <div className="no-games-message">
            <h3>No party game tasks yet</h3>
            <p>Create Grid Quest or Buzzer Battle tasks to get started.</p>
            <button className="create-first-game-btn" onClick={() => setShowCreateModal(true)}>
              Create Party Game
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem', width: '100%' }}>
            {allTasks.map(t => (
              <div key={`${t.gameType}-${t._id}`} className="party-game-card">
                <div className="party-game-header" style={{ background: t.gameType === 'grid-quest' ? '#f59e0b' : '#8b5cf6' }}>
                  <div className="game-info">
                    <i className={t.gameType === 'grid-quest' ? 'fas fa-th-large' : 'fas fa-bell'}></i>
                    <div>
                      <h3>{t.title}</h3>
                      <p>
                        {t.gameType === 'grid-quest' 
                          ? `Grid Quest • ${t.categories?.length || 0} categories`
                          : `Buzzer Battle • ${t.questions?.length || 0} questions`
                        }
                      </p>
                    </div>
                  </div>
                  <span className={`game-status-badge ${t.status}`}>{t.status}</span>
                </div>
                <div className="party-game-actions">
                  <button 
                    className="action-btn start-btn" 
                    onClick={() => {
                      if (t.gameType === 'grid-quest') {
                        navigate(`/teacher/grid-quest/host?taskId=${t._id}`);
                      } else {
                        navigate('/teacher/buzzer-battle/host', { state: { taskId: t._id, subjectId: t.subjectId } });
                      }
                    }}
                    disabled={t.status !== 'published'}
                  >
                    <i className="fas fa-play"></i>
                    Host
                  </button>
                  <button 
                    className="action-btn edit-btn" 
                    onClick={() => {
                      if (t.gameType === 'grid-quest') {
                        navigate('/teacher/grid-quest');
                      } else {
                        navigate('/teacher/buzzer-battle');
                      }
                    }}
                  >
                    <i className="fas fa-edit"></i>
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && <CreateGameModal />}
    </div>
  );
};

export default PartyGameManagement; 