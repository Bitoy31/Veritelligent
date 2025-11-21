import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRScanner from '../../components/QRScanner';
import '../../styles/quiz_games.css';

const GridQuestJoin: React.FC = () => {
  const navigate = useNavigate();
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoining(true);
    setError('');
    try {
      navigate(`/student/grid-quest/${roomCode.trim().toUpperCase()}`);
    } catch (err) {
      setError('Failed to join room');
    } finally {
      setJoining(false);
    }
  };

  const handleQRCodeScanned = (code: string) => {
    setShowQRScanner(false);
    navigate(`${(code || '').toUpperCase()}`);
  };

  return (
    <div className="quiz-selection join-live">
      <button 
        className="back-button" 
        style={{ marginBottom: '30px' }}
        onClick={() => navigate('/student/party-games')}
      >
        <i className="fas fa-arrow-left"></i> Back to Party Games
      </button>
      
      <div className="join-options">
        <div className="join-card">
          <h2>Join Grid Quest</h2>
          
          {showQRScanner ? (
            <div className="qr-scanner-container">
              <QRScanner onCodeScanned={handleQRCodeScanned} />
              <button
                className="secondary-button"
                onClick={() => setShowQRScanner(false)}
              >
                <i className="fas fa-times"></i> Cancel Scanning
              </button>
            </div>
          ) : (
            <div className="join-methods">
              <form onSubmit={handleCodeSubmit} className="code-entry">
                <input
                  type="text"
                  placeholder={'Enter Room Code'}
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  required
                />
                <button type="submit" disabled={joining}>
                  {joining ? (
                    <>
                      <i className="fas fa-spinner fa-spin"></i> Joining...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-sign-in-alt"></i> Join Grid Quest
                    </>
                  )}
                </button>
              </form>
              
              <button
                className="qr-button"
                onClick={() => setShowQRScanner(true)}
              >
                <i className="fas fa-qrcode"></i>
                Scan QR Code
              </button>
            </div>
          )}
          {error && (
            <div className="error">
              <i className="fas fa-exclamation-circle"></i> {error}
            </div>
          )}
        </div>
      </div>
      
    </div>
  );
};

export default GridQuestJoin;



