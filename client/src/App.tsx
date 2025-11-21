// import './App.css';
import { Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/teachers/Home';

import Login from './pages/auth/Login';
import ForgotPassword from './pages/auth/ForgotPassword';
import AddTask from './pages/teachers/AddTask';
import SoloGames from './pages/teachers/SoloGames';
import GameManagement from './pages/teachers/GameManagement';
import QuizManagement from './pages/teachers/QuizManagement';
import PartyGameManagement from './pages/teachers/PartyGameManagement';
import QuizSessionAnalytics from './pages/teachers/QuizSessionAnalytics';
import SessionsList from './pages/teachers/SessionsList';
import TeacherLeaderboard from './pages/teachers/TeacherLeaderboard';

import ProfileEdit from './pages/profile/ProfileEdit';
import StudentDashboard from './pages/student/StudentDashboard';
import SignUp from './pages/auth/SignUp';
import SignUpTeacher from './pages/auth/SignUpTeacher';
import ChangePassword from './pages/auth/ChangePassword';
import Management from './pages/teachers/Management';
import QuizTaking from './pages/student/QuizTaking';
import QuizResults from './pages/student/QuizResults';
import StudentGames from './pages/student/StudentGames';
import StudentSoloGames from './pages/student/StudentSoloGames';
import QuizSelection from './pages/student/QuizSelection';
import StudentLayout from './components/StudentLayout';
import StudentLeaderboard from './pages/student/StudentLeaderboard';
import StudentPartyGames from './pages/student/StudentPartyGames';
import HostQuizGame from './pages/teachers/HostQuizGame';
import StudentLiveQuiz from './pages/student/StudentLiveQuiz';
import HostGridQuest from './pages/teachers/HostGridQuest';
import StudentGridQuest from './pages/student/StudentGridQuest';
import GridQuestManagement from './pages/teachers/GridQuestManagement';
import GridQuestAnalytics from './pages/teachers/GridQuestAnalytics';
import GridQuestJoin from './pages/student/GridQuestJoin';
import StudentSessions from './pages/student/StudentSessions';
import FlashcardManagement from './pages/teachers/FlashcardManagement';
import HostFlashcard from './pages/teachers/HostFlashcard';
import FlashcardAnalytics from './pages/teachers/FlashcardAnalytics';
import FlashcardJoin from './pages/student/FlashcardJoin';
import StudentFlashcard from './pages/student/StudentFlashcard';
import BuzzerBattleManagement from './pages/teachers/BuzzerBattleManagement';
import HostBuzzerBattle from './pages/teachers/HostBuzzerBattle';
import BuzzerBattleAnalytics from './pages/teachers/BuzzerBattleAnalytics';
import BuzzerBattleJoin from './pages/student/BuzzerBattleJoin';
import StudentBuzzerBattle from './pages/student/StudentBuzzerBattle';
// Removed per rename/cleanup: TeacherSessionAnalytics

function App() {
  const location = useLocation();
  useEffect(() => {
    const path = location.pathname.toLowerCase();
    let title = 'Veritelligent';
    if (path === '/' || path === '/login') title = 'Login | Veritelligent';
    else if (path === '/signup') title = 'Sign Up | Veritelligent';
    else if (path === '/signup-teacher') title = 'Teacher Sign Up | Veritelligent';
    else if (path === '/home') title = 'Teacher Home | Veritelligent';
    else if (path === '/teacher/solo-games') title = 'Solo | Veritelligent';
    else if (path === '/teacher/party-games') title = 'Party | Veritelligent';
    else if (path.startsWith('/teacher/quiz-analytics')) title = 'Quiz Analytics | Veritelligent';
    else if (path.startsWith('/teacher/grid-quest-analytics')) title = 'Grid Quest Analytics | Veritelligent';
    else if (path.startsWith('/teacher/flashcard-analytics')) title = 'Flashcard Analytics | Veritelligent';
    else if (path.startsWith('/teacher/buzzer-battle-analytics')) title = 'Buzzer Battle Analytics | Veritelligent';
    else if (path.startsWith('/teacher/quiz')) title = 'Quiz Management | Veritelligent';
    else if (path.startsWith('/teacher/grid-quest')) title = 'Grid Quest | Veritelligent';
    else if (path.startsWith('/teacher/flashcard')) title = 'Flashcard | Veritelligent';
    else if (path.startsWith('/teacher/buzzer-battle')) title = 'Buzzer Battle | Veritelligent';
    else if (path === '/teacher/sessions') title = 'Teacher Sessions | Veritelligent';
    else if (path === '/teacher/leaderboard') title = 'Teacher Leaderboard | Veritelligent';
    else if (path === '/student') title = 'Student Home | Veritelligent';
    else if (path.startsWith('/student/sessions')) title = 'My Sessions | Veritelligent';
    else if (path.startsWith('/student/games')) title = 'Student Games | Veritelligent';
    else if (path.startsWith('/student/solo-games')) title = 'Student Solo Games | Veritelligent';
    else if (path.startsWith('/student/party-games')) title = 'Student Party Games | Veritelligent';
    else if (path.startsWith('/student/live')) title = 'Live Quiz | Veritelligent';
    else if (path.startsWith('/student/quiz')) title = 'Quiz | Veritelligent';
    else if (path.startsWith('/student/buzzer-battle')) title = 'Buzzer Battle | Veritelligent';
    else if (path.startsWith('/student/grid-quest')) title = 'Grid Quest | Veritelligent';
    else if (path.startsWith('/student/flashcard')) title = 'Flashcard | Veritelligent';
    else if (path.startsWith('/profile')) title = 'Profile | Veritelligent';
    document.title = title;
  }, [location]);
  return (
    <main className="main-content">
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/signup-teacher" element={<SignUpTeacher />} />
        
        {/* Protected Teacher Routes */}
        <Route path="/home" element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <Home />
          </ProtectedRoute>
        } />
        <Route path="/teacher" element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <Management />
          </ProtectedRoute>
        } />
        <Route path="/teacher/solo-games" element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <SoloGames />
          </ProtectedRoute>
        } />
        <Route path="/teacher/quiz" element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <QuizManagement />
          </ProtectedRoute>
        } />
        <Route path="/teacher/quiz/create" element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <QuizManagement />
          </ProtectedRoute>
        } />
        <Route path="/teacher/quiz/edit/:quizId" element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <QuizManagement />
          </ProtectedRoute>
        } />
        <Route path="/teacher/quiz/host/:quizId" element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <HostQuizGame />
          </ProtectedRoute>
        } />
        <Route path="/teacher/grid-quest" element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <GridQuestManagement />
          </ProtectedRoute>
        } />
        <Route path="/teacher/grid-quest/host" element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <HostGridQuest />
          </ProtectedRoute>
        } />
        <Route path="/teacher/grid-quest-analytics/:sessionId" element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <GridQuestAnalytics />
          </ProtectedRoute>
        } />
        <Route path="/teacher/flashcard" element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <FlashcardManagement />
          </ProtectedRoute>
        } />
        <Route path="/teacher/flashcard/host" element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <HostFlashcard />
          </ProtectedRoute>
        } />
        <Route path="/teacher/flashcard-analytics/:sessionId" element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <FlashcardAnalytics />
          </ProtectedRoute>
        } />
        <Route path="/teacher/buzzer-battle" element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <BuzzerBattleManagement />
          </ProtectedRoute>
        } />
        <Route path="/teacher/buzzer-battle/host" element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <HostBuzzerBattle />
          </ProtectedRoute>
        } />
        <Route path="/teacher/buzzer-battle-analytics/:sessionId" element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <BuzzerBattleAnalytics />
          </ProtectedRoute>
        } />
        <Route path="/teacher/game-management" element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <GameManagement />
          </ProtectedRoute>
        } />
        <Route path="/teacher/sessions" element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <SessionsList />
          </ProtectedRoute>
        } />
        <Route path="/teacher/quiz-analytics" element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <QuizSessionAnalytics />
          </ProtectedRoute>
        } />
        <Route path="/teacher/party-games" element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <PartyGameManagement />
          </ProtectedRoute>
        } />
        <Route path="/teacher/add-task" element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <AddTask />
          </ProtectedRoute>
        } />
        <Route path="/teacher/leaderboard" element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <TeacherLeaderboard />
          </ProtectedRoute>
        } />

        {/* Protected Student Routes */}
        <Route path="/student" element={
          <ProtectedRoute allowedRoles={['student']}>
            <StudentLayout>
              <StudentDashboard />
            </StudentLayout>
          </ProtectedRoute>
        } />
        <Route path="/student/quiz/:quizId" element={
          <ProtectedRoute allowedRoles={['student']}>
            <QuizTaking />
          </ProtectedRoute>
        } />
        <Route path="/student/quiz/:quizId/results" element={
          <ProtectedRoute allowedRoles={['student']}>
            <QuizResults />
          </ProtectedRoute>
        } />
        {/* Student Game Routes */}
        <Route path="/student/games" element={
          <ProtectedRoute allowedRoles={['student']}>
            <StudentLayout>
              <StudentGames />
            </StudentLayout>
          </ProtectedRoute>
        } />
        <Route path="/student/sessions" element={
          <ProtectedRoute allowedRoles={['student']}>
            <StudentLayout>
              <StudentSessions />
            </StudentLayout>
          </ProtectedRoute>
        } />
        <Route path="/student/solo-games" element={
          <ProtectedRoute allowedRoles={['student']}>
            <StudentLayout>
              <StudentSoloGames />
            </StudentLayout>
          </ProtectedRoute>
        } />
        <Route path="/student/solo-games/quiz" element={
          <ProtectedRoute allowedRoles={['student']}>
            <StudentLayout>
              <QuizSelection />
            </StudentLayout>
          </ProtectedRoute>
        } />
        <Route path="/student/solo-games/flashcard/join" element={
          <ProtectedRoute allowedRoles={['student']}>
            <StudentLayout>
              <FlashcardJoin />
            </StudentLayout>
          </ProtectedRoute>
        } />
        <Route path="/student/flashcard/:roomCode" element={
          <ProtectedRoute allowedRoles={['student']}>
            <StudentFlashcard />
          </ProtectedRoute>
        } />
        <Route path="/student/party-games" element={
          <ProtectedRoute allowedRoles={['student']}>
            <StudentLayout>
              <StudentPartyGames />
            </StudentLayout>
          </ProtectedRoute>
        } />
        <Route path="/student/party-games/grid-quest/join" element={
          <ProtectedRoute allowedRoles={['student']}>
            <StudentLayout>
              <GridQuestJoin />
            </StudentLayout>
          </ProtectedRoute>
        } />
        <Route path="/student/live/:roomCode" element={
          <ProtectedRoute allowedRoles={['student']}>
            <StudentLiveQuiz />
          </ProtectedRoute>
        } />
        <Route path="/student/grid-quest/:roomCode" element={
          <ProtectedRoute allowedRoles={['student']}>
            <StudentGridQuest />
          </ProtectedRoute>
        } />
        <Route path="/student/party-games/buzzer-battle/join" element={
          <ProtectedRoute allowedRoles={['student']}>
            <StudentLayout>
              <BuzzerBattleJoin />
            </StudentLayout>
          </ProtectedRoute>
        } />
        <Route path="/student/buzzer-battle/:roomCode" element={
          <ProtectedRoute allowedRoles={['student']}>
            <StudentBuzzerBattle />
          </ProtectedRoute>
        } />
        <Route path="/student/party-games/quiz-battle" element={
          <ProtectedRoute allowedRoles={['student']}>
            <StudentLayout>
              <div className="coming-soon">
                <h2>🎮 Quiz Battle</h2>
                <p>Real-time multiplayer quiz competition - Coming Soon!</p>
              </div>
            </StudentLayout>
          </ProtectedRoute>
        } />
        <Route path="/student/party-games/team-challenge" element={
          <ProtectedRoute allowedRoles={['student']}>
            <StudentLayout>
              <div className="coming-soon">
                <h2>👥 Team Challenge</h2>
                <p>Cooperative team-based challenges - Coming Soon!</p>
              </div>
            </StudentLayout>
          </ProtectedRoute>
        } />
        <Route path="/student/party-games/trivia-tournament" element={
          <ProtectedRoute allowedRoles={['student']}>
            <StudentLayout>
              <div className="coming-soon">
                <h2>🏆 Trivia Tournament</h2>
                <p>Championship bracket-style trivia - Coming Soon!</p>
              </div>
            </StudentLayout>
          </ProtectedRoute>
        } />
        <Route path="/student/leaderboard" element={
          <ProtectedRoute allowedRoles={['student']}>
            <StudentLayout>
              <StudentLeaderboard />
            </StudentLayout>
          </ProtectedRoute>
        } />
        <Route path="/student/multiplayer-games" element={
          <ProtectedRoute allowedRoles={['student']}>
            <StudentLayout>
              <div>Multiplayer Games - Coming Soon</div>
            </StudentLayout>
          </ProtectedRoute>
        } />
        <Route path="/student/tournament-games" element={
          <ProtectedRoute allowedRoles={['student']}>
            <StudentLayout>
              <div>Tournament Games - Coming Soon</div>
            </StudentLayout>
          </ProtectedRoute>
        } />

        {/* Protected Common Routes */}
        <Route path="/profile/edit" element={
          <ProtectedRoute allowedRoles={['teacher', 'student']}>
            <ProfileEdit />
          </ProtectedRoute>
        } />
        <Route path="/profile/change-password" element={
          <ProtectedRoute allowedRoles={['teacher', 'student']}>
            <ChangePassword />
          </ProtectedRoute>
        } />

        {/* 404 Route */}
        <Route path="*" element={<h1>404 Not Found</h1>} />
      </Routes>
    </main>
  );
}

export default App;
