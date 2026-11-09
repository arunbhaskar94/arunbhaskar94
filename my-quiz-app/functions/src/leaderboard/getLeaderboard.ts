import { getFirestore } from "firebase-admin/firestore";
import { z } from "zod";
import { createSecureHandler } from "../middleware/secureHandler";
import { isAnonymousIdentity } from "../middleware/roleGate";
import { getRedis } from "../redis/client";
import { getCohortForLevel, getUtcPeriodKeys } from "../gamification/xpEngine";

const leaderboardInputSchema = z
  .object({
    kind: z.enum(["daily", "weekly", "subject"]),
    subject: z.string().trim().min(1).max(100).optional(),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.kind === "subject" && !input.subject) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["subject"],
        message: "Choose a subject for the subject leaderboard.",
      });
    }
    if (input.kind !== "subject" && input.subject) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["subject"],
        message: "A subject is only valid for a subject leaderboard.",
      });
    }
  });

const leaderboardOutputSchema = z.object({
  cohortStartLevel: z.number().int().min(1).max(91),
  ownRank: z.number().int().positive().nullable(),
  entries: z.array(
    z.object({
      rank: z.number().int().positive(),
      displayName: z.string(),
      level: z.number().int().min(1).max(100),
      score: z.number().nonnegative(),
      isCurrentUser: z.boolean(),
    }),
  ).max(50),
});

function getLeaderboardKey(
  kind: "daily" | "weekly" | "subject",
  subject: string | undefined,
  cohort: number,
): string {
  const { daily, weekly } = getUtcPeriodKeys();
  if (kind === "daily") {
    return `leaderboard:daily:${daily}:cohort:${cohort}`;
  }
  if (kind === "weekly") {
    return `leaderboard:weekly:${weekly}:cohort:${cohort}`;
  }
  if (!subject) {
    throw new Error("A subject leaderboard requires a subject.");
  }
  return `leaderboard:subject:${encodeURIComponent(subject.toLowerCase())}:cohort:${cohort}`;
}

export const getLeaderboard = createSecureHandler({
  name: "leaderboard-get",
  access: "anon",
  userRateLimit: { limit: 60, window: "1 h" },
  inputSchema: leaderboardInputSchema,
  outputSchema: leaderboardOutputSchema,
  handler: async ({ kind, subject }, identity) => {
    const db = getFirestore();
    const profileCollection = isAnonymousIdentity(identity) ? "anon_profiles" : "users";
    const profileSnapshot = await db.collection(profileCollection).doc(identity.uid).get();
    const profile = profileSnapshot.data() ?? {};
    const levelValue =
      profileCollection === "anon_profiles" ? profile.stats?.level : profile.level;
    const level =
      typeof levelValue === "number" && Number.isInteger(levelValue)
        ? Math.min(100, Math.max(1, levelValue))
        : 1;
    const cohortStartLevel = getCohortForLevel(level);
    const key = getLeaderboardKey(kind, subject, cohortStartLevel);
    const redis = getRedis();
    const [rankedMembers, currentRank] = await Promise.all([
      redis.zrange<unknown[]>(key, 0, 49, { rev: true, withScores: true }),
      redis.zrevrank(key, identity.uid),
    ]);

    const ranked: { uid: string; score: number; rank: number }[] = [];
    for (let index = 0; index + 1 < rankedMembers.length; index += 2) {
      const uid = rankedMembers[index];
      const score = rankedMembers[index + 1];
      if (typeof uid === "string" && typeof score === "number" && Number.isFinite(score)) {
        ranked.push({ uid, score, rank: index / 2 + 1 });
      }
    }

    const userRefs = ranked.map((entry) => db.collection("users").doc(entry.uid));
    const anonymousRefs = ranked.map((entry) => db.collection("anon_profiles").doc(entry.uid));
    const [userSnapshots, anonymousSnapshots] =
      ranked.length > 0
        ? await Promise.all([db.getAll(...userRefs), db.getAll(...anonymousRefs)])
        : [[], []];
    const entries = ranked.map((entry, index) => {
      const user = userSnapshots[index].data();
      const anonymous = anonymousSnapshots[index].data();
      const publicProfile = user ?? anonymous ?? {};
      const entryLevel =
        typeof publicProfile.level === "number"
          ? publicProfile.level
          : typeof publicProfile.stats?.level === "number"
            ? publicProfile.stats.level
            : cohortStartLevel;
      const safeDisplayName =
        typeof publicProfile.displayName === "string"
          ? publicProfile.displayName
              .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "")
              .trim()
              .slice(0, 60)
          : "";
      return {
        rank: entry.rank,
        displayName: safeDisplayName || "Learner",
        level: Math.min(100, Math.max(1, entryLevel)),
        score: entry.score,
        isCurrentUser: entry.uid === identity.uid,
      };
    });

    return {
      cohortStartLevel,
      ownRank: currentRank === null ? null : currentRank + 1,
      entries,
    };
  },
});