import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/teacher_profile.css';

const TeacherProfile: React.FC = () => {
    const navigate = useNavigate();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [userData, setUserData] = useState<any>(null);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            console.log('Loaded user data:', parsedUser); // Debug log
            setUserData(parsedUser);
        }
    }, []);

    const getInitials = () => {
        if (!userData) return '';
        const fname = userData.userFname?.[0] || '';
        const lname = userData.userLname?.[0] || '';
        return (fname + lname).toUpperCase();
    };

    const getFullName = () => {
        if (!userData) return '';
        const middleInitial = userData.userMname ? `${userData.userMname[0]}. ` : ' ';
        return `${userData.userFname} ${middleInitial}${userData.userLname}`;
    };

    const handleLogout = () => {
        if (!window.confirm('Are you sure you want to logout?')) return;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/');
    };

    return (
        <div className="profile-wrapper" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            <div className="profile-circle">
                {(() => {
                    const photo = userData?.userProfile || userData?.userProfilePic;
                    return photo ? (
                        <img 
                            src={photo} 
                            alt={getFullName()} 
                            className="profile-image"
                        />
                    ) : (
                        <div className="profile-initials">
                            {getInitials()}
                        </div>
                    );
                })()}
            </div>
            <div className={`profile-dropdown ${isMenuOpen ? 'active' : ''}`}>
                <div className="profile-info">
                    <h3>{getFullName()}</h3>
                    <p>{userData?.userEmail || ''}</p>
                </div>
                <div className="profile-actions">
                    <button 
                        className="profile-btn edit-btn"
                        onClick={() => navigate('/profile/edit')}
                    >
                        Edit Profile
                    </button>
                    <button 
                        className="profile-btn edit-btn"
                        onClick={() => navigate('/profile/change-password')}
                    >
                        Change Password
                    </button>
                    <button 
                        className="profile-btn logout-btn"
                        onClick={handleLogout}
                    >
                        Logout
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TeacherProfile;