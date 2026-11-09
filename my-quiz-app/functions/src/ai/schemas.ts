import { z } from "zod";
import { publicQuestionSchema } from "../quiz/schemas";

export const generatedQuestionSchema = z
  .object({
    question: z.string().trim().min(1).max(2000),
    options: z.array(z.string().trim().min(1).max(500)).min(2).max(10),
    correctOptionIndex: z.number().int().min(0).max(9),
    solution: z.string().trim().min(1).max(5000),
    subject: z.string().trim().min(1).max(100),
    chapter: z.string().trim().min(1).max(100),
    topic: z.string().trim().min(1).max(100),
    difficulty: z.enum(["easy", "medium", "hard"]),
  })
  .strict()
  .superRefine((question, context) => {
    if (question.correctOptionIndex >= question.options.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["correctOptionIndex"],
        message: "Correct answer index must refer to an option.",
      });
    }
  });

export const generateQuestionsInputSchema = z
  .object({
    subject: z.string().trim().min(1).max(100),
    topic: z.string().trim().min(1).max(100),
    difficulty: z.enum(["easy", "medium", "hard"]),
    count: z.number().int().min(1).max(5).default(3),
    language: z.string().trim().min(2).max(20).default("en"),
  })
  .strict();

export const generateQuestionsOutputSchema = z.object({
  questions: z.array(publicQuestionSchema).min(1).max(5),
  status: z.literal("pending"),
});

export const tutorInputSchema = z
  .object({
    questionId: z.string().min(1).max(150),
  })
  .strict();

export const tutorOutputSchema = z.object({
  explanation: z.string().trim().min(1).max(5000),
});
