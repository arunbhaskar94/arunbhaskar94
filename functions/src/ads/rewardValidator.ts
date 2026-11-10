import { createHmac, timingSafeEqual } from "node:crypto";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { createSecureHandler } from "../middleware/secureHandler";
import { RequestError, isAnonymousIdentity } from "../middleware/roleGate";
import {
  rewardClaimInputSchema,
  rewardClaimOutputSchema,
  rewardedProofClaimsSchema,
} from "./schemas";

const maxProofAgeMs = 5 * 60 * 1000;
const allowedClockSkewMs = 30 * 1000;

function verifyProof(proof: string, uid: string) {
  const [encodedClaims, encodedSignature, ...extraParts] = proof.split(".");
  if (!encodedClaims || !encodedSignature || extraParts.length > 0) {
    throw new RequestError(400, "The rewarded-ad proof is invalid.");
  }

  const secret = process.env.REWARDED_AD_PROOF_SECRET;
  if (!secret || secret.length < 32) {
    throw new RequestError(503, "Rewarded ads are not configured.");
  }

  let claimsValue: unknown;
  let suppliedSignature: Buffer;
  try {
    claimsValue = JSON.parse(Buffer.from(encodedClaims, "base64url").toString("utf8")) as unknown;
    suppliedSignature = Buffer.from(encodedSignature, "base64url");
  } catch {
    throw new RequestError(400, "The rewarded-ad proof is invalid.");
  }

  const expectedSignature = createHmac("sha256", secret)
    .update(encodedClaims)
    .digest();
  if (
    suppliedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(suppliedSignature, expectedSignature)
  ) {
    throw new RequestError(403, "The rewarded-ad proof could not be verified.");
  }

  const parsedClaims = rewardedProofClaimsSchema.safeParse(claimsValue);
  if (!parsedClaims.success || parsedClaims.data.uid !== uid) {
    throw new RequestError(403, "The rewarded-ad proof is not valid for this account.");
  }

  const age = Date.now() - parsedClaims.data.watchedAt;
  if (age < -allowedClockSkewMs || age > maxProofAgeMs) {
    throw new RequestError(403, "The rewarded-ad proof has expired.");
  }

  return parsedClaims.data;
}

export const rewardValidator = createSecureHandler({
  name: "ads-reward",
  access: "anon",
  userRateLimit: { limit: 10, window: "1 h" },
  inputSchema: rewardClaimInputSchema,
  outputSchema: rewardClaimOutputSchema,
  handler: async ({ proof }, identity) => {
    const claims = verifyProof(proof, identity.uid);
    const db = getFirestore();
    const eventRef = db.collection("ads_tracking").doc(claims.eventId);
    const entitlementRef = db.collection("quiz_entitlements").doc(identity.uid);
    const profileCollection = isAnonymousIdentity(identity) ? "anon_profiles" : "users";
    const profileRef = db.collection(profileCollection).doc(identity.uid);
    const watchedAt = new Date(claims.watchedAt);

    return db.runTransaction(async (transaction) => {
      const [eventSnapshot, entitlementSnapshot, profileSnapshot] = await Promise.all([
        transaction.get(eventRef),
        transaction.get(entitlementRef),
        transaction.get(profileRef),
      ]);
      if (eventSnapshot.exists) {
        throw new RequestError(409, "This rewarded-ad proof has already been used.");
      }

      const currentCredits = entitlementSnapshot.exists
        ? entitlementSnapshot.get("mockCredits")
        : 0;
      if (
        typeof currentCredits !== "number" ||
        !Number.isInteger(currentCredits) ||
        currentCredits < 0
      ) {
        throw new RequestError(500, "The mock reward balance is invalid.");
      }
      const mockCredits = currentCredits + 1;
      const now = FieldValue.serverTimestamp();

      transaction.create(eventRef, {
        uid: identity.uid,
        adType: "rewarded",
        watchedAt,
        reward: "mock",
        rewardGranted: true,
        verified: true,
        lastSeenAt: now,
      });
      transaction.set(
        entitlementRef,
        {
          mockCredits,
          lastSeenAt: now,
        },
        { merge: true },
      );
      transaction.set(
        profileRef,
        profileSnapshot.exists
          ? { lastSeenAt: now }
          : { createdAt: now, lastSeenAt: now },
        { merge: true },
      );

      return { granted: true, reward: "mock", mockCredits };
    });
  },
});