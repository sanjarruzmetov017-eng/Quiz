
export interface Word {
  id: string;
  en: string;
  uz: string;
}

export interface QuizOption {
  id: string;
  text: string;
}

export interface QuizQuestion {
  wordId: string;
  questionText: string;
  options: QuizOption[];
  correctId: string;
}

export interface UserStats {
  correct: number;
  wrong: number;
  streak: number;
  bestStreak: number;
  totalWords: number;
}

export type Tab = 'add' | 'history' | 'quiz';
