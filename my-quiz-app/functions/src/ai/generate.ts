import { GoogleGenerativeAI } from "@google/generative-ai";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { createSecureHandler } from "../middleware/secureHandler";
import { RequestError } from "../middleware/roleGate";
import { createVerifiedProfile } from "../profile/verifiedProfile";
import {
  generateQuestionsInputSchema,
  generateQuestionsOutputSchema,
  generatedQuestionSchema,
} from "./schemas";

const generatedResponseSchema = generatedQuestionSchema.array().min(1).max(5);

export const generateAiQuestions = createSecureHandler({
  name: "ai-generate",
  access: "verified",
  userRateLimit: { limit: 10, window: "1 h" },
  inputSchema: generateQuestionsInputSchema,
  outputSchema: generateQuestionsOutputSchema,
  handler: async (
    { subject, topic, difficulty, count = 3, language = "en" },
    identity,
  ) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new RequestError(503, "AI question generation is not configured.");
    }

    const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" },
    });
    const response = await model.generateContent(
      [
        "Create original exam-preparation multiple-choice questions.",
        `Generate exactly ${count} questions for subject "${subject}", topic "${topic}", difficulty "${difficulty}", language "${language}".`,
        "Return a JSON array only. Every object must have question, options (2-5 strings), correctOptionIndex (zero-based), solution, subject, chapter, topic, and difficulty.",
        "Questions must be unambiguous and have exactly one correct option.",
      ].join("\n"),
    );

    let responseValue: unknown;
    try {
      responseValue = JSON.parse(response.response.text()) as unknown;
    } catch {
      throw new RequestError(502, "The AI returned invalid question data.");
    }
    const parsedQuestions = generatedResponseSchema.safeParse(responseValue);
    if (!parsedQuestions.success || parsedQuestions.data.length !== count) {
      throw new RequestError(502, "The AI did not return the requested question count.");
    }

    const db = getFirestore();
    const profileRef = db.collection("users").doc(identity.uid);
    const records = parsedQuestions.data.map((question) => ({
      question,
      ref: db.collection("ai_questions").doc(),
    }));
    const publicQuestions = records.map(({ question, ref }) => ({
      id: ref.id,
      question: question.question,
      questionImage: null,
      options: question.options,
      subject: question.subject,
      chapter: question.chapter,
      topic: question.topic,
      difficulty: question.difficulty,
      questionType: "multiple_choice" as const,
      language,
      marks: { positive: 1, negative: 0 },
      source: { type: "ai" },
    }));

    await db.runTransaction(async (transaction) => {
      const profileSnapshot = await transaction.get(profileRef);
      const now = FieldValue.serverTimestamp();
      transaction.set(
        profileRef,
        profileSnapshot.exists
          ? { lastSeenAt: now }
          : createVerifiedProfile(identity, now),
        { merge: true },
      );
      for (const { question, ref } of records) {
        transaction.create(ref, {
          ...question,
          questionImage: null,
          questionType: "multiple_choice",
          language,
          marks: { positive: 1, negative: 0 },
          source: { type: "ai" },
          status: "pending",
          generatedBy: "gemini",
          generatedFor: identity.uid,
          reviewedBy: null,
          reviewedAt: null,
          createdAt: now,
          lastSeenAt: now,
        });
      }
    });

    return { questions: publicQuestions, status: "pending" as const };
  },
});