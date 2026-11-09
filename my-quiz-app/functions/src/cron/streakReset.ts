import { FieldPath, FieldValue, getFirestore } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";

export const streakReset = onSchedule(
  {
    schedule: "0 0 * * *",
    timeZone: "Etc/UTC",
    region: "asia-south1",
  },
  async () => {
    const db = getFirestore();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    for (const collectionName of ["users", "anon_profiles"] as const) {
      const collection = db.collection(collectionName);
      let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;

      while (true) {
        let query = collection
          .where("lastActiveDate", "<", yesterday)
          .orderBy("lastActiveDate")
          .orderBy(FieldPath.documentId())
          .limit(400);
        if (cursor) {
          query = query.startAfter(cursor);
        }
        const page = await query.get();
        if (page.empty) {
          break;
        }

        const batch = db.batch();
        let updates = 0;
        for (const profile of page.docs) {
          const streak = collectionName === "anon_profiles"
            ? profile.get("stats.streak")
            : profile.get("streak");
          if (typeof streak === "number" && streak > 0) {
            batch.update(
              profile.ref,
              collectionName === "anon_profiles"
                ? {
                    "stats.streak": 0,
                    lastSeenAt: profile.get("lastSeenAt") ?? FieldValue.serverTimestamp(),
                  }
                : {
                    streak: 0,
                    "stats.streak": 0,
                    lastSeenAt: profile.get("lastSeenAt") ?? FieldValue.serverTimestamp(),
                  },
            );
            updates += 1;
          }
        }
        if (updates > 0) {
          await batch.commit();
        }
        cursor = page.docs[page.docs.length - 1];
      }
    }
  },
);