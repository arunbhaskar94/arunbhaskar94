export type GamificationStats = {
  xp: number;
  level: number;
  streak: number;
  coins: number;
};

export type Badge = {
  id: string;
  name: string;
  unlockedAt: string | null;
};

export type RankTier = "Bronze" | "Silver" | "Gold" | "Diamond" | "Master";

export type LeaderboardEntry = {
  rank: number;
  displayName: string;
  level: number;
  score: number;
  isCurrentUser: boolean;
};