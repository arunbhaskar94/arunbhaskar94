export type AttemptAnswer = {
  questionId: string;
  selectedOptionIndex: number | null;
  isCorrect: boolean;
  timeSpentSeconds: number;
};

export type Attempt = {
  id: string;
  uid: string;
  mode: "subject" | "full_mock" | "pyq" | "daily_challenge" | "reel";
  subject: string | null;
  answers: AttemptAnswer[];
  startedAt: string;
  completedAt: string | null;
  score: number;
  xpEarned: number;
};