import { z } from "zod";
import { fetcher } from "@/lib/api/fetcher";

export const leaderboardKindSchema = z.enum(["daily", "weekly", "subject"]);

export const leaderboardInputSchema = z
  .object({
    kind: leaderboardKindSchema,
    subject: z.string().trim().min(1).max(100).optional(),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.kind === "subject" && !input.subject) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["subject"],
        message: "Choose a subject for the subject leaderboard.",
      });
    }
    if (input.kind !== "subject" && input.subject) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["subject"],
        message: "A subject is only valid for a subject leaderboard.",
      });
    }
  });

export const leaderboardOutputSchema = z.object({
  cohortStartLevel: z.number().int().min(1).max(91),
  ownRank: z.number().int().positive().nullable(),
  entries: z.array(
    z.object({
      rank: z.number().int().positive(),
      displayName: z.string(),
      level: z.number().int().min(1).max(100),
      score: z.number().nonnegative(),
      isCurrentUser: z.boolean(),
    }),
  ).max(50),
});

function getLeaderboardUrl(): string {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error("NEXT_PUBLIC_FIREBASE_PROJECT_ID is not configured.");
  }
  return `https://asia-south1-${projectId}.cloudfunctions.net/getLeaderboard`;
}

export async function fetchLeaderboard(input: unknown) {
  const validatedInput = leaderboardInputSchema.parse(input);
  const result: unknown = await fetcher(getLeaderboardUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(validatedInput),
  });
  return leaderboardOutputSchema.parse(result);
}
