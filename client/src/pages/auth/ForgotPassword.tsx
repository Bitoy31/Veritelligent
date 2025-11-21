import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../../styles/auth.css';
import logo from '../../images/auth/LOGO_Veritelligent.png';

const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<'request' | 'verify' | 'reset'>('request');
  const [formData, setFormData] = useState({ email: '', userName: '', otpCode: '', newPassword: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [useEmail, setUseEmail] = useState(true);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value.trim()
    });
    setError('');
  };

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const payload = useEmail 
        ? { email: formData.email }
        : { userName: formData.userName };

      const response = await fetch('https://api.veritelligent.fun/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send OTP');
      }

      setSuccess(data.message || 'OTP code sent to your email');
      setStep('verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = {
        ...(useEmail ? { email: formData.email } : { userName: formData.userName }),
        otpCode: formData.otpCode
      };

      const response = await fetch('https://api.veritelligent.fun/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Invalid OTP code');
      }

      setStep('reset');
      setSuccess('OTP verified. Please enter your new password.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid OTP code');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.newPassword !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.newPassword.length < 4) {
      setError('Password must be at least 4 characters');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        ...(useEmail ? { email: formData.email } : { userName: formData.userName }),
        otpCode: formData.otpCode,
        newPassword: formData.newPassword
      };

      const response = await fetch('https://api.veritelligent.fun/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to reset password');
      }

      setSuccess('Password reset successfully! Redirecting to login...');
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-header">
        <img src={logo} alt="Veritelligent Logo" />
        <h1>Password Recovery</h1>
        <p>Reset your password using email verification</p>
      </div>
      <div className="auth-box">
        {step === 'request' && (
          <>
            <h2>Forgot Password</h2>
            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message" style={{ background: '#d1fae5', color: '#065f46', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>{success}</div>}
            <form onSubmit={handleRequestOTP}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px' }}>Identify by:</label>
                <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      checked={useEmail}
                      onChange={() => setUseEmail(true)}
                    />
                    Email
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      checked={!useEmail}
                      onChange={() => setUseEmail(false)}
                    />
                    Username
                  </label>
                </div>
              </div>
              {useEmail ? (
                <div className="form-group">
                  <label>Email:</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    placeholder="Enter your email"
                  />
                </div>
              ) : (
                <div className="form-group">
                  <label>Username:</label>
                  <input
                    type="text"
                    name="userName"
                    value={formData.userName}
                    onChange={handleChange}
                    required
                    placeholder="Enter your username"
                  />
                </div>
              )}
              <button type="submit" className="auth-button" disabled={loading}>
                {loading ? 'Sending...' : 'Send OTP Code'}
              </button>
            </form>
          </>
        )}

        {step === 'verify' && (
          <>
            <h2>Enter OTP Code</h2>
            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message" style={{ background: '#d1fae5', color: '#065f46', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>{success}</div>}
            <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '16px' }}>
              A 6-digit code has been sent to your email. Enter it below.
            </p>
            <form onSubmit={handleVerifyOTP}>
              <div className="form-group">
                <label>OTP Code:</label>
                <input
                  type="text"
                  name="otpCode"
                  value={formData.otpCode}
                  onChange={handleChange}
                  required
                  maxLength={6}
                  placeholder="000000"
                  style={{ 
                    textAlign: 'center', 
                    fontSize: '24px', 
                    letterSpacing: '8px',
                    fontFamily: 'monospace'
                  }}
                  onKeyPress={(e) => {
                    if (!/[0-9]/.test(e.key) && e.key !== 'Backspace') {
                      e.preventDefault();
                    }
                  }}
                />
              </div>
              <button type="submit" className="auth-button" disabled={loading}>
                {loading ? 'Verifying...' : 'Verify OTP'}
              </button>
              <button
                type="button"
                onClick={() => setStep('request')}
                className="auth-button secondary"
                style={{ marginTop: '8px' }}
              >
                Back
              </button>
            </form>
          </>
        )}

        {step === 'reset' && (
          <>
            <h2>Set New Password</h2>
            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message" style={{ background: '#d1fae5', color: '#065f46', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>{success}</div>}
            <form onSubmit={handleResetPassword}>
              <div className="form-group">
                <label>New Password:</label>
                <input
                  type="password"
                  name="newPassword"
                  value={formData.newPassword}
                  onChange={handleChange}
                  required
                  minLength={4}
                  placeholder="Enter new password"
                />
              </div>
              <div className="form-group">
                <label>Confirm Password:</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  minLength={4}
                  placeholder="Confirm new password"
                />
              </div>
              <button type="submit" className="auth-button" disabled={loading}>
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
              <button
                type="button"
                onClick={() => setStep('verify')}
                className="auth-button secondary"
                style={{ marginTop: '8px' }}
              >
                Back
              </button>
            </form>
          </>
        )}

        <Link
          to="/"
          style={{ 
            marginTop: '1rem', 
            display: 'block', 
            textAlign: 'center', 
            color: '#03a696',
            textDecoration: 'none'
          }}
        >
          Back to Login
        </Link>
      </div>
    </div>
  );
};

export default ForgotPassword;



