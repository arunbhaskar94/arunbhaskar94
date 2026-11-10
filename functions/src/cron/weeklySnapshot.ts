import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getRedis } from "../redis/client";
import { getUtcPeriodKeys } from "../gamification/xpEngine";

function leaderboardEntries(values: unknown[]): { uid: string; score: number; rank: number }[] {
  const entries: { uid: string; score: number; rank: number }[] = [];
  for (let index = 0; index + 1 < values.length; index += 2) {
    const uid = values[index];
    const rawScore = values[index + 1];
    const score = typeof rawScore === "number"
      ? rawScore
      : typeof rawScore === "string"
        ? Number(rawScore)
        : Number.NaN;
    if (typeof uid === "string" && Number.isFinite(score)) {
      entries.push({ uid, score, rank: entries.length + 1 });
    }
  }
  return entries;
}

export const weeklySnapshot = onSchedule(
  {
    schedule: "0 23 * * 0",
    timeZone: "Etc/UTC",
    region: "asia-south1",
  },
  async () => {
    const db = getFirestore();
    const redis = getRedis();
    const { weekly } = getUtcPeriodKeys();
    const batch = db.batch();

    for (let cohort = 1; cohort <= 91; cohort += 10) {
      const key = `leaderboard:weekly:${weekly}:cohort:${cohort}`;
      const rankedMembers = await redis.zrange<unknown[]>(key, 0, 99, {
        rev: true,
        withScores: true,
      });
      const snapshotRef = db.collection("leaderboards").doc(`weekly_${weekly}_cohort_${cohort}`);
      const now = FieldValue.serverTimestamp();
      batch.set(snapshotRef, {
        period: weekly,
        type: "weekly",
        cohortStartLevel: cohort,
        entries: leaderboardEntries(rankedMembers),
        snapshotAt: now,
        lastSeenAt: now,
      });
    }
    await batch.commit();
  },
);