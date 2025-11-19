import '../../styles/Home.css';
import { Link, useNavigate } from 'react-router-dom';
import TeacherProfile from '../../components/TeacherProfile';
import { useState } from 'react';

function Home() {
  const navigate = useNavigate();
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'about' | 'solo' | 'party'>('about');

  const handleLogout = () => {
    // Clear all authentication data
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Redirect to login page
    navigate('/');
  };

  return (
    <div className="teacher-home">
      {/* Game Category */}
      <div className="row-50-50">
          <Link to="/teacher/solo-games" className="half solo">
              <span className="big-title solo-title">SOLO</span>
              <span className="thin-title solo-thin">GAMES</span>
          </Link>
          <Link to="/teacher/party-games" className="half party">
              <span className="big-title party-title">PARTY</span>
              <span className="thin-title party-thin">GAMES</span>
          </Link>
      </div>

      {/* Floating Action Circles (Bottom Left) */}
      <div className="fab-row">
        <div 
          className="fab-circle" 
          title="About"
          style={{ cursor: 'pointer' }}
          onClick={() => setShowAboutModal(true)}
        >
            <i className="fas fa-info"></i>
        </div>
        <div
          className="fab-circle"
          title="Management"
          style={{ cursor: 'pointer' }}
          onClick={() => navigate('/teacher')}
        >
            <i className="fas fa-cogs"></i>
        </div>
        <div className="fab-circle" title="Leaderboards" 
          style={{ cursor: 'pointer' }} 
          onClick={() => navigate('/teacher/leaderboard')}>
            <i className="fas fa-trophy"></i>
        </div>
        <div
          className="fab-circle"
          title="Sessions"
          style={{ cursor: 'pointer' }}
          onClick={() => navigate('/teacher/sessions')}
        >
          <i className="fas fa-list"></i>
        </div>
      </div>
      <TeacherProfile />

      {/* About Modal */}
      {showAboutModal && (
        <div className="modal-overlay" onClick={() => setShowAboutModal(false)}>
          <div className="about-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="about-modal-header">
              <h2>About Veritelligent</h2>
              <button 
                className="about-modal-close" 
                onClick={() => setShowAboutModal(false)}
                aria-label="Close"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            {/* Tabs */}
            <div className="about-tabs">
              <button 
                className={`about-tab ${activeTab === 'about' ? 'active' : ''}`}
                onClick={() => setActiveTab('about')}
              >
                <i className="fas fa-info-circle"></i> About
              </button>
              <button 
                className={`about-tab ${activeTab === 'solo' ? 'active' : ''}`}
                onClick={() => setActiveTab('solo')}
              >
                <i className="fas fa-user"></i> Solo Games
              </button>
              <button 
                className={`about-tab ${activeTab === 'party' ? 'active' : ''}`}
                onClick={() => setActiveTab('party')}
              >
                <i className="fas fa-users"></i> Party Games
              </button>
            </div>

            {/* Tab Content */}
            <div className="about-tab-content">
              {activeTab === 'about' && (
                <div className="about-section">
                  <div className="about-logo-section">
                    <h3>Veritelligent</h3>
                    <p className="about-tagline">Intelligent Learning Through Interactive Games</p>
                  </div>
                  <div className="about-description">
                    <p>
                      Veritelligent is an innovative educational platform designed to transform 
                      traditional learning into an engaging, interactive experience. Our system 
                      combines gamification with educational content to help teachers create 
                      dynamic learning environments and motivate students through competitive 
                      gameplay.
                    </p>
                    <h4>Key Features:</h4>
                    <ul>
                      <li><strong>Subject Management:</strong> Organize your courses and track student enrollment</li>
                      <li><strong>Game-Based Learning:</strong> Multiple game modes to suit different learning styles</li>
                      <li><strong>Real-Time Analytics:</strong> Track student performance and progress</li>
                      <li><strong>Leaderboards:</strong> Foster healthy competition and motivate students</li>
                      <li><strong>Flexible Game Modes:</strong> Solo practice or collaborative party games</li>
                    </ul>
                    <p>
                      Whether you're looking to reinforce concepts through solo practice or 
                      create engaging classroom competitions, Veritelligent provides the tools 
                      you need to make learning fun and effective.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'solo' && (
                <div className="about-section">
                  <h3>Solo Games</h3>
                  <p className="about-intro">
                    Solo games are designed for individual practice and self-paced learning. 
                    Students can test their knowledge independently and track their progress.
                  </p>

                  <div className="game-info-card">
                    <div className="game-info-header">
                      <i className="fas fa-question-circle game-icon-large"></i>
                      <h4>Live Quiz Game</h4>
                    </div>
                    <div className="game-info-body">
                      <p className="game-description">
                        A fast-paced, competitive quiz experience where students answer questions 
                        in real-time. Speed and accuracy both matter in this engaging format.
                      </p>
                      <h5>Mechanics:</h5>
                      <ul>
                        <li><strong>Question Types:</strong> Single choice, multiple choice, and true/false questions</li>
                        <li><strong>Scoring:</strong> Points awarded based on correctness and response time</li>
                        <li><strong>Streak Bonuses:</strong> Consecutive correct answers earn bonus points</li>
                        <li><strong>Time Limits:</strong> Questions may have time constraints to add urgency</li>
                        <li><strong>Feedback:</strong> Immediate feedback after each question or at the end</li>
                        <li><strong>Retakes:</strong> Teachers can allow multiple attempts to improve scores</li>
                      </ul>
                      <div className="game-features-tags">
                        <span className="feature-tag"><i className="fas fa-clock"></i> Timed</span>
                        <span className="feature-tag"><i className="fas fa-fire"></i> Streaks</span>
                        <span className="feature-tag"><i className="fas fa-chart-line"></i> Scoring</span>
                      </div>
                    </div>
                  </div>

                  <div className="game-info-card">
                    <div className="game-info-header">
                      <i className="fas fa-cards-blank game-icon-large"></i>
                      <h4>Flashcard</h4>
                    </div>
                    <div className="game-info-body">
                      <p className="game-description">
                        A recitation-style card game where students answer questions one-by-one. 
                        This format encourages careful thinking and reduces pressure compared to 
                        timed quizzes.
                      </p>
                      <h5>Mechanics:</h5>
                      <ul>
                        <li><strong>One-by-One Format:</strong> Students answer questions sequentially at their own pace</li>
                        <li><strong>Life Cards:</strong> Students have a limited number of "lives" or attempts</li>
                        <li><strong>Card Progression:</strong> Move through flashcards one at a time</li>
                        <li><strong>No Time Pressure:</strong> Focus on understanding rather than speed</li>
                        <li><strong>Review Mode:</strong> Students can review their answers after completion</li>
                        <li><strong>Practice Focus:</strong> Designed for learning and reinforcement rather than competition</li>
                      </ul>
                      <div className="game-features-tags">
                        <span className="feature-tag"><i className="fas fa-user"></i> Individual</span>
                        <span className="feature-tag"><i className="fas fa-life-ring"></i> Life Cards</span>
                        <span className="feature-tag"><i className="fas fa-book"></i> Practice</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'party' && (
                <div className="about-section">
                  <h3>Party Games</h3>
                  <p className="about-intro">
                    Party games are designed for collaborative, competitive classroom experiences. 
                    Students work in teams and compete in real-time, making learning a social activity.
                  </p>

                  <div className="game-info-card">
                    <div className="game-info-header">
                      <i className="fas fa-th-large game-icon-large"></i>
                      <h4>Grid Quest</h4>
                    </div>
                    <div className="game-info-body">
                      <p className="game-description">
                        A turn-based team competition where students navigate through a grid of 
                        questions. Teams take turns answering questions to progress and compete 
                        for the highest score.
                      </p>
                      <h5>Mechanics:</h5>
                      <ul>
                        <li><strong>Team-Based:</strong> Students form teams to compete together</li>
                        <li><strong>Turn-Based Gameplay:</strong> Teams take turns selecting and answering questions</li>
                        <li><strong>Grid Navigation:</strong> Questions are arranged in a grid format</li>
                        <li><strong>Strategic Choices:</strong> Teams choose which questions to attempt</li>
                        <li><strong>Team Scoring:</strong> Points are accumulated for the entire team</li>
                        <li><strong>Room Code System:</strong> Students join using a room code provided by the teacher</li>
                        <li><strong>Real-Time Updates:</strong> All teams see progress and scores in real-time</li>
                      </ul>
                      <div className="game-features-tags">
                        <span className="feature-tag"><i className="fas fa-clock"></i> Turn-based</span>
                        <span className="feature-tag"><i className="fas fa-users"></i> Teams</span>
                        <span className="feature-tag"><i className="fas fa-th"></i> Grid</span>
                      </div>
                    </div>
                  </div>

                  <div className="game-info-card">
                    <div className="game-info-header">
                      <i className="fas fa-bell game-icon-large"></i>
                      <h4>Buzzer Battle</h4>
                    </div>
                    <div className="game-info-body">
                      <p className="game-description">
                        A fast-paced, competitive game where speed is key. Teams race to "buzz in" 
                        first to answer questions, creating an exciting, energetic classroom atmosphere.
                      </p>
                      <h5>Mechanics:</h5>
                      <ul>
                        <li><strong>Speed Buzzer:</strong> Teams compete to buzz in first when a question appears</li>
                        <li><strong>First-Come-First-Served:</strong> Only the first team to buzz can answer</li>
                        <li><strong>Team Competition:</strong> Multiple teams compete simultaneously</li>
                        <li><strong>Fast-Paced:</strong> Questions appear quickly to maintain excitement</li>
                        <li><strong>Buzzer System:</strong> Teams have a buzzer button to signal they want to answer</li>
                        <li><strong>Room Code Join:</strong> Students join using a room code to participate</li>
                        <li><strong>Live Leaderboard:</strong> Scores update in real-time as teams answer correctly</li>
                        <li><strong>Time Pressure:</strong> Quick thinking and fast reflexes are rewarded</li>
                      </ul>
                      <div className="game-features-tags">
                        <span className="feature-tag"><i className="fas fa-bolt"></i> Speed</span>
                        <span className="feature-tag"><i className="fas fa-users"></i> Teams</span>
                        <span className="feature-tag"><i className="fas fa-trophy"></i> Competitive</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
