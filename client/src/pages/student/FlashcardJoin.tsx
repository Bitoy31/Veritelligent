import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRScanner from '../../components/QRScanner';
import '../../styles/quiz_games.css';

const FlashcardJoin: React.FC = () => {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim()) return;

    setLoading(true);
    // Navigate to flashcard room
    setTimeout(() => {
      navigate(`/student/flashcard/${roomCode.toUpperCase()}`);
    }, 500);
  };

  const handleQRCodeScanned = (code: string) => {
    // Extract room code from scanned URL
    const match = code.match(/\/student\/flashcard\/([A-Z0-9]+)/i);
    if (match) {
      const scannedCode = match[1];
      navigate(`/student/flashcard/${scannedCode.toUpperCase()}`);
    } else {
      alert('Invalid QR code');
      setShowScanner(false);
    }
  };

  return (
    <div className="quiz-selection">
      <button className="back-button" onClick={() => navigate('/student/solo-games')}>
        <i className="fas fa-arrow-left"></i> Back
      </button>

      <h1>Join Flashcard Game</h1>

      <div className="join-options">
        <div className="join-card">
          <h2>Enter Room Code</h2>
          <form className="code-entry" onSubmit={handleCodeSubmit}>
            <input
              type="text"
              placeholder="Enter 6-digit code"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              maxLength={6}
              disabled={loading}
            />
            <button type="submit" disabled={loading || roomCode.length === 0}>
              {loading ? 'Joining...' : 'Join Game'}
            </button>
          </form>

          <div className="join-methods">
            <button
              className="qr-button"
              onClick={() => setShowScanner(!showScanner)}
            >
              <i className="fas fa-qrcode"></i>
              {showScanner ? 'Hide' : 'Scan'} QR Code
            </button>
          </div>

          {showScanner && (
            <div className="qr-scanner-container">
              <QRScanner
                onCodeScanned={handleQRCodeScanned}
                onError={(err) => console.error('QR Scanner error:', err)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FlashcardJoin;

