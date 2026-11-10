import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { randomInt } from "node:crypto";
import { createSecureHandler } from "../middleware/secureHandler";
import { sanitizeQuestion } from "../middleware/sanitize";
import { RequestError } from "../middleware/roleGate";
import { createVerifiedProfile } from "../profile/verifiedProfile";
import { servePyqInputSchema, servePyqOutputSchema } from "./schemas";

function shuffle<T>(values: T[]): T[] {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }
  return values;
}

export const servePyq = createSecureHandler({
  name: "pyq-serve",
  access: "verified",
  userRateLimit: { limit: 3, window: "1 h" },
  inputSchema: servePyqInputSchema,
  outputSchema: servePyqOutputSchema,
  handler: async (_input, identity) => {
    const db = getFirestore();
    const pyqSets = await db.collection("pyqs").orderBy("createdAt", "desc").limit(50).get();
    const selectedSet = shuffle(
      pyqSets.docs.filter((document) => {
        const servedTo: unknown = document.get("servedTo");
        return !Array.isArray(servedTo) || !servedTo.includes(identity.uid);
      }),
    ).find((document) => {
      const questions: unknown = document.get("questions");
      return Array.isArray(questions) && questions.length >= 30;
    });

    if (!selectedSet) {
      throw new RequestError(404, "No unused 30-question PYQ set is available.");
    }

    const setQuestions = selectedSet.get("questions") as unknown[];
    const selectedQuestions = setQuestions.slice(0, 30).map((value) => {
      if (typeof value !== "object" || value === null || !("questionId" in value)) {
        throw new RequestError(500, "The selected PYQ set contains invalid question data.");
      }
      const questionId = value.questionId;
      if (typeof questionId !== "string" || !questionId) {
        throw new RequestError(500, "The selected PYQ set contains an invalid question ID.");
      }
      const imageUrl = "imageUrl" in value ? value.imageUrl : null;
      if (imageUrl !== null && typeof imageUrl !== "string") {
        throw new RequestError(500, "The selected PYQ set contains an invalid image URL.");
      }
      return { questionId, imageUrl: typeof imageUrl === "string" ? imageUrl : null };
    });

    const questionSnapshots = await db.getAll(
      ...selectedQuestions.map(({ questionId }) => db.collection("questions").doc(questionId)),
    );
    if (
      questionSnapshots.some(
        (snapshot) => !snapshot.exists || snapshot.get("status") !== "active",
      )
    ) {
      throw new RequestError(404, "Some questions in this PYQ set are no longer available.");
    }

    const questions = questionSnapshots.map((snapshot, index) => {
      const question = sanitizeQuestion(snapshot.id, snapshot.data() ?? {});
      const imageUrl = selectedQuestions[index].imageUrl;
      return imageUrl ? { ...question, questionImage: imageUrl } : question;
    });

    const profileRef = db.collection("users").doc(identity.uid);
    const sessionRef = db.collection("quiz_sessions").doc();
    await db.runTransaction(async (transaction) => {
      const [setSnapshot, profileSnapshot] = await Promise.all([
        transaction.get(selectedSet.ref),
        transaction.get(profileRef),
      ]);
      if (!setSnapshot.exists) {
        throw new RequestError(404, "The selected PYQ set is no longer available.");
      }
      const servedTo: unknown = setSnapshot.get("servedTo");
      if (Array.isArray(servedTo) && servedTo.includes(identity.uid)) {
        throw new RequestError(409, "A PYQ set has already been served to this account.");
      }
      if (profileSnapshot.get("pyqServedAt")) {
        throw new RequestError(409, "PYQ mode is available once per verified account.");
      }

      const now = FieldValue.serverTimestamp();
      transaction.update(selectedSet.ref, {
        servedTo: FieldValue.arrayUnion(identity.uid),
        lastSeenAt: now,
      });
      transaction.create(sessionRef, {
        uid: identity.uid,
        mode: "pyq",
        subject: null,
        questionIds: questionSnapshots.map((snapshot) => snapshot.id),
        answeredQuestionIds: [],
        score: 0,
        status: "in_progress",
        pyqSetId: selectedSet.id,
        startedAt: now,
        createdAt: now,
        lastSeenAt: now,
      });
      transaction.set(
        profileRef,
        profileSnapshot.exists
          ? { pyqServedAt: now, lastSeenAt: now }
          : { ...createVerifiedProfile(identity, now), pyqServedAt: now },
        { merge: true },
      );
    });

    return {
      sessionId: sessionRef.id,
      setId: selectedSet.id,
      title: typeof selectedSet.get("title") === "string" ? selectedSet.get("title") : "PYQ Set",
      questions,
    };
  },
});
