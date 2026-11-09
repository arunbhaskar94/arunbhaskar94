import { z } from "zod";

export const rewardClaimInputSchema = z
  .object({
    proof: z.string().min(1).max(4096),
  })
  .strict();

export const rewardClaimOutputSchema = z.object({
  granted: z.literal(true),
  reward: z.literal("mock"),
  mockCredits: z.number().int().nonnegative(),
});

export const rewardedProofClaimsSchema = z
  .object({
    uid: z.string().min(1),
    eventId: z.string().regex(/^[A-Za-z0-9_-]{12,128}$/),
    reward: z.literal("mock"),
    watchedAt: z.number().int().positive(),
  })
  .strict();
