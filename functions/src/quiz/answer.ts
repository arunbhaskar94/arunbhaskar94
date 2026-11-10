import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { createSecureHandler } from "../middleware/secureHandler";
import { isAnonymousIdentity, RequestError } from "../middleware/roleGate";
import {
  answerQuizInputSchema,
  answerQuizOutputSchema,
} from "./schemas";

export const answerQuiz = createSecureHandler({
  name: "quiz-answer",
  access: "anon",
  userRateLimit: { limit: 300, window: "1 h" },
  inputSchema: answerQuizInputSchema,
  outputSchema: answerQuizOutputSchema,
  handler: async (input, identity) => {
    const db = getFirestore();
    const profileCollection = isAnonymousIdentity(identity) ? "anon_profiles" : "users";
    const sessionRef = db.collection("quiz_sessions").doc(input.sessionId);
    const questionRef = db.collection("questions").doc(input.questionId);
    const attemptRef = db
      .collection(profileCollection)
      .doc(identity.uid)
      .collection("attempts")
      .doc(`${input.sessionId}_${input.questionId}`);
    const profileRef = db.collection(profileCollection).doc(identity.uid);

    return db.runTransaction(async (transaction) => {
      const [sessionSnapshot, questionSnapshot, profileSnapshot] = await Promise.all([
        transaction.get(sessionRef),
        transaction.get(questionRef),
        transaction.get(profileRef),
      ]);

      if (!sessionSnapshot.exists) {
        throw new RequestError(404, "Quiz session was not found.");
      }
      const session = sessionSnapshot.data();
      if (session?.uid !== identity.uid) {
        throw new RequestError(403, "This quiz session belongs to another user.");
      }
      if (session.status !== "in_progress") {
        throw new RequestError(409, "This quiz session is already complete.");
      }
      if (!Array.isArray(session.questionIds) || !session.questionIds.includes(input.questionId)) {
        throw new RequestError(400, "The question does not belong to this quiz session.");
      }
      const previousAnswers: unknown[] = Array.isArray(session.answeredQuestionIds)
        ? session.answeredQuestionIds
        : [];
      if (previousAnswers.includes(input.questionId)) {
        throw new RequestError(409, "This question has already been answered.");
      }
      if (!questionSnapshot.exists || questionSnapshot.get("status") !== "active") {
        throw new RequestError(404, "The question is no longer available.");
      }

      const question = questionSnapshot.data();
      const correctOptionIndex = question?.correctOptionIndex;
      if (
        typeof correctOptionIndex !== "number" ||
        !Number.isInteger(correctOptionIndex) ||
        !Array.isArray(question?.options) ||
        correctOptionIndex < 0 ||
        correctOptionIndex >= question.options.length ||
        input.selectedOption >= question.options.length
      ) {
        throw new RequestError(500, "The question has invalid answer data.");
      }

      const isCorrect = input.selectedOption === correctOptionIndex;
      const xpEarned = isCorrect ? 10 : 0;
      const answeredQuestionIds = [...previousAnswers, input.questionId];
      const completed = answeredQuestionIds.length === session.questionIds.length;
      const now = FieldValue.serverTimestamp();

      transaction.set(attemptRef, {
        sessionId: input.sessionId,
        questionId: input.questionId,
        mode: session.mode,
        subject: question.subject,
        selectedOption: input.selectedOption,
        isCorrect,
        xpEarned,
        sessionCompleted: completed,
        createdAt: now,
        lastSeenAt: now,
      });
      transaction.update(sessionRef, {
        answeredQuestionIds,
        score: FieldValue.increment(isCorrect ? 1 : 0),
        status: completed ? "completed" : "in_progress",
        ...(completed ? { completedAt: now } : {}),
        lastSeenAt: now,
      });

      const stats = {
        totalAttempts: FieldValue.increment(1),
        correct: FieldValue.increment(isCorrect ? 1 : 0),
      };

      transaction.set(
        profileRef,
        profileSnapshot.exists
          ? { lastSeenAt: now, stats }
          : { createdAt: now, lastSeenAt: now, stats },
        { merge: true },
      );

      return {
        isCorrect,
        solution: typeof question?.solution === "string" ? question.solution : "",
        xpEarned,
        completed,
      };
    });
  },
});