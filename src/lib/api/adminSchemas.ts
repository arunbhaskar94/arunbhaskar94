import { z } from "zod";
import { questionSchema } from "@/lib/api/schemas";

export const adminQuestionInputSchema = z
  .object({
    question: z.string().trim().min(1).max(2000),
    questionImage: z.string().url().nullable().default(null),
    options: z.array(z.string().trim().min(1).max(500)).min(2).max(10),
    correctOptionIndex: z.number().int().min(0).max(9),
    solution: z.string().trim().min(1).max(5000),
    subject: z.string().trim().min(1).max(100),
    chapter: z.string().trim().min(1).max(100),
    topic: z.string().trim().min(1).max(100),
    difficulty: z.enum(["easy", "medium", "hard"]),
    questionType: z.enum(["multiple_choice", "audio", "fill_blank", "image"]).default("multiple_choice"),
    language: z.string().trim().min(2).max(20).default("en"),
    marks: z.object({ positive: z.number(), negative: z.number() }).default({ positive: 1, negative: 0 }),
    source: z.object({
      type: z.string().trim().min(1).max(50).default("practice"),
      exam: z.string().trim().max(100).optional(),
      year: z.number().int().min(1900).max(2200).optional(),
      shift: z.string().trim().max(100).optional(),
    }).default({ type: "practice" }),
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

export const bulkImportInputSchema = z.object({
  questions: z.array(adminQuestionInputSchema).min(1).max(500),
}).strict();

export const adminMutationOutputSchema = z.object({
  success: z.literal(true),
  message: z.string(),
});

export const adminDashboardOutputSchema = z.object({
  users: z.number().int().nonnegative(),
  anonymousUsers: z.number().int().nonnegative(),
  questions: z.number().int().nonnegative(),
  pendingAiQuestions: z.number().int().nonnegative(),
  todayActive: z.number().int().nonnegative(),
});

export const adminQuestionOutputSchema = questionSchema.extend({
  status: z.enum(["active", "draft", "archived"]),
});

export const adminQuestionListOutputSchema = z.object({
  questions: z.array(adminQuestionOutputSchema),
});

export const adminAiQueueOutputSchema = z.object({
  questions: z.array(questionSchema.extend({
    status: z.literal("pending"),
    generatedBy: z.literal("gemini"),
    generatedFor: z.string(),
  })),
});

export const adminReviewInputSchema = z.object({
  questionId: z.string().min(1).max(150),
  decision: z.enum(["approve", "reject"]),
}).strict();

export const adminUserOutputSchema = z.object({
  uid: z.string(),
  displayName: z.string(),
  emailVerified: z.boolean(),
  disabled: z.boolean(),
  xp: z.number().int().nonnegative(),
  level: z.number().int().min(1).max(100),
  streak: z.number().int().nonnegative(),
  role: z.enum(["anon", "verified"]),
});
export const adminUsersOutputSchema = z.object({
  users: z.array(adminUserOutputSchema),
});

export const adminManageUserInputSchema = z.object({
  uid: z.string().min(1).max(128),
  action: z.enum(["ban", "unban", "verify", "adjust_xp"]),
  amount: z.number().int().min(-1_000_000).max(1_000_000).optional(),
}).strict().superRefine((input, context) => {
  if (input.action === "adjust_xp" && input.amount === undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["amount"],
      message: "XP adjustment amount is required.",
    });
  }
  if (input.action !== "adjust_xp" && input.amount !== undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["amount"],
      message: "Amount is only allowed for XP adjustments.",
    });
  }
});

export const adminAnalyticsOutputSchema = z.object({
  dau: z.array(z.object({ date: z.string(), users: z.number().int().nonnegative() })).length(7),
  retention: z.array(z.object({ day: z.string(), rate: z.number().min(0).max(100) })).length(6),
});
