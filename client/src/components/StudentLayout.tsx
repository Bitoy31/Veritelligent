import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import '../styles/student.css';
import StudentProfile from './StudentProfile';

interface StudentLayoutProps {
  children: React.ReactNode;
}

const StudentLayout: React.FC<StudentLayoutProps> = ({ children }) => {
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="dashboard-header">
        <div className="student-info">
          <h1>{user.userFname} {user.userLname}</h1>
          <p>{user.userEmail}</p>
        </div>
      </div>

      {/* Navigation */}
      <div className="student-nav">
        <Link 
          to="/student" 
          className={`nav-item ${location.pathname === '/student' ? 'active' : ''}`}
        >
          <i className="fas fa-home"></i>
          <span>Home</span>
        </Link>
        <Link 
          to="/student/games" 
          className={`nav-item ${location.pathname.includes('/games') ? 'active' : ''}`}
        >
          <i className="fas fa-gamepad"></i>
          <span>Games</span>
        </Link>
        <Link 
          to="/student/sessions" 
          className={`nav-item ${location.pathname.includes('/sessions') ? 'active' : ''}`}
        >
          <i className="fas fa-clipboard-list"></i>
          <span>Sessions</span>
        </Link>
        <Link 
          to="/student/leaderboard" 
          className={`nav-item ${location.pathname.includes('/leaderboard') ? 'active' : ''}`}
        >
          <i className="fas fa-trophy"></i>
          <span>Leaderboard</span>
        </Link>
      </div>

      {/* Main Content */}
      <div className="dashboard-content">
        {children}
      </div>

      {/* Floating Profile */}
      <StudentProfile />
    </div>
  );
};

export default StudentLayout; 