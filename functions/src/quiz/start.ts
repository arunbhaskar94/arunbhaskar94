import { randomInt } from "node:crypto";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { createSecureHandler } from "../middleware/secureHandler";
import { sanitizeQuestion } from "../middleware/sanitize";
import { RequestError } from "../middleware/roleGate";
import {
  startQuizInputSchema,
  startQuizOutputSchema,
  type PublicQuestion,
} from "./schemas";

function shuffle<T>(items: T[]): T[] {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
}

export const startQuiz = createSecureHandler({
  name: "quiz-start",
  access: "anon",
  userRateLimit: { limit: 30, window: "1 h" },
  inputSchema: startQuizInputSchema,
  outputSchema: startQuizOutputSchema,
  handler: async (input, identity) => {
    const db = getFirestore();
    let query = db.collection("questions").where("status", "==", "active");

    if (input.mode === "subject" && input.subject) {
      query = query.where("subject", "==", input.subject);
    }

    const snapshot = await query.limit(500).get();
    const candidates = shuffle(snapshot.docs);
    const selected = candidates.slice(0, input.count);

    if (selected.length !== input.count) {
      throw new RequestError(404, "Not enough active questions are available.");
    }

    const questions: PublicQuestion[] = selected.map((document) =>
      sanitizeQuestion(document.id, document.data()),
    );
    const sessionRef = db.collection("quiz_sessions").doc();
    const timestamp = FieldValue.serverTimestamp();

    await sessionRef.set({
      uid: identity.uid,
      mode: input.mode,
      subject: input.subject ?? null,
      questionIds: selected.map((document) => document.id),
      answeredQuestionIds: [],
      score: 0,
      status: "in_progress",
      startedAt: timestamp,
      createdAt: timestamp,
      lastSeenAt: timestamp,
    });

    return {
      sessionId: sessionRef.id,
      mode: input.mode,
      subject: input.subject ?? null,
      questions,
    };
  },
});