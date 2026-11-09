import type { DecodedIdToken } from "firebase-admin/auth";
import type { FieldValue } from "firebase-admin/firestore";

export function createVerifiedProfile(
  identity: DecodedIdToken,
  timestamp: FieldValue,
) {
  const provider = identity.firebase.sign_in_provider;

  return {
    createdAt: timestamp,
    lastSeenAt: timestamp,
    email: identity.email ?? null,
    emailVerified: true,
    displayName: identity.name ?? null,
    role: "verified" as const,
    xp: 0,
    level: 1,
    streak: 0,
    coins: 0,
    badges: [],
    linkedProviders: provider ? [provider] : [],
    settings: {
      theme: "system",
      language: "en",
      notifications: true,
    },
    stats: {
      totalAttempts: 0,
      correct: 0,
      xp: 0,
      level: 1,
      streak: 0,
      coins: 0,
    },
  };
}
