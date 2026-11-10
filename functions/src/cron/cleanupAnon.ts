import { Timestamp, getFirestore } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";

export const cleanupAnon = onSchedule(
  {
    schedule: "0 3 * * *",
    timeZone: "Etc/UTC",
    region: "asia-south1",
  },
  async () => {
    const db = getFirestore();
    const cutoff = Timestamp.fromMillis(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const profiles = db.collection("anon_profiles");

    while (true) {
      const expiredProfiles = await profiles
        .where("lastSeenAt", "<", cutoff)
        .orderBy("lastSeenAt")
        .limit(100)
        .get();
      if (expiredProfiles.empty) {
        return;
      }

      for (const profile of expiredProfiles.docs) {
        await db.recursiveDelete(profile.ref);
      }
    }
  },
);