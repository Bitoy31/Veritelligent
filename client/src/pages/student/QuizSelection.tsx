import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRScanner from '../../components/QRScanner';
import '../../styles/quiz_games.css';

const QuizSelection: React.FC = () => {
  const navigate = useNavigate();
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [quizCode, setQuizCode] = useState('');
  const [error, setError] = useState('');
  const [joiningQuiz, setJoiningQuiz] = useState(false);

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoiningQuiz(true);
    setError('');
    try {
      navigate(`/student/live/${quizCode.trim().toUpperCase()}`);
    } catch (error) {
      setError('Failed to join quiz');
    } finally {
      setJoiningQuiz(false);
    }
  };

  const handleQRCodeScanned = (code: string) => {
    setShowQRScanner(false);
    navigate(`/student/live/${(code || '').toUpperCase()}`);
  };

  return (
    <div className="quiz-selection join-live">
      <button 
        className="back-button" 
        style={{
          marginBottom: '30px',
        }}
        onClick={() => navigate('/student/solo-games')}
      >
        <i className="fas fa-arrow-left"></i> Back to Games Selection
      </button>
      
      <div className="join-options">
        <div className="join-card">
          <h2>Enter Room Code or Scan QR</h2>
          
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
                  value={quizCode}
                  onChange={(e) => setQuizCode(e.target.value)}
                  required
                />
                <button type="submit" disabled={joiningQuiz}>
                  {joiningQuiz ? (
                    <>
                      <i className="fas fa-spinner fa-spin"></i> Joining...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-sign-in-alt"></i> Join Live Room
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

export default QuizSelection; 