import React, { useState, useRef } from 'react';
import { useDocumentTitle } from '../../utils/useDocumentTitle';
import { useNavigate, Link } from 'react-router-dom';
import '../../styles/auth.css';
import logo from '../../images/auth/LOGO_Veritelligent.png';

const Login: React.FC = () => {
  useDocumentTitle('Login | Veritelligent');
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ userName: '', userPass: '' });
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);
  const logoClickCount = useRef(0);
  const logoClickTimeout = useRef<NodeJS.Timeout | null>(null);

  const handleLogoClick = () => {
    logoClickCount.current += 1;
    if (logoClickTimeout.current) clearTimeout(logoClickTimeout.current);
    logoClickTimeout.current = setTimeout(() => {
      logoClickCount.current = 0;
    }, 1000); // 1 second window for triple click

    if (logoClickCount.current === 3) {
      logoClickCount.current = 0;
      navigate('/signup-teacher');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
        ...formData,
        [e.target.name]: e.target.value.trim()
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const loginData = {
        userName: formData.userName.trim(),
        userPass: formData.userPass.trim()
    };
    
    try {
      console.log('Attempting login with:', loginData);
      const response = await fetch('https://api.veritelligent.fun/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData)
      });
      
      const data = await response.json();
      console.log('Login response:', data);
      
      if (!response.ok) throw new Error(data.message || 'Login failed');
      
      // Store user data and token
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('token', data.token);
      
      // Navigate based on role
      if (data.user.userRole === 'student') {
        console.log('Navigating student to /student');
        navigate('/student');
      } else if (data.user.userRole === 'teacher') {
        console.log('Navigating teacher to /home');
        navigate('/home');
      }
    } catch (err) {
      console.error('Login error:', err);
      // Clear any old/invalid tokens on login failure
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-header">
        <img
          src={logo}
          alt="Login Illustration"
          onClick={handleLogoClick}
        />
        <h1>Welcome to VERITELLIGENT</h1>
        <p>Your gateway to fun and learning!</p>
      </div>
      <div className="auth-box">
        <h2>LOGIN</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username:</label>
            <input
              type="text"
              name="userName"
              value={formData.userName}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group" style={{ position: 'relative' }}>
            <label>Password:</label>
            <input
              type={showPass ? 'text' : 'password'}
              name="userPass"
              value={formData.userPass}
              onChange={handleChange}
              required
            />
            <button
              type="button"
              aria-label={showPass ? 'Hide password' : 'Show password'}
              onClick={() => setShowPass(v => !v)}
              style={{
                position: 'absolute',
                right: 8,
                top: 32,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#555'
              }}
            >
              {showPass ? 'Hide' : 'Show'}
            </button>
          </div>
          <div style={{ textAlign: 'right', marginBottom: '12px' }}>
            <Link
              to="/forgot-password"
              style={{
                color: '#03a696',
                textDecoration: 'none',
                fontSize: '14px'
              }}
            >
              Forgot Password?
            </Link>
          </div>
          <button type="submit" className="auth-button">
            Login
          </button>
        </form>
        <Link
          to="/signup"
          className="auth-button secondary"
          style={{ marginTop: '1rem', display: 'inline-block', textAlign: 'center' }}
        >
          Sign Up
        </Link>
      </div>
    </div>
  );
};

export default Login;