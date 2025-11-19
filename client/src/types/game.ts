// Domain types for Multiplayer Educational Game (client-side)
// Delete this file if you decide not to use it.

// Primitive aliases
export type ObjectIdString = string;
export type ISODateString = string; // dates serialized from API

// App-wide roles and basic user info used by UI
export type UserRole = 'teacher' | 'student' | 'admin';

export interface UserRef {
  id: ObjectIdString;
  name?: string;
  role?: UserRole;
}

export interface SubjectRef {
  id: ObjectIdString;
  code: string; // e.g., IT 111
  name: string; // e.g., Introduction to Computing
  teacherId?: ObjectIdString;
}

// Categories and game types
export type GameCategory = 'solo' | 'party';

// Extend this with the exact fixed set your app supports
export type GameType =
  | 'quiz' // standard quiz (single/multi choice, text)
  | 'grid_quest'
  | 'flashcard' // recitation-style flashcard game
  | 'buzzer_battle'; // buzzer battle game

// Mirrors server Task.gameSettings shape (subset, extend as needed)
export interface GameSettings {
  showLeaderboard?: boolean;
  allowRetries?: boolean;
  streakBonus?: boolean;
  quickAnswerBonus?: boolean;
  quickAnswerTimeThreshold?: number; // seconds
  streakMultiplier?: number; // e.g., 1.5
  earlySubmissionBonus?: number; // flat bonus points
}

// Task acts as the blueprint/template configured by the teacher
export interface TaskSummary {
  id: ObjectIdString;
  subjectId: ObjectIdString;
  title: string;
  taskTopic: string;
  description?: string;
  totalPoints: number; // computed sum
  isGameMode: boolean;
  status: 'draft' | 'active' | 'archived' | 'published' | 'closed';
  dueDate?: ISODateString;
  gameSettings?: GameSettings;
}

// Live session created when the teacher hosts a game in class
export interface TeamInfo {
  teamId: string;
  name: string;
  memberIds: ObjectIdString[]; // student ids
}

export interface ParticipantInfo {
  studentId: ObjectIdString;
  joinedAt?: ISODateString;
  leftAt?: ISODateString;
}

export interface GameSession {
  id: ObjectIdString;
  taskId: ObjectIdString;
  subjectId: ObjectIdString;
  teacherId: ObjectIdString;
  category: GameCategory; // solo | party
  gameType: GameType;
  roomCode?: string; // used by live/party sessions
  settingsSnapshot?: GameSettings; // snapshot of Task settings at start
  isTeamBased?: boolean;
  teams?: TeamInfo[];
  participants?: ParticipantInfo[];
  status: 'scheduled' | 'active' | 'ended' | 'archived';
  startedAt?: ISODateString;
  endedAt?: ISODateString;
  // Populated data from analytics endpoint
  _taskData?: {
    _id: ObjectIdString;
    title: string;
  };
  _subjectData?: {
    _id: ObjectIdString;
    name: string;
    code: string;
  };
}

// Question-level answer record used by attempts
export interface AnswerRecord {
  questionIndex: number; // 0-based index into the task's question array
  selectedOption?: number; // index for MCQ; omit for text
  textAnswer?: string; // for text input questions
  isCorrect: boolean;
  timeTakenSec: number; // per question
  pointsEarned: number; // per question
}

// Scoring policy snapshot captured at attempt time for auditability
export interface ScoringPolicySnapshot {
  totalPointsPossible: number;
  allowRetries?: boolean;
  quickAnswerBonus?: boolean;
  quickAnswerTimeThreshold?: number;
  streakBonus?: boolean;
  streakMultiplier?: number;
  earlySubmissionBonus?: number;
}

// A single student's run (solo or during a live session)
export interface GameAttempt {
  id: ObjectIdString;
  taskId: ObjectIdString;
  sessionId?: ObjectIdString; // present for live/party; absent for solo without a live session
  subjectId: ObjectIdString;
  studentId: ObjectIdString;
  category: GameCategory;
  gameType: GameType;

  attemptNo: number; // 1..N according to policy
  startedAt: ISODateString;
  endedAt?: ISODateString;
  timeSpentSec?: number;

  answers: AnswerRecord[];
  scoringPolicy: ScoringPolicySnapshot;

  // aggregate scores
  totalScore: number; // raw from questions
  bonusPoints: number; // bonuses applied
  finalScore: number; // totalScore + bonusPoints
  accuracyPct?: number; // convenience metric
  streakCount?: number;
  quickAnswerCount?: number;

  status: 'completed' | 'in_progress' | 'abandoned';
  teamId?: string; // if team-based
}

// Leaderboard entry for either a session (live) or a task (class ranking)
export interface LeaderboardEntry {
  rank: number;
  studentId: ObjectIdString;
  name?: string; // for display convenience
  teamId?: string;
  finalScore: number;
  accuracyPct?: number;
  tieBreaker?: {
    timeMs?: number; // earlier finish wins ties
    streakCount?: number;
  };
}

export type LeaderboardScope = 'session' | 'task';

export interface Leaderboard {
  id: ObjectIdString;
  scope: LeaderboardScope;
  sessionId?: ObjectIdString; // required if scope === 'session'
  taskId: ObjectIdString;
  subjectId: ObjectIdString;
  standings: LeaderboardEntry[];
  computedAt: ISODateString;
  version?: number;
}

// Teacher-facing rollup for grading; can be derived from GameAttempt(s)
export type GradingPolicy = 'highest' | 'average' | 'last' | 'first';

export interface GradebookEntry {
  id: ObjectIdString;
  taskId: ObjectIdString;
  subjectId: ObjectIdString;
  studentId: ObjectIdString;
  gradingPolicy: GradingPolicy;
  attemptIds: ObjectIdString[];

  finalScore: number; // according to gradingPolicy
  percentage?: number; // finalScore / pointsPossible * 100
  pointsEarned?: number;
  pointsPossible?: number;

  lastSubmittedAt?: ISODateString;
  status: 'graded' | 'pending' | 'missing';
}

// Convenience DTOs for API payloads
export interface StartSessionDTO {
  taskId: ObjectIdString;
  subjectId: ObjectIdString;
  category: GameCategory;
  gameType: GameType;
  isTeamBased?: boolean;
}

export interface SubmitAnswerDTO {
  sessionId?: ObjectIdString;
  taskId: ObjectIdString;
  studentId: ObjectIdString;
  attemptNo: number;
  answer: AnswerRecord;
}

export interface FinalizeAttemptDTO {
  attemptId: ObjectIdString;
}



