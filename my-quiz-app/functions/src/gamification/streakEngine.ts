import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getCohortForLevel, getLevelForXp, syncLeaderboardAward } from "./xpEngine";

type ActivityEvent = {
  profileCollection: string;
  uid: string;
  attemptId: string;
};

function utcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function differenceInDays(later: string, earlier: string): number {
  return Math.round((Date.parse(`${later}T00:00:00.000Z`) - Date.parse(`${earlier}T00:00:00.000Z`)) / 86_400_000);
}

function nextStreak(previousStreak: number, daysSinceActivity: number, freezeAvailable: boolean) {
  if (daysSinceActivity === 1) {
    return { streak: previousStreak + 1, useFreeze: false };
  }
  if (daysSinceActivity === 2 && freezeAvailable) {
    return { streak: previousStreak, useFreeze: true };
  }
  return { streak: 1, useFreeze: false };
}

export async function processActivityStreak(event: ActivityEvent): Promise<void> {
  if (event.profileCollection !== "anon_profiles" && event.profileCollection !== "users") {
    return;
  }

  const db = getFirestore();
  const profileRef = db.collection(event.profileCollection).doc(event.uid);
  const attemptRef = profileRef.collection("attempts").doc(event.attemptId);
  const isAnonymous = event.profileCollection === "anon_profiles";
  const today = utcDateKey(new Date());
  const currentMonth = today.slice(0, 7);
  const sync = await db.runTransaction(async (transaction) => {
    const [attemptSnapshot, profileSnapshot] = await Promise.all([
      transaction.get(attemptRef),
      transaction.get(profileRef),
    ]);
    if (!attemptSnapshot.exists || !profileSnapshot.exists) {
      return null;
    }

    const attempt = attemptSnapshot.data() ?? {};
    const profile = profileSnapshot.data() ?? {};
    if (attempt.streakSynced === true) {
      if (attempt.leaderboardStreakSynced === true) {
        return null;
      }
      const streakAward =
        typeof attempt.leaderboardStreakAward === "number" ? attempt.leaderboardStreakAward : 0;
      const xp = isAnonymous
        ? profile.stats?.xp
        : profile.xp;
      const level =
        typeof (isAnonymous ? profile.stats?.level : profile.level) === "number"
          ? (isAnonymous ? profile.stats?.level : profile.level)
          : getLevelForXp(typeof xp === "number" ? xp : 0);
      return {
        uid: event.uid,
        oldCohort:
          typeof attempt.streakOldCohort === "number" ? attempt.streakOldCohort : null,
        cohort: getCohortForLevel(typeof level === "number" ? level : 1),
        subject: typeof attempt.subject === "string" ? attempt.subject : null,
        award: streakAward,
      };
    }

    const stats =
      typeof profile.stats === "object" && profile.stats !== null
        ? (profile.stats as Record<string, unknown>)
        : {};
    const lastActiveDate =
      typeof profile.lastActiveDate === "string" ? profile.lastActiveDate : null;
    const previousStreakValue = isAnonymous ? stats.streak : profile.streak;
    const previousStreak =
      typeof previousStreakValue === "number" && Number.isInteger(previousStreakValue)
        ? previousStreakValue
        : 0;
    const now = FieldValue.serverTimestamp();
    let streak = previousStreak;
    let freezeMonth =
      typeof profile.streakFreezeMonth === "string" ? profile.streakFreezeMonth : null;
    let streakAward = 0;

    if (lastActiveDate !== today) {
      const daysSinceActivity = lastActiveDate ? differenceInDays(today, lastActiveDate) : 0;
      const freezeAvailable = freezeMonth !== currentMonth;
      const updated = lastActiveDate
        ? nextStreak(previousStreak, daysSinceActivity, freezeAvailable)
        : { streak: 1, useFreeze: false };
      streak = updated.streak;
      if (updated.useFreeze) {
        freezeMonth = currentMonth;
      }
      streakAward = 100;
    }

    const xpValue = isAnonymous ? stats.xp : profile.xp;
    const xp = typeof xpValue === "number" && Number.isFinite(xpValue) ? xpValue : 0;
    const newXp = xp + streakAward;
    const level = getLevelForXp(newXp);
    const cohort = getCohortForLevel(level);
    const oldCohort =
      typeof profile.leaderboardCohort === "number" ? profile.leaderboardCohort : null;
    const profileUpdate = isAnonymous
      ? {
          lastSeenAt: now,
          lastActiveDate: today,
          streakFreezeMonth: freezeMonth,
          leaderboardCohort: cohort,
          stats: { ...stats, streak, xp: newXp, level },
        }
      : {
          lastSeenAt: now,
          lastActiveDate: today,
          streak,
          streakFreezeMonth: freezeMonth,
          xp: newXp,
          level,
          leaderboardCohort: cohort,
          stats: { ...stats, streak, xp: newXp, level },
        };

    transaction.set(profileRef, profileUpdate, { merge: true });
    transaction.update(attemptRef, {
      streakSynced: true,
      leaderboardStreakSynced: false,
      leaderboardStreakAward: streakAward,
      streakOldCohort: oldCohort,
      lastSeenAt: now,
    });

    return {
      uid: event.uid,
      oldCohort,
      cohort,
      subject: typeof attempt.subject === "string" ? attempt.subject : null,
      award: streakAward,
    };
  });

  if (!sync) {
    return;
  }

  await syncLeaderboardAward(`${event.attemptId}:streak`, sync);
  await attemptRef.update({
    leaderboardStreakSynced: true,
    lastSeenAt: FieldValue.serverTimestamp(),
  });
}