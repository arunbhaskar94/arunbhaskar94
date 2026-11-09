import { FieldPath, FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { onSchedule } from "firebase-functions/v2/scheduler";

type ReviewCard = {
  nextReviewAt?: unknown;
};

function isDue(nextReviewAt: unknown, now: number): boolean {
  if (nextReviewAt instanceof Timestamp) {
    return nextReviewAt.toMillis() <= now;
  }
  if (nextReviewAt instanceof Date) {
    return nextReviewAt.getTime() <= now;
  }
  return typeof nextReviewAt === "string"
    && Number.isFinite(Date.parse(nextReviewAt))
    && Date.parse(nextReviewAt) <= now;
}

function getTokens(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return [...new Set(value.filter((token): token is string =>
    typeof token === "string" && token.length > 0,
  ))].slice(0, 500);
}

export const srsDuePush = onSchedule(
  {
    schedule: "0 8 * * *",
    timeZone: "Etc/UTC",
    region: "asia-south1",
  },
  async () => {
    const db = getFirestore();
    const now = Date.now();
    const today = new Date(now).toISOString().slice(0, 10);
    const reviewQueue = db.collection("review_queue");
    let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;

    while (true) {
      let query = reviewQueue.orderBy(FieldPath.documentId()).limit(250);
      if (cursor) {
        query = query.startAfter(cursor);
      }
      const page = await query.get();
      if (page.empty) {
        return;
      }

      const userSnapshots = await db.getAll(
        ...page.docs.map((queue) => db.collection("users").doc(queue.id)),
      );
      for (let index = 0; index < page.docs.length; index += 1) {
        const queue = page.docs[index];
        const user = userSnapshots[index];
        if (!user.exists || user.get("settings.notifications") === false) {
          continue;
        }

        const notificationRef = db.collection("notifications").doc(queue.id);
        const notification = await notificationRef.get();
        if (notification.get("srsReminderDate") === today) {
          continue;
        }

        const cards: unknown = queue.get("cards");
        const dueCards = Array.isArray(cards)
          ? cards.filter((card): card is ReviewCard =>
              typeof card === "object"
              && card !== null
              && "nextReviewAt" in card
              && isDue(card.nextReviewAt, now),
            )
          : [];
        if (dueCards.length === 0) {
          continue;
        }

        const tokens = getTokens(user.get("fcmTokens"));
        if (tokens.length === 0) {
          continue;
        }

        const result = await getMessaging().sendEachForMulticast({
          tokens,
          notification: {
            title: "Your review is ready",
            body: `You have ${dueCards.length} question${dueCards.length === 1 ? "" : "s"} ready to review.`,
          },
          data: { type: "srs_due", url: "/home" },
        });
        const invalidTokens = result.responses.flatMap((response, tokenIndex) =>
          response.error?.code === "messaging/invalid-registration-token"
          || response.error?.code === "messaging/registration-token-not-registered"
            ? [tokens[tokenIndex]]
            : [],
        );
        const timestamp = Timestamp.fromMillis(now);
        await notificationRef.set(
          {
            items: FieldValue.arrayUnion({
              title: "Your review is ready",
              body: `${dueCards.length} question${dueCards.length === 1 ? "" : "s"} ready to review.`,
              read: false,
              at: timestamp,
            }),
            srsReminderDate: today,
            lastSeenAt: timestamp,
          },
          { merge: true },
        );
        await user.ref.set(
          {
            ...(invalidTokens.length > 0
              ? { fcmTokens: FieldValue.arrayRemove(...invalidTokens) }
              : {}),
            lastSeenAt: timestamp,
          },
          { merge: true },
        );
      }
      cursor = page.docs[page.docs.length - 1];
    }
  },
);
