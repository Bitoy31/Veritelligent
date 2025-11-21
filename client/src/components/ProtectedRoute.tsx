import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles = ['teacher', 'student'] }) => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  
  // Check if user is logged in
  if (!user || !user._id) {
    return <Navigate to="/" replace />;
  }

  // Check if user role is allowed
  if (!allowedRoles.includes(user.userRole)) {
    // Redirect teachers to /home and students to /student
    const redirectPath = user.userRole === 'teacher' ? '/home' : '/';
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;