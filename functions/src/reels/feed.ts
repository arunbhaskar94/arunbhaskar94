import { FieldPath, FieldValue, getFirestore } from "firebase-admin/firestore";
import { z } from "zod";
import { createSecureHandler } from "../middleware/secureHandler";
import { sanitizeQuestion } from "../middleware/sanitize";
import { RequestError } from "../middleware/roleGate";
import { reelsFeedInputSchema, reelsFeedOutputSchema } from "./schemas";

const pageSize = 20;
const cursorSchema = z.object({
  order: z.number(),
  id: z.string().min(1),
});

function decodeCursor(cursor: string | undefined) {
  if (!cursor) {
    return null;
  }

  try {
    const value: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    const parsed = cursorSchema.safeParse(value);
    if (parsed.success) {
      return parsed.data;
    }
  } catch {
    // Invalid cursors are rejected below rather than restarting pagination.
  }

  throw new RequestError(400, "The reels cursor is invalid.");
}

function encodeCursor(order: number, id: string): string {
  return Buffer.from(JSON.stringify({ order, id }), "utf8").toString("base64url");
}

export const reelsFeed = createSecureHandler({
  name: "reels-feed",
  access: "anon",
  userRateLimit: { limit: 60, window: "1 h" },
  inputSchema: reelsFeedInputSchema,
  outputSchema: reelsFeedOutputSchema,
  handler: async ({ cursor }, identity) => {
    const db = getFirestore();
    const collection = db.collection("reels_pool");
    const items: {
      reelId: string;
      questionId: string;
      order: number;
      question: ReturnType<typeof sanitizeQuestion>;
    }[] = [];
    let queryCursor = decodeCursor(cursor);
    let lastDeliveredCursor: string | null = null;
    let exhausted = false;

    while (items.length < pageSize && !exhausted) {
      let query = collection
        .where("active", "==", true)
        .orderBy("order", "asc")
        .orderBy(FieldPath.documentId(), "asc")
        .limit(pageSize);
      if (queryCursor) {
        query = query.startAfter(queryCursor.order, queryCursor.id);
      }

      const reelSnapshot = await query.get();
      if (reelSnapshot.empty) {
        exhausted = true;
        break;
      }
      exhausted = reelSnapshot.size < pageSize;
      const lastScanned = reelSnapshot.docs[reelSnapshot.docs.length - 1];
      const lastScannedOrder = lastScanned.get("order");
      if (typeof lastScannedOrder !== "number") {
        throw new Error("A reels pool item has an invalid order.");
      }
      queryCursor = { order: lastScannedOrder, id: lastScanned.id };

      const questionIds = reelSnapshot.docs.flatMap((document) => {
        const reference = document.get("questionId");
        if (typeof reference === "string") {
          return [reference];
        }
        if (reference && typeof reference.id === "string") {
          return [reference.id];
        }
        return [];
      });
      if (questionIds.length === 0) {
        continue;
      }

      const questionSnapshots = await db.getAll(
        ...questionIds.map((questionId) => db.collection("questions").doc(questionId)),
      );
      const questionsById = new Map(
        questionSnapshots
          .filter((question) => question.exists && question.get("status") === "active")
          .map((question) => [question.id, question]),
      );

      for (const reel of reelSnapshot.docs) {
        const questionValue = reel.get("questionId");
        const questionId =
          typeof questionValue === "string" ? questionValue : questionValue?.id;
        const questionDocument =
          typeof questionId === "string" ? questionsById.get(questionId) : undefined;
        const order = reel.get("order");
        const questionData = questionDocument?.data();
        if (!questionDocument || !questionData || typeof order !== "number") {
          continue;
        }

        items.push({
          reelId: reel.id,
          questionId,
          order,
          question: sanitizeQuestion(questionDocument.id, questionData),
        });
        lastDeliveredCursor = encodeCursor(order, reel.id);
        if (items.length === pageSize) {
          break;
        }
      }
    }

    if (items.length === 0) {
      return { sessionId: "", reels: [], nextCursor: null };
    }

    const sessionRef = db.collection("quiz_sessions").doc();
    const timestamp = FieldValue.serverTimestamp();
    await sessionRef.set({
      uid: identity.uid,
      mode: "reel",
      subject: null,
      questionIds: items.map((item) => item.questionId),
      answeredQuestionIds: [],
      score: 0,
      status: "in_progress",
      startedAt: timestamp,
      createdAt: timestamp,
      lastSeenAt: timestamp,
    });

    return {
      sessionId: sessionRef.id,
      reels: items,
      nextCursor: exhausted ? null : lastDeliveredCursor,
    };
  },
});
