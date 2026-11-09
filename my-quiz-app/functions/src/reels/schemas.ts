import { z } from "zod";

export const reelsFeedInputSchema = z
  .object({
    cursor: z.string().min(1).max(150).optional(),
  })
  .strict();

export const reelQuestionSchema = z.object({
  reelId: z.string().min(1),
  questionId: z.string().min(1),
  order: z.number(),
  question: z.object({
    id: z.string().min(1),
    question: z.string().min(1),
    questionImage: z.string().url().nullable(),
    options: z.array(z.string()).min(2).max(10),
    subject: z.string().min(1),
    chapter: z.string().min(1),
    topic: z.string().min(1),
    difficulty: z.enum(["easy", "medium", "hard"]),
    questionType: z.enum(["multiple_choice", "audio", "fill_blank", "image"]),
    language: z.string().min(1),
    marks: z.object({ positive: z.number(), negative: z.number() }),
    source: z.object({
      type: z.string().min(1),
      exam: z.string().optional(),
      year: z.number().int().optional(),
      shift: z.string().optional(),
    }),
  }),
});

export const reelsFeedOutputSchema = z.object({
  sessionId: z.string(),
  reels: z.array(reelQuestionSchema).max(20),
  nextCursor: z.string().nullable(),
});
