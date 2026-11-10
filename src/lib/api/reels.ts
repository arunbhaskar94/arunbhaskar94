import { z } from "zod";
import { fetcher } from "@/lib/api/fetcher";
import { questionSchema } from "@/lib/api/schemas";

export const reelsFeedInputSchema = z.object({
  cursor: z.string().min(1).max(150).optional(),
});

export const reelsFeedOutputSchema = z.object({
  sessionId: z.string(),
  reels: z.array(
    z.object({
      reelId: z.string().min(1),
      questionId: z.string().min(1),
      order: z.number(),
      question: questionSchema,
    }),
  ).max(20),
  nextCursor: z.string().nullable(),
});

function getFeedUrl(): string {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error("NEXT_PUBLIC_FIREBASE_PROJECT_ID is not configured.");
  }
  return `https://asia-south1-${projectId}.cloudfunctions.net/reelsFeed`;
}

export async function fetchReels(input: unknown) {
  const validatedInput = reelsFeedInputSchema.parse(input);
  const result: unknown = await fetcher(getFeedUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(validatedInput),
  });
  return reelsFeedOutputSchema.parse(result);
}
