import { z } from "zod";

export const quizModeSchema = z.enum(["subject", "full", "reel"]);
export const quizSessionModeSchema = z.enum(["subject", "full", "reel", "pyq"]);

export const startQuizInputSchema = z
  .object({
    subject: z.string().trim().min(1).max(100).optional(),
    count: z.number().int().min(1).max(30).default(30),
    mode: quizModeSchema,
  })
  .strict()
  .superRefine((input, context) => {
    if (input.mode === "subject" && !input.subject) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["subject"],
        message: "A subject is required for subject mode.",
      });
    }
    if (input.mode !== "subject" && input.subject) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["subject"],
        message: "A subject can only be provided for subject mode.",
      });
    }
  });

export const publicQuestionSchema = z.object({
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
});

export const startQuizOutputSchema = z.object({
  sessionId: z.string().min(1),
  mode: quizSessionModeSchema,
  subject: z.string().nullable(),
  questions: z.array(publicQuestionSchema).min(1).max(30),
});

export const answerQuizInputSchema = z
  .object({
    sessionId: z.string().min(1).max(150),
    questionId: z.string().min(1).max(150),
    selectedOption: z.number().int().min(0).max(9),
  })
  .strict();

export const answerQuizOutputSchema = z.object({
  isCorrect: z.boolean(),
  solution: z.string(),
  xpEarned: z.number().int().nonnegative(),
  completed: z.boolean(),
});

export type StartQuizInput = z.infer<typeof startQuizInputSchema>;
export type AnswerQuizInput = z.infer<typeof answerQuizInputSchema>;
export type PublicQuestion = z.infer<typeof publicQuestionSchema>;
export type StartQuizOutput = z.infer<typeof startQuizOutputSchema>;
export type AnswerQuizOutput = z.infer<typeof answerQuizOutputSchema>;
