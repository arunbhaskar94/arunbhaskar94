import { randomInt } from "node:crypto";
import { FieldPath, FieldValue, getFirestore } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";

const documentIdAlphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function randomDocumentId(): string {
  return Array.from({ length: 20 }, () =>
    documentIdAlphabet[randomInt(documentIdAlphabet.length)],
  ).join("");
}

export const dailyChallenge = onSchedule(
  {
    schedule: "0 0 * * *",
    timeZone: "Etc/UTC",
    region: "asia-south1",
  },
  async () => {
    const db = getFirestore();
    const today = new Date().toISOString().slice(0, 10);
    const challengeRef = db.collection("daily_challenges").doc(today);
    const existing = await challengeRef.get();
    if (existing.exists) {
      return;
    }

    const questionCollection = db.collection("questions");
    const cursor = randomDocumentId();
    const first = await questionCollection
      .where("status", "==", "active")
      .orderBy(FieldPath.documentId())
      .startAt(cursor)
      .limit(5)
      .get();
    const candidates = [...first.docs];
    if (candidates.length < 5) {
      const wrapped = await questionCollection
        .where("status", "==", "active")
        .orderBy(FieldPath.documentId())
        .limit(5 - candidates.length)
        .get();
      candidates.push(...wrapped.docs.filter((document) =>
        !candidates.some((candidate) => candidate.id === document.id),
      ));
    }
    if (candidates.length < 5) {
      throw new Error("Cannot publish a daily challenge with fewer than five active questions.");
    }

    await db.runTransaction(async (transaction) => {
      const current = await transaction.get(challengeRef);
      if (current.exists) {
        return;
      }
      const now = FieldValue.serverTimestamp();
      transaction.create(challengeRef, {
        date: today,
        questionIds: candidates.map((document) => document.id),
        publishedAt: now,
        lastSeenAt: now,
      });
    });
  },
);