import { FieldValue, getFirestore } from "firebase-admin/firestore";
import type { DocumentReference, DocumentSnapshot } from "firebase-admin/firestore";
import { getRedis } from "../redis/client";

type AttemptEvent = {
  profileCollection: string;
  uid: string;
  attemptId: string;
};

type LeaderboardSync = {
  uid: string;
  oldCohort: number | null;
  cohort: number;
  subject: string | null;
  award: number;
};

const xpPerCorrectAnswer = 10;
const xpPerCompletedMock = 50;

export function getLevelForXp(xp: number): number {
  return Math.min(100, Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / 100))));
}

export function getCohortForLevel(level: number): number {
  return Math.floor((Math.min(100, Math.max(1, level)) - 1) / 10) * 10 + 1;
}

export function getUtcPeriodKeys(now = new Date()): { daily: string; weekly: string } {
  const daily = now.toISOString().slice(0, 10);
  const utcDay = now.getUTCDay() || 7;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - utcDay + 1);
  const weekly = monday.toISOString().slice(0, 10);
  return { daily, weekly };
}

function getLeaderboardKeys(
  sync: LeaderboardSync,
  periodKeys: { daily: string; weekly: string },
): string[] {
  const cohort = sync.cohort;
  const keys = [
    `leaderboard:daily:${periodKeys.daily}:cohort:${cohort}`,
    `leaderboard:weekly:${periodKeys.weekly}:cohort:${cohort}`,
  ];
  if (sync.subject) {
    keys.push(
      `leaderboard:subject:${encodeURIComponent(sync.subject.toLowerCase())}:cohort:${cohort}`,
    );
  }
  return keys;
}

export async function syncLeaderboardAward(eventId: string, sync: LeaderboardSync): Promise<void> {
  if (sync.award <= 0) {
    return;
  }
  const redis = getRedis();
  const { daily, weekly } = getUtcPeriodKeys();
  const currentKeys = getLeaderboardKeys(sync, { daily, weekly });
  const oldKeys =
    sync.oldCohort !== null && sync.oldCohort !== sync.cohort
      ? getLeaderboardKeys({ ...sync, cohort: sync.oldCohort }, { daily, weekly })
      : [];
  const allKeys = [...new Set([...currentKeys, ...oldKeys])];
  const script = `
    if redis.call("EXISTS", KEYS[1]) == 1 then
      return 0
    end
    redis.call("SET", KEYS[1], "1", "EX", 900000)
    for i = 2, #KEYS do
      if ARGV[i - 1] == "remove" then
        redis.call("ZREM", KEYS[i], ARGV[#ARGV])
      else
        redis.call("ZINCRBY", KEYS[i], ARGV[#ARGV - 1], ARGV[#ARGV])
        redis.call("EXPIRE", KEYS[i], 7776000)
      end
    end
    return 1
  `;
  const operations = allKeys.map((key) => (oldKeys.includes(key) ? "remove" : "add"));
  await redis.eval(
    script,
    [`gamification:leaderboard-event:${eventId}`, ...allKeys],
    [...operations, String(sync.award), sync.uid],
  );
}

function getProfileReferences(
  profileCollection: string,
  uid: string,
  attemptId: string,
): { profileRef: DocumentReference; attemptRef: DocumentReference } {
  const db = getFirestore();
  const profileRef = db.collection(profileCollection).doc(uid);
  return { profileRef, attemptRef: profileRef.collection("attempts").doc(attemptId) };
}

function parseProfile(snapshot: DocumentSnapshot, isAnonymous: boolean) {
  const profile = snapshot.data() ?? {};
  const stats =
    typeof profile.stats === "object" && profile.stats !== null
      ? (profile.stats as Record<string, unknown>)
      : {};
  const xpValue = isAnonymous ? stats.xp : profile.xp;
  const xp = typeof xpValue === "number" && Number.isFinite(xpValue) ? xpValue : 0;
  const levelValue = isAnonymous ? stats.level : profile.level;
  const level =
    typeof levelValue === "number" && Number.isInteger(levelValue)
      ? levelValue
      : getLevelForXp(xp);
  const storedCohort = profile.leaderboardCohort;
  const oldCohort =
    typeof storedCohort === "number" && Number.isInteger(storedCohort) ? storedCohort : null;
  return { profile, stats, xp, level, oldCohort };
}

export async function processAttemptXp(event: AttemptEvent): Promise<void> {
  if (event.profileCollection !== "anon_profiles" && event.profileCollection !== "users") {
    return;
  }

  const db = getFirestore();
  const { profileRef, attemptRef } = getProfileReferences(
    event.profileCollection,
    event.uid,
    event.attemptId,
  );
  const isAnonymous = event.profileCollection === "anon_profiles";

  const sync = await db.runTransaction(async (transaction) => {
    const [attemptSnapshot, profileSnapshot] = await Promise.all([
      transaction.get(attemptRef),
      transaction.get(profileRef),
    ]);
    if (!attemptSnapshot.exists || !profileSnapshot.exists) {
      return null;
    }

    const attempt = attemptSnapshot.data() ?? {};
    if (attempt.xpSynced === true) {
      if (attempt.leaderboardXpSynced === true) {
        return null;
      }
      const { profile, level, oldCohort } = parseProfile(profileSnapshot, isAnonymous);
      const cohort =
        typeof profile.leaderboardCohort === "number"
          ? profile.leaderboardCohort
          : getCohortForLevel(level);
      return {
        uid: event.uid,
        oldCohort,
        cohort,
        subject: typeof attempt.subject === "string" ? attempt.subject : null,
        award: typeof attempt.leaderboardXpAward === "number" ? attempt.leaderboardXpAward : 0,
      };
    }

    const correct = attempt.isCorrect === true;
    const completed =
      attempt.sessionCompleted === true &&
      (attempt.mode === "subject" || attempt.mode === "full");
    const storedAward = attempt.xpEarned;
    const answerAward =
      typeof storedAward === "number" && Number.isInteger(storedAward) && storedAward >= 0
        ? storedAward
        : correct
          ? xpPerCorrectAnswer
          : 0;
    const award = answerAward + (completed ? xpPerCompletedMock : 0);
    const { profile, stats, xp, oldCohort } = parseProfile(profileSnapshot, isAnonymous);
    const newXp = xp + award;
    const level = getLevelForXp(newXp);
    const cohort = getCohortForLevel(level);
    const now = FieldValue.serverTimestamp();

    transaction.set(
      profileRef,
      isAnonymous
        ? {
            lastSeenAt: now,
            leaderboardCohort: cohort,
            stats: { ...stats, xp: newXp, level },
          }
        : {
            lastSeenAt: now,
            xp: newXp,
            level,
            leaderboardCohort: cohort,
            stats: { ...stats, xp: newXp, level },
          },
      { merge: true },
    );
    transaction.update(attemptRef, {
      xpSynced: true,
      leaderboardXpSynced: false,
      leaderboardXpAward: award,
      lastSeenAt: now,
    });

    return {
      uid: event.uid,
      oldCohort,
      cohort,
      subject: typeof attempt.subject === "string" ? attempt.subject : null,
      award,
    };
  });

  if (!sync) {
    return;
  }

  await syncLeaderboardAward(`${event.attemptId}:xp`, sync);
  await attemptRef.update({
    leaderboardXpSynced: true,
    lastSeenAt: FieldValue.serverTimestamp(),
  });
}