import {
  aiGenerateInputSchema,
  aiGenerateOutputSchema,
  aiTutorInputSchema,
  aiTutorOutputSchema,
  pyqInputSchema,
  pyqOutputSchema,
} from "@/lib/api/schemas";
import { fetcher } from "@/lib/api/fetcher";

function getFunctionUrl(functionName: string): string {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error("NEXT_PUBLIC_FIREBASE_PROJECT_ID is not configured.");
  }
  return `https://asia-south1-${projectId}.cloudfunctions.net/${functionName}`;
}

async function postValidated<T>(
  functionName: string,
  input: unknown,
  inputSchema: { parse: (data: unknown) => unknown },
  outputSchema: { parse: (data: unknown) => T },
): Promise<T> {
  const validatedInput = inputSchema.parse(input);
  const response: unknown = await fetcher(getFunctionUrl(functionName), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(validatedInput),
  });
  return outputSchema.parse(response);
}

export function servePyq() {
  return postValidated("servePyq", {}, pyqInputSchema, pyqOutputSchema);
}

export function generateAiQuestions(input: unknown) {
  return postValidated(
    "generateAiQuestions",
    input,
    aiGenerateInputSchema,
    aiGenerateOutputSchema,
  );
}

export function askAiTutor(input: unknown) {
  return postValidated("aiTutor", input, aiTutorInputSchema, aiTutorOutputSchema);
}
