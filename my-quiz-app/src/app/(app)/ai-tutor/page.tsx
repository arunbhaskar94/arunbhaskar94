"use client";

import { useState, type FormEvent } from "react";
import { RequireVerified } from "@/components/guards/RequireVerified";
import { askAiTutor, generateAiQuestions } from "@/lib/api/verified";
import type { Question } from "@/types/question";

type GeneratedQuestion = Pick<
  Question,
  "id" | "question" | "options" | "subject" | "topic" | "difficulty"
>;

function AiTutorContent() {
  const [questionId, setQuestionId] = useState("");
  const [explanation, setExplanation] = useState<string | null>(null);
  const [tutorError, setTutorError] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [count, setCount] = useState(3);
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([]);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  async function askForExplanation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsAsking(true);
    setExplanation(null);
    setTutorError(null);
    try {
      const response = await askAiTutor({ questionId });
      setExplanation(response.explanation);
    } catch (error: unknown) {
      setTutorError(error instanceof Error ? error.message : "Could not load an explanation.");
    } finally {
      setIsAsking(false);
    }
  }

  async function generateQuestions(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsGenerating(true);
    setGenerationError(null);
    setGeneratedQuestions([]);
    try {
      const result = await generateAiQuestions({ subject, topic, difficulty, count });
      setGeneratedQuestions(result.questions);
    } catch (error: unknown) {
      setGenerationError(
        error instanceof Error ? error.message : "Could not generate practice questions.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-8 p-4">
      <h1 className="text-2xl font-bold">AI study tools</h1>
      <section className="space-y-3" aria-labelledby="tutor-heading">
        <h2 id="tutor-heading" className="text-xl font-semibold">AI Tutor</h2>
        <p>Ask for a guided explanation of a question from the question bank.</p>
        <form className="flex flex-wrap gap-3" onSubmit={(event) => void askForExplanation(event)}>
          <label className="flex-1">
            Question ID
            <input
              className="mt-1 w-full rounded border p-2"
              value={questionId}
              onChange={(event) => setQuestionId(event.target.value)}
              maxLength={150}
              required
            />
          </label>
          <button type="submit" disabled={isAsking}>
            {isAsking ? "Thinking…" : "Explain this question"}
          </button>
        </form>
        {tutorError ? <p role="alert">{tutorError}</p> : null}
        {explanation ? <p className="whitespace-pre-wrap rounded border p-4">{explanation}</p> : null}
      </section>

      <section className="space-y-3" aria-labelledby="generation-heading">
        <h2 id="generation-heading" className="text-xl font-semibold">Generate practice questions</h2>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => void generateQuestions(event)}>
          <label>
            Subject
            <input
              className="mt-1 w-full rounded border p-2"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              maxLength={100}
              required
            />
          </label>
          <label>
            Topic
            <input
              className="mt-1 w-full rounded border p-2"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              maxLength={100}
              required
            />
          </label>
          <label>
            Difficulty
            <select
              className="mt-1 w-full rounded border p-2"
              value={difficulty}
              onChange={(event) => {
                if (event.target.value === "easy" || event.target.value === "medium" || event.target.value === "hard") {
                  setDifficulty(event.target.value);
                }
              }}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </label>
          <label>
            Number of questions
            <select
              className="mt-1 w-full rounded border p-2"
              value={count}
              onChange={(event) => setCount(Number(event.target.value))}
            >
              {[1, 2, 3, 4, 5].map((amount) => (
                <option key={amount} value={amount}>{amount}</option>
              ))}
            </select>
          </label>
          <button className="sm:col-span-2" type="submit" disabled={isGenerating}>
            {isGenerating ? "Generating…" : "Generate questions"}
          </button>
        </form>
        {generationError ? <p role="alert">{generationError}</p> : null}
        {generatedQuestions.length > 0 ? (
          <div role="status" className="space-y-3">
            <p>Generated questions are pending administrator review.</p>
            {generatedQuestions.map((question) => (
              <article key={question.id} className="rounded border p-4">
                <p className="text-sm">{question.subject} · {question.topic} · {question.difficulty}</p>
                <h3 className="mt-1 font-medium">{question.question}</h3>
                <ol className="mt-2 list-inside list-decimal">
                  {question.options.map((option, index) => <li key={`${question.id}-${index}`}>{option}</li>)}
                </ol>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}

export default function AiTutorPage() {
  return (
    <RequireVerified>
      <AiTutorContent />
    </RequireVerified>
  );
}