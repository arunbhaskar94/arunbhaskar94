import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { processActivityStreak } from "../gamification/streakEngine";
import { processAttemptXp } from "../gamification/xpEngine";

export const onAttemptWrite = onDocumentCreated(
  {
    document: "{profileCollection}/{uid}/attempts/{attemptId}",
    region: "asia-south1",
    retry: true,
  },
  async (event) => {
    const { profileCollection, uid, attemptId } = event.params;
    const identity = { profileCollection, uid, attemptId };

    await processAttemptXp(identity);
    await processActivityStreak(identity);
  },
);