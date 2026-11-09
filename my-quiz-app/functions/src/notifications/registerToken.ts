import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { z } from "zod";
import { createSecureHandler } from "../middleware/secureHandler";
import { mutationOutputSchema } from "../admin/schemas";
import { createVerifiedProfile } from "../profile/verifiedProfile";

const registerTokenInputSchema = z.object({
  action: z.enum(["register", "unregister"]),
  token: z.string().trim().min(1).max(4096),
}).strict();

export const registerNotificationToken = createSecureHandler({
  name: "notification-token",
  access: "verified",
  userRateLimit: { limit: 30, window: "1 h" },
  inputSchema: registerTokenInputSchema,
  outputSchema: mutationOutputSchema,
  handler: async ({ action, token }, identity) => {
    const db = getFirestore();
    const profileRef = db.collection("users").doc(identity.uid);
    await db.runTransaction(async (transaction) => {
      const profile = await transaction.get(profileRef);
      const now = FieldValue.serverTimestamp();
      const update = {
        fcmTokens: action === "register"
          ? FieldValue.arrayUnion(token)
          : FieldValue.arrayRemove(token),
        lastSeenAt: now,
      };
      transaction.set(
        profileRef,
        profile.exists ? update : { ...createVerifiedProfile(identity, now), ...update },
        { merge: true },
      );
    });

    return {
      success: true,
      message: action === "register" ? "Push notifications enabled." : "Push notifications disabled.",
    };
  },
});
