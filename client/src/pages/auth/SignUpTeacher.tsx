import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/auth.css';

const defaultSignUp = {
    userName: '',
    userPass: '',
    userFname: '',
    userMname: '',
    userLname: '',
    userEmail: '',
    userContact: '',
    userProfile: '',
};

const SignUpTeacher: React.FC = () => {
  const navigate = useNavigate();
  const [signUpData, setSignUpData] = useState(defaultSignUp);
  const [error, setError] = useState('');

  const handleSignUpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSignUpData({
        ...signUpData,
        [e.target.name]: e.target.value
    });
  };

  const handleProfileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setSignUpData(prev => ({
        ...prev,
        userProfile: reader.result as string
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const payload = {
      ...signUpData,
      userRole: 'teacher'
    };
    try {
      const response = await fetch('https://api.veritelligent.fun/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Sign up failed');
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('token', data.token);
      navigate('/home');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed');
    }
  };

  return (
    <div className="auth-bg">
      <div className="auth-signup-card">
        <div className="signup-header">
          <h2>👩‍🏫 Teacher Sign Up</h2>
        </div>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSignUpSubmit} className="signup-form">
          <div className="form-row">
            <div className="form-group">
              <label>Username:</label>
              <input
                type="text"
                name="userName"
                value={signUpData.userName}
                onChange={handleSignUpChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Password:</label>
              <input
                type="password"
                name="userPass"
                value={signUpData.userPass}
                onChange={handleSignUpChange}
                required
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>First Name:</label>
              <input
                type="text"
                name="userFname"
                value={signUpData.userFname}
                onChange={handleSignUpChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Middle Name:</label>
              <input
                type="text"
                name="userMname"
                value={signUpData.userMname}
                onChange={handleSignUpChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Last Name:</label>
              <input
                type="text"
                name="userLname"
                value={signUpData.userLname}
                onChange={handleSignUpChange}
                required
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Email:</label>
              <input
                type="email"
                name="userEmail"
                value={signUpData.userEmail}
                onChange={handleSignUpChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Contact:</label>
              <input
                type="text"
                name="userContact"
                value={signUpData.userContact}
                onChange={handleSignUpChange}
                required
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group profile-upload-group">
              <label>Profile Photo:</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleProfileUpload}
                required
              />
              {signUpData.userProfile && (
                <img
                  src={signUpData.userProfile}
                  alt="Preview"
                  className="profile-preview"
                />
              )}
            </div>
          </div>
          <button type="submit" className="auth-button">
            Sign Up
          </button>
          <button
            type="button"
            className="auth-button secondary"
            style={{ marginTop: '1rem' }}
            onClick={() => navigate('/')}
          >
            Back to Login
          </button>
        </form>
      </div>
    </div>
  );
};

export default SignUpTeacher;