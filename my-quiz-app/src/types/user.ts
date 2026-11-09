import type { z } from "zod";
import type { userSchema } from "@/lib/api/schemas";

export type UserRole = z.infer<typeof userSchema>["role"];
export type User = z.infer<typeof userSchema>;

export type UserStats = {
  totalAttempts: number;
  correct: number;
  xp: number;
  level: number;
  streak: number;
  coins: number;
};

export type UserProfile = User & {
  createdAt: string;
  lastSeenAt: string;
  badges: string[];
  linkedProviders: string[];
  settings: {
    theme: "light" | "dark" | "system";
    language: string;
    notifications: boolean;
  };
  stats: UserStats;
};

export type AnonymousProfile = {
  createdAt: string;
  lastSeenAt: string;
  deviceHint: string;
  stats: UserStats;
};