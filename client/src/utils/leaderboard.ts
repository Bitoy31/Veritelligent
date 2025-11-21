import type { GameType } from '../types/game';

export const formatGameTypeLabel = (gameType: string): string => {
  const map: Record<string, string> = {
    quiz: 'Quiz',
    grid_quest: 'Grid Quest',
    flashcard: 'Flashcard',
    buzzer_battle: 'Buzzer Battle'
  };
  return map[gameType] || gameType;
};

export const getCategoryGames = (category: 'solo' | 'party'): GameType[] => {
  if (category === 'solo') {
    return ['quiz', 'flashcard'];
  } else {
    return ['grid_quest', 'buzzer_battle'];
  }
};

export interface LeaderboardEntry {
  rank: number;
  studentId: string;
  studentName: string;
  finalScore: number;
  accuracyPct?: number;
  gamesPlayed: number;
}

