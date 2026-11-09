import { z } from "zod";
import { publicQuestionSchema } from "../quiz/schemas";

export const servePyqInputSchema = z.object({}).strict();

export const servePyqOutputSchema = z.object({
  sessionId: z.string().min(1),
  setId: z.string().min(1),
  title: z.string().min(1),
  questions: z.array(publicQuestionSchema).length(30),
});
