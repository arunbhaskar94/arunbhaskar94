import {
  answerQuizInputSchema,
  answerQuizOutputSchema,
  startQuizInputSchema,
  startQuizOutputSchema,
} from "@/lib/api/schemas";
import { fetcher } from "@/lib/api/fetcher";

const functionsRegion = "asia-south1";

function getFunctionUrl(functionName: string): string {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error("NEXT_PUBLIC_FIREBASE_PROJECT_ID is not configured.");
  }

  return `https://${functionsRegion}-${projectId}.cloudfunctions.net/${functionName}`;
}

export async function startQuiz(input: unknown) {
  const validatedInput = startQuizInputSchema.parse(input);
  const result: unknown = await fetcher(getFunctionUrl("startQuiz"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(validatedInput),
  });

  return startQuizOutputSchema.parse(result);
}

export async function answerQuiz(input: unknown) {
  const validatedInput = answerQuizInputSchema.parse(input);
  const result: unknown = await fetcher(getFunctionUrl("answerQuiz"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(validatedInput),
  });

  return answerQuizOutputSchema.parse(result);
}
