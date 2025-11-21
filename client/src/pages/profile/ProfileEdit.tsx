import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';  // Add this import
import '../../styles/profile_edit.css';


interface UserProfile {
    userName: string;
    userFname: string;
    userMname: string;
    userLname: string;
    userEmail: string;
    userContact: string;
    userProfile: string;
}

const ProfileEdit: React.FC = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState<UserProfile>({
        userName: '',
        userFname: '',
        userMname: '',
        userLname: '',
        userEmail: '',
        userContact: '',
        userProfile: ''
    });
    const [error, setError] = useState('');
    const [imagePreview, setImagePreview] = useState<string>('');
    const [emailVerified, setEmailVerified] = useState(false);
    const [showOTPModal, setShowOTPModal] = useState(false);
    const [otpCode, setOtpCode] = useState('');
    const [verifyingEmail, setVerifyingEmail] = useState(false);
    const [originalEmail, setOriginalEmail] = useState('');

    useEffect(() => {
        const userData = JSON.parse(localStorage.getItem('user') || '{}');
        try {
            // Set all form data including the formatted classes
            setFormData({
                userName: userData.userName || '',
                userFname: userData.userFname || '',
                userMname: userData.userMname || '',
                userLname: userData.userLname || '',
                userEmail: userData.userEmail || '',
                userContact: userData.userContact || '',
                userProfile: userData.userProfile || '',
            });

            setOriginalEmail(userData.userEmail || '');
            setEmailVerified(userData.emailVerified || false);

            // Set image preview if profile picture exists
            if (userData.userProfile) {
                setImagePreview(userData.userProfile);
            }
        } catch (error) {
            console.error('Error parsing user data:', error);
            toast.error('Error loading user data');
        }
    }, []);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;
                setImagePreview(base64String);
                setFormData(prev => ({
                    ...prev,
                    userProfile: base64String
                }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const userData = JSON.parse(localStorage.getItem('user') || '{}');

            // Only send fields your DB supports
            const payload = {
                userName: formData.userName,
                userFname: formData.userFname,
                userMname: formData.userMname,
                userLname: formData.userLname,
                userEmail: formData.userEmail,
                userContact: formData.userContact,
                userProfile: formData.userProfile,
                // userRole: userData.userRole, // include if you want to allow role editing
            };

            const response = await fetch(`https://api.veritelligent.fun/api/users/${userData._id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error('Failed to update profile');
            }

            const updatedUser = await response.json();

            // If email changed, reset verification status
            if (formData.userEmail !== originalEmail) {
                setEmailVerified(false);
                setOriginalEmail(formData.userEmail);
            }

            // Update localStorage with new data
            localStorage.setItem('user', JSON.stringify({
                ...userData,
                ...updatedUser,
                emailVerified: formData.userEmail === originalEmail ? emailVerified : false
            }));

            toast.success('Profile updated successfully!');
            setTimeout(() => navigate('/home'), 1500);

        } catch (error) {
            toast.error('Failed to update profile');
            console.error('Update error:', error);
        }
    };

    const handleSendVerificationEmail = async () => {
        if (!formData.userEmail || !formData.userEmail.includes('@')) {
            toast.error('Please enter a valid email address');
            return;
        }

        setVerifyingEmail(true);
        try {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            const response = await fetch('https://api.veritelligent.fun/api/auth/verify-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to send verification email');
            }

            toast.success('Verification code sent to your email');
            setShowOTPModal(true);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to send verification email');
        } finally {
            setVerifyingEmail(false);
        }
    };

    const handleVerifyOTP = async () => {
        if (!otpCode || otpCode.length !== 6) {
            toast.error('Please enter a valid 6-digit OTP code');
            return;
        }

        setVerifyingEmail(true);
        try {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            const response = await fetch('https://api.veritelligent.fun/api/auth/confirm-email-verification', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ otpCode })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Invalid verification code');
            }

            setEmailVerified(true);
            setShowOTPModal(false);
            setOtpCode('');

            // Update localStorage
            const userData = JSON.parse(localStorage.getItem('user') || '{}');
            localStorage.setItem('user', JSON.stringify({
                ...userData,
                emailVerified: true,
                emailVerifiedAt: new Date().toISOString()
            }));

            toast.success('Email verified successfully!');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to verify email');
        } finally {
            setVerifyingEmail(false);
        }
    };

    return (
        <div className="profile-edit-wrapper">
            <ToastContainer 
                position="top-right"
                autoClose={3000}
                hideProgressBar={false}
                closeOnClick
                pauseOnHover
                draggable
            />
            <div className="profile-edit-container">
                <h2>Edit Profile</h2>
                {error && <div className="error-message">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="profile-picture-section">
                        <div className="profile-picture-container">
                            {(imagePreview || formData.userProfile) ? (
                                <img 
                                    src={imagePreview || formData.userProfile} 
                                    alt="Profile Preview" 
                                    className="profile-preview"
                                />
                            ) : (
                                <div className="profile-placeholder">
                                    <i className="fas fa-user"></i>
                                </div>
                            )}
                        </div>
                        <div className="profile-upload-controls">
                            <label htmlFor="profile-upload" className="upload-btn">
                                Change Picture
                            </label>
                            <input
                                id="profile-upload"
                                type="file"
                                accept="image/*"
                                onChange={handleImageChange}
                                style={{ display: 'none' }}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Username</label>
                        <input
                            type="text"
                            value={formData.userName}
                            onChange={(e) => setFormData({...formData, userName: e.target.value})}
                            required
                        />
                    </div>

                    <div className="name-row">
                        <div className="form-group">
                            <label>First Name</label>
                            <input
                                type="text"
                                value={formData.userFname}
                                onChange={(e) => setFormData({...formData, userFname: e.target.value})}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Middle Name</label>
                            <input
                                type="text"
                                value={formData.userMname}
                                onChange={(e) => setFormData({...formData, userMname: e.target.value})}
                            />
                        </div>

                        <div className="form-group">
                            <label>Last Name</label>
                            <input
                                type="text"
                                value={formData.userLname}
                                onChange={(e) => setFormData({...formData, userLname: e.target.value})}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>
                            Email
                            {emailVerified ? (
                                <span style={{ 
                                    marginLeft: '8px', 
                                    color: '#059669', 
                                    fontSize: '12px',
                                    fontWeight: 'normal'
                                }}>
                                    ✓ Verified
                                </span>
                            ) : (
                                <span style={{ 
                                    marginLeft: '8px', 
                                    color: '#dc2626', 
                                    fontSize: '12px',
                                    fontWeight: 'normal'
                                }}>
                                    ⚠ Not Verified
                                </span>
                            )}
                        </label>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                            <input
                                type="email"
                                value={formData.userEmail}
                                onChange={(e) => setFormData({...formData, userEmail: e.target.value})}
                                required
                                style={{ flex: 1 }}
                            />
                            {!emailVerified && formData.userEmail && formData.userEmail.includes('@') && (
                                <button
                                    type="button"
                                    onClick={handleSendVerificationEmail}
                                    disabled={verifyingEmail}
                                    style={{
                                        padding: '8px 16px',
                                        background: '#03a696',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: verifyingEmail ? 'not-allowed' : 'pointer',
                                        fontSize: '14px',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    {verifyingEmail ? 'Sending...' : 'Verify Email'}
                                </button>
                            )}
                        </div>
                        {!emailVerified && formData.userEmail && (
                            <p style={{ 
                                marginTop: '4px', 
                                fontSize: '12px', 
                                color: '#dc2626',
                                marginBottom: 0
                            }}>
                                Email verification is required for password recovery. Please verify your email.
                            </p>
                        )}
                    </div>

                    <div className="form-group">
                        <label>Contact Number</label>
                        <input
                            type="tel"
                            value={formData.userContact}
                            onChange={(e) => setFormData({...formData, userContact: e.target.value})}
                            required
                        />
                    </div>

                    <div className="button-group">
                        <button type="submit" className="btn-save">
                            Save Changes
                        </button>
                        <button 
                            type="button" 
                            className="btn-cancel"
                            onClick={() => navigate(-1)}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>

            {/* OTP Verification Modal */}
            {showOTPModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        background: 'white',
                        padding: '2rem',
                        borderRadius: '8px',
                        maxWidth: '400px',
                        width: '90%',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                    }}>
                        <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Verify Email</h3>
                        <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '1rem' }}>
                            Enter the 6-digit code sent to <strong>{formData.userEmail}</strong>
                        </p>
                        <div style={{ marginBottom: '1rem' }}>
                            <input
                                type="text"
                                value={otpCode}
                                onChange={(e) => {
                                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                                    setOtpCode(value);
                                }}
                                placeholder="000000"
                                maxLength={6}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    fontSize: '24px',
                                    textAlign: 'center',
                                    letterSpacing: '8px',
                                    fontFamily: 'monospace',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '6px'
                                }}
                                autoFocus
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={handleVerifyOTP}
                                disabled={verifyingEmail || otpCode.length !== 6}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    background: '#03a696',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: (verifyingEmail || otpCode.length !== 6) ? 'not-allowed' : 'pointer',
                                    opacity: (verifyingEmail || otpCode.length !== 6) ? 0.6 : 1
                                }}
                            >
                                {verifyingEmail ? 'Verifying...' : 'Verify'}
                            </button>
                            <button
                                onClick={() => {
                                    setShowOTPModal(false);
                                    setOtpCode('');
                                }}
                                style={{
                                    padding: '12px 24px',
                                    background: '#f3f4f6',
                                    color: '#374151',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProfileEdit;