"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startQuiz } from "@/lib/api/quiz";
import { useQuizStore } from "@/stores/quizStore";

export default function FullMockPage() {
  const router = useRouter();
  const setSession = useQuizStore((state) => state.setSession);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function beginQuiz() {
    setIsStarting(true);
    setError(null);
    try {
      const session = await startQuiz({ count: 30, mode: "full" });
      setSession(session);
      router.push(`/quiz/${session.sessionId}`);
    } catch (startError: unknown) {
      setError(startError instanceof Error ? startError.message : "Could not start the mock.");
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <main>
      <h1>Full Mock</h1>
      <p>30 mixed questions, selected from the active question bank.</p>
      <button type="button" onClick={() => void beginQuiz()} disabled={isStarting}>
        {isStarting ? "Preparing mock…" : "Start full mock"}
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </main>
  );
}