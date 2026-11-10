import { getAuth } from "firebase-admin/auth";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { createSecureHandler } from "../middleware/secureHandler";
import { sanitizeQuestion } from "../middleware/sanitize";
import { RequestError } from "../middleware/roleGate";
import { createVerifiedProfile } from "../profile/verifiedProfile";
import {
  aiQueueOutputSchema,
  analyticsOutputSchema,
  bulkImportInputSchema,
  dashboardOutputSchema,
  emptyInputSchema,
  manageUserInputSchema,
  mutationOutputSchema,
  questionListOutputSchema,
  reviewAiInputSchema,
  usersOutputSchema,
} from "./schemas";

const noCache = { limit: 100, window: "15 m" } as const;

function publicAdminQuestion(id: string, data: Record<string, unknown>, status: "active" | "draft" | "archived") {
  return { ...sanitizeQuestion(id, data), status };
}

function profileStats(data: Record<string, unknown>) {
  const stats =
    typeof data.stats === "object" && data.stats !== null
      ? (data.stats as Record<string, unknown>)
      : {};
  const xpValue = typeof data.xp === "number" ? data.xp : stats.xp;
  const levelValue = typeof data.level === "number" ? data.level : stats.level;
  const streakValue = typeof data.streak === "number" ? data.streak : stats.streak;
  return {
    xp: typeof xpValue === "number" && Number.isFinite(xpValue) ? Math.max(0, xpValue) : 0,
    level: typeof levelValue === "number" ? Math.min(100, Math.max(1, levelValue)) : 1,
    streak: typeof streakValue === "number" ? Math.max(0, streakValue) : 0,
  };
}

export const adminAuthorize = createSecureHandler({
  name: "admin-authorize",
  access: "admin",
  userRateLimit: noCache,
  inputSchema: emptyInputSchema,
  outputSchema: mutationOutputSchema,
  handler: async (_input, identity) => {
    const db = getFirestore();
    const now = FieldValue.serverTimestamp();
    const profileRef = db.collection("users").doc(identity.uid);
    await db.runTransaction(async (transaction) => {
      const profile = await transaction.get(profileRef);
      transaction.set(
        profileRef,
        profile.exists
          ? { lastSeenAt: now }
          : createVerifiedProfile(identity, now),
        { merge: true },
      );
    });
    await db.collection("admin_config").doc("singleton").set(
      { adminEmail: process.env.ADMIN_EMAIL, lastSeenAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    return { success: true, message: "Administrator access confirmed." };
  },
});

export const adminDashboard = createSecureHandler({
  name: "admin-dashboard",
  access: "admin",
  userRateLimit: noCache,
  inputSchema: emptyInputSchema,
  outputSchema: dashboardOutputSchema,
  handler: async (_input, identity) => {
    const db = getFirestore();
    const today = new Date().toISOString().slice(0, 10);
    const [users, anonymousUsers, questions, pendingAiQuestions, activeUsers, activeAnon] =
      await Promise.all([
        db.collection("users").count().get(),
        db.collection("anon_profiles").count().get(),
        db.collection("questions").count().get(),
        db.collection("ai_questions").where("status", "==", "pending").count().get(),
        db.collection("users").where("lastActiveDate", "==", today).count().get(),
        db.collection("anon_profiles").where("lastActiveDate", "==", today).count().get(),
      ]);
    const profileRef = db.collection("users").doc(identity.uid);
    await profileRef.set({ lastSeenAt: FieldValue.serverTimestamp() }, { merge: true });

    return {
      users: users.data().count,
      anonymousUsers: anonymousUsers.data().count,
      questions: questions.data().count,
      pendingAiQuestions: pendingAiQuestions.data().count,
      todayActive: activeUsers.data().count + activeAnon.data().count,
    };
  },
});

export const adminQuestions = createSecureHandler({
  name: "admin-questions",
  access: "admin",
  userRateLimit: noCache,
  inputSchema: emptyInputSchema,
  outputSchema: questionListOutputSchema,
  handler: async (_input, identity) => {
    const db = getFirestore();
    const snapshot = await db.collection("questions").orderBy("subject").limit(100).get();
    await db.collection("users").doc(identity.uid).set(
      { lastSeenAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    return {
      questions: snapshot.docs.map((document) =>
        publicAdminQuestion(
          document.id,
          document.data(),
          document.get("status") as "active" | "draft" | "archived",
        ),
      ),
    };
  },
});

export const adminImportQuestions = createSecureHandler({
  name: "admin-import-questions",
  access: "admin",
  userRateLimit: { limit: 10, window: "1 h" },
  inputSchema: bulkImportInputSchema,
  outputSchema: mutationOutputSchema,
  handler: async ({ questions }, identity) => {
    const db = getFirestore();
    await db.collection("users").doc(identity.uid).set(
      { lastSeenAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    const batch = db.batch();
    for (const question of questions) {
      const questionRef = db.collection("questions").doc();
      const now = FieldValue.serverTimestamp();
      batch.create(questionRef, {
        ...question,
        questionImage: question.questionImage,
        status: "active",
        stats: { timesAttempted: 0, timesCorrect: 0, avgTimeSeconds: 0 },
        createdBy: identity.uid,
        createdAt: now,
        lastSeenAt: now,
      });
    }
    await batch.commit();
    return { success: true, message: `Imported ${questions.length} questions.` };
  },
});

export const adminAiQueue = createSecureHandler({
  name: "admin-ai-queue",
  access: "admin",
  userRateLimit: noCache,
  inputSchema: emptyInputSchema,
  outputSchema: aiQueueOutputSchema,
  handler: async (_input, identity) => {
    const db = getFirestore();
    const snapshot = await db.collection("ai_questions")
      .where("status", "==", "pending")
      .limit(100)
      .get();
    await db.collection("users").doc(identity.uid).set(
      { lastSeenAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    return {
      questions: snapshot.docs.map((document) => {
        const data = document.data();
        return {
          ...sanitizeQuestion(document.id, data),
          status: "pending" as const,
          generatedBy: "gemini" as const,
          generatedFor: typeof data.generatedFor === "string" ? data.generatedFor : "",
        };
      }),
    };
  },
});

export const adminReviewAiQuestion = createSecureHandler({
  name: "admin-review-ai-question",
  access: "admin",
  userRateLimit: { limit: 120, window: "1 h" },
  inputSchema: reviewAiInputSchema,
  outputSchema: mutationOutputSchema,
  handler: async ({ questionId, decision }, identity) => {
    const db = getFirestore();
    const aiRef = db.collection("ai_questions").doc(questionId);
    const now = FieldValue.serverTimestamp();
    await db.runTransaction(async (transaction) => {
      const [aiQuestion, adminProfile] = await Promise.all([
        transaction.get(aiRef),
        transaction.get(db.collection("users").doc(identity.uid)),
      ]);
      if (!aiQuestion.exists || aiQuestion.get("status") !== "pending") {
        throw new RequestError(404, "Pending AI question was not found.");
      }

      if (decision === "approve") {
        const data = aiQuestion.data() ?? {};
        const questionRef = db.collection("questions").doc();
        transaction.create(questionRef, {
          question: data.question,
          questionImage: data.questionImage ?? null,
          options: data.options,
          correctOptionIndex: data.correctOptionIndex,
          solution: data.solution,
          subject: data.subject,
          chapter: data.chapter,
          topic: data.topic,
          difficulty: data.difficulty,
          questionType: data.questionType,
          language: data.language,
          marks: data.marks,
          source: data.source,
          status: "active",
          stats: { timesAttempted: 0, timesCorrect: 0, avgTimeSeconds: 0 },
          approvedFrom: aiRef.id,
          createdBy: identity.uid,
          createdAt: now,
          lastSeenAt: now,
        });
      }

      transaction.update(aiRef, {
        status: decision === "approve" ? "approved" : "rejected",
        reviewedBy: identity.uid,
        reviewedAt: now,
        lastSeenAt: now,
      });
      transaction.set(
        db.collection("users").doc(identity.uid),
        adminProfile.exists ? { lastSeenAt: now } : createVerifiedProfile(identity, now),
        { merge: true },
      );
    });

    return {
      success: true,
      message: decision === "approve" ? "Question approved." : "Question rejected.",
    };
  },
});

export const adminUsers = createSecureHandler({
  name: "admin-users",
  access: "admin",
  userRateLimit: noCache,
  inputSchema: emptyInputSchema,
  outputSchema: usersOutputSchema,
  handler: async (_input, identity) => {
    const db = getFirestore();
    const [verified, anonymous] = await Promise.all([
      db.collection("users").orderBy("lastSeenAt", "desc").limit(50).get(),
      db.collection("anon_profiles").orderBy("lastSeenAt", "desc").limit(50).get(),
    ]);
    const users = await Promise.all(
      verified.docs.map(async (document) => {
        const data = document.data();
        const authUser = await getAuth().getUser(document.id).catch((error: unknown) => {
          if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === "auth/user-not-found"
          ) {
            return null;
          }
          throw error;
        });
        const stats = profileStats(data);
        return {
          uid: document.id,
          displayName: typeof data.displayName === "string" ? data.displayName : "Learner",
          emailVerified: authUser?.emailVerified ?? false,
          disabled: authUser?.disabled ?? true,
          xp: stats.xp,
          level: stats.level,
          streak: stats.streak,
          role: "verified" as const,
        };
      }),
    );
    const anonymousUsers = anonymous.docs.map((document) => {
      const stats = profileStats(document.data());
      return {
        uid: document.id,
        displayName: "Anonymous learner",
        emailVerified: false,
        disabled: false,
        xp: stats.xp,
        level: stats.level,
        streak: stats.streak,
        role: "anon" as const,
      };
    });
    await db.collection("users").doc(identity.uid).set(
      { lastSeenAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    return { users: [...users, ...anonymousUsers] };
  },
});

export const adminManageUser = createSecureHandler({
  name: "admin-manage-user",
  access: "admin",
  userRateLimit: { limit: 120, window: "1 h" },
  inputSchema: manageUserInputSchema,
  outputSchema: mutationOutputSchema,
  handler: async ({ uid, action, amount }, identity) => {
    if (uid === identity.uid && (action === "ban" || action === "unban")) {
      throw new RequestError(400, "You cannot change your own account status.");
    }

    const auth = getAuth();
    const db = getFirestore();
    const userRecord = await auth.getUser(uid).catch((error: unknown) => {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "auth/user-not-found"
      ) {
        throw new RequestError(404, "User was not found.");
      }
      throw error;
    });
    const verifiedRef = db.collection("users").doc(uid);
    const anonymousRef = db.collection("anon_profiles").doc(uid);

    if (action === "ban" || action === "unban") {
      await auth.updateUser(uid, { disabled: action === "ban" });
      await verifiedRef.set(
        {
          banned: action === "ban",
          lastSeenAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      await auth.revokeRefreshTokens(uid);
    } else if (action === "verify") {
      if (!userRecord.email) {
        throw new RequestError(400, "Only users with an email can be verified.");
      }
      await auth.updateUser(uid, { emailVerified: true });
      await verifiedRef.set(
        {
          email: userRecord.email,
          emailVerified: true,
          role: "verified",
          lastSeenAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    } else if (action === "adjust_xp" && amount !== undefined) {
      const profileRef = (await verifiedRef.get()).exists ? verifiedRef : anonymousRef;
      await db.runTransaction(async (transaction) => {
        const [profile, adminProfile] = await Promise.all([
          transaction.get(profileRef),
          transaction.get(db.collection("users").doc(identity.uid)),
        ]);
        if (!profile.exists) {
          throw new RequestError(404, "User profile was not found.");
        }

        const data = profile.data() ?? {};
        const stats =
          typeof data.stats === "object" && data.stats !== null
            ? (data.stats as Record<string, unknown>)
            : {};
        const currentXp = profileRef.parent.id === "anon_profiles"
          ? (typeof stats.xp === "number" ? stats.xp : 0)
          : (typeof data.xp === "number" ? data.xp : 0);
        const xp = Math.max(0, currentXp + amount);
        const level = Math.min(100, Math.max(1, Math.floor(Math.sqrt(xp / 100))));
        const now = FieldValue.serverTimestamp();
        transaction.set(
          profileRef,
          profileRef.parent.id === "anon_profiles"
            ? { lastSeenAt: now, stats: { ...stats, xp, level } }
            : { lastSeenAt: now, xp, level, stats: { ...stats, xp, level } },
          { merge: true },
        );
        transaction.set(
          db.collection("users").doc(identity.uid),
          adminProfile.exists ? { lastSeenAt: now } : createVerifiedProfile(identity, now),
          { merge: true },
        );
      });
    }

    return {
      success: true,
      message:
        action === "adjust_xp"
          ? `XP adjusted by ${amount}.`
          : action === "verify"
            ? "User verified."
            : `User ${action === "ban" ? "banned" : "unbanned"}.`,
    };
  },
});

export const adminAnalytics = createSecureHandler({
  name: "admin-analytics",
  access: "admin",
  userRateLimit: noCache,
  inputSchema: emptyInputSchema,
  outputSchema: analyticsOutputSchema,
  handler: async (_input, identity) => {
    const db = getFirestore();
    const today = new Date();
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    start.setUTCDate(start.getUTCDate() - 6);
    const end = Timestamp.fromDate(new Date(start.getTime() + 7 * 86_400_000));
    const startTimestamp = Timestamp.fromDate(start);
    const [attempts, recentUsers, recentAnon] = await Promise.all([
      db.collectionGroup("attempts")
        .where("createdAt", ">=", startTimestamp)
        .where("createdAt", "<", end)
        .select("createdAt")
        .limit(10000)
        .get(),
      db.collection("users").where("createdAt", ">=", startTimestamp).where("createdAt", "<", end).select("createdAt").get(),
      db.collection("anon_profiles").where("createdAt", ">=", startTimestamp).where("createdAt", "<", end).select("createdAt").get(),
    ]);

    const dates = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start.getTime() + index * 86_400_000);
      return date.toISOString().slice(0, 10);
    });
    const activeByDate = new Map(dates.map((date) => [date, new Set<string>()]));
    for (const attempt of attempts.docs) {
      const createdAt = attempt.get("createdAt");
      if (!(createdAt instanceof Timestamp)) {
        continue;
      }
      const uid = attempt.ref.parent.parent?.id;
      const date = createdAt.toDate().toISOString().slice(0, 10);
      if (uid && activeByDate.has(date)) {
        activeByDate.get(date)?.add(uid);
      }
    }
    const dau = dates.map((date) => ({
      date,
      users: activeByDate.get(date)?.size ?? 0,
    }));

    const cohortCounts = new Map(dates.map((date) => [date, 0]));
    const cohortMembers = new Map(dates.map((date) => [date, new Set<string>()]));
    for (const document of [...recentUsers.docs, ...recentAnon.docs]) {
      const createdAt = document.get("createdAt");
      if (createdAt instanceof Timestamp) {
        const date = createdAt.toDate().toISOString().slice(0, 10);
        if (cohortCounts.has(date)) {
          cohortCounts.set(date, (cohortCounts.get(date) ?? 0) + 1);
          cohortMembers.get(date)?.add(document.id);
        }
      }
    }
    const retention = dates.slice(0, 6).map((date, index) => {
      const cohortSize = cohortCounts.get(date) ?? 0;
      const members = cohortMembers.get(date) ?? new Set<string>();
      const followingDay = dates[index + 1];
      const returned = followingDay
        ? [...members].filter((uid) => activeByDate.get(followingDay)?.has(uid)).length
        : 0;
      return {
        day: date,
        rate: cohortSize > 0 ? Math.min(100, (returned / cohortSize) * 100) : 0,
      };
    });

    await db.collection("users").doc(identity.uid).set(
      { lastSeenAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    return { dau, retention };
  },
});
