interface QuestionOption {
    label: string;
    text: string;
}

interface QuestionAnswer {
    question: string;
    answer: string;
    options?: QuestionOption[];
    points: number;
    timeLimit: number; // in seconds
    type: 'multiple_choice' | 'text_input';
    explanation?: string;
}

interface ClassAvailability {
    course: string;
    year: string;
    block: string;
}

interface GameSettings {
    showLeaderboard: boolean;
    allowRetries: boolean;
    streakBonus: boolean;
    quickAnswerBonus: boolean;
    quickAnswerTimeThreshold: number; // in seconds
    streakMultiplier: number;
}

interface Task {
    _id: string;
    subjectCode: string;
    subjectTeacher: string;
    taskSubject: string;
    taskTopic: string;
    taskAvailableTo: ClassAvailability[];
    taskQuestionAnswer: QuestionAnswer[];
    gameSettings: GameSettings;
    isGameMode: boolean;
    roomCode?: string;
    status?: 'draft' | 'active' | 'completed';
}

export type { Task, QuestionAnswer, ClassAvailability, GameSettings, QuestionOption };