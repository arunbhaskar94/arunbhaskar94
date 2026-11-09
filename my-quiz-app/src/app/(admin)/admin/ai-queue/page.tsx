"use client";

import { useCallback, useEffect, useState } from "react";
import {
  loadAdminAiQueue,
  reviewAdminAiQuestion,
} from "@/lib/api/admin";
import type { z } from "zod";
import { adminAiQueueOutputSchema } from "@/lib/api/adminSchemas";

type AiQuestion = z.infer<typeof adminAiQueueOutputSchema>["questions"][number];

export default function AdminAiQueuePage() {
  const [questions, setQuestions] = useState<AiQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await loadAdminAiQueue();
      setQuestions(result.questions);
      setError(null);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : "Could not load review queue.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function review(questionId: string, decision: "approve" | "reject") {
    if (busyId) return;
    setBusyId(questionId);
    setError(null);
    setMessage(null);
    try {
      const result = await reviewAdminAiQuestion({ questionId, decision });
      setMessage(result.message);
      setQuestions((current) => current.filter((question) => question.id !== questionId));
    } catch (reviewError: unknown) {
      setError(reviewError instanceof Error ? reviewError.message : "Review action failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="space-y-5 p-6">
      <header>
        <h1 className="text-2xl font-bold">AI question review</h1>
        <p className="mt-1 text-sm text-muted-foreground">Approve questions to publish them to the question bank.</p>
      </header>
      {isLoading ? <p aria-live="polite">Loading pending questions…</p> : null}
      {message ? <p role="status">{message}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {!isLoading && questions.length === 0 ? <p>The review queue is empty.</p> : null}
      <ul className="space-y-4">
        {questions.map((question) => (
          <li key={question.id} className="space-y-3 rounded-lg border p-4">
            <div className="flex flex-wrap justify-between gap-2">
              <p className="font-medium">{question.question}</p>
              <span className="text-xs">Pending · {question.subject} / {question.topic}</span>
            </div>
            <ol className="list-inside list-decimal">
              {question.options.map((option, index) => <li key={`${question.id}-${index}`}>{option}</li>)}
            </ol>
            <p className="text-sm text-muted-foreground">
              {question.difficulty} · Submitted by {question.generatedFor}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busyId !== null}
                onClick={() => void review(question.id, "approve")}
              >
                {busyId === question.id ? "Saving…" : "Approve"}
              </button>
              <button
                type="button"
                disabled={busyId !== null}
                onClick={() => void review(question.id, "reject")}
              >
                Reject
              </button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}