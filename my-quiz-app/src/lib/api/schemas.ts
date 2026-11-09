import { z } from "zod";

export const userSchema = z.object({
  uid: z.string().min(1),
  email: z.string().email().nullable(),
  emailVerified: z.boolean(),
  displayName: z.string().nullable(),
  role: z.enum(["anon", "verified", "admin"]),
});

export const questionSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1),
  questionImage: z.string().url().nullable().optional(),
  options: z.array(z.string().min(1)).min(2).max(10),
  subject: z.string().min(1),
  chapter: z.string().min(1),
  topic: z.string().min(1),
  difficulty: z.enum(["easy", "medium", "hard"]),
  questionType: z.enum(["multiple_choice", "audio", "fill_blank", "image"]),
  language: z.string().min(1),
  marks: z.object({
    positive: z.number(),
    negative: z.number(),
  }),
  source: z.object({
    type: z.string().min(1),
    exam: z.string().optional(),
    year: z.number().int().optional(),
    shift: z.string().optional(),
  }),
});

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

export const startQuizOutputSchema = z.object({
  sessionId: z.string().min(1),
  mode: quizSessionModeSchema,
  subject: z.string().nullable(),
  questions: z.array(questionSchema).min(1).max(30),
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

export const pyqInputSchema = z.object({}).strict();
export const pyqOutputSchema = z.object({
  sessionId: z.string().min(1),
  setId: z.string().min(1),
  title: z.string().min(1),
  questions: z.array(questionSchema).length(30),
});

export const aiGenerateInputSchema = z
  .object({
    subject: z.string().trim().min(1).max(100),
    topic: z.string().trim().min(1).max(100),
    difficulty: z.enum(["easy", "medium", "hard"]),
    count: z.number().int().min(1).max(5).default(3),
    language: z.string().trim().min(2).max(20).default("en"),
  })
  .strict();
export const aiGenerateOutputSchema = z.object({
  questions: z.array(questionSchema).min(1).max(5),
  status: z.literal("pending"),
});
export const aiTutorInputSchema = z
  .object({
    questionId: z.string().min(1).max(150),
  })
  .strict();
export const aiTutorOutputSchema = z.object({
  explanation: z.string().trim().min(1).max(5000),
});

export const notificationTokenInputSchema = z.object({
  action: z.enum(["register", "unregister"]),
  token: z.string().min(1).max(4096),
}).strict();
export const notificationTokenOutputSchema = z.object({
  success: z.literal(true),
  message: z.string(),
});

export const chatStartInputSchema = z
  .object({
    targetUid: z.string().trim().min(1).max(128),
  })
  .strict();
export const chatMessageInputSchema = z
  .object({
    text: z.string().trim().min(1).max(2000),
  })
  .strict();

export type StartQuizInput = z.input<typeof startQuizInputSchema>;
export type StartQuizOutput = z.infer<typeof startQuizOutputSchema>;
export type AnswerQuizInput = z.infer<typeof answerQuizInputSchema>;
export type AnswerQuizOutput = z.infer<typeof answerQuizOutputSchema>;