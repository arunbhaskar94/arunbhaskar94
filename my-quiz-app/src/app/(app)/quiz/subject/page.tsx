"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startQuiz } from "@/lib/api/quiz";
import { useQuizStore } from "@/stores/quizStore";

const subjects = ["Quantitative Aptitude", "Reasoning", "English", "General Awareness"];

export default function SubjectQuizPage() {
  const router = useRouter();
  const setSession = useQuizStore((state) => state.setSession);
  const [subject, setSubject] = useState(subjects[0]);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function beginQuiz() {
    setIsStarting(true);
    setError(null);
    try {
      const session = await startQuiz({ subject, count: 30, mode: "subject" });
      setSession(session);
      router.push(`/quiz/${session.sessionId}`);
    } catch (startError: unknown) {
      setError(startError instanceof Error ? startError.message : "Could not start the quiz.");
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <main>
      <h1>Subject Test</h1>
      <label htmlFor="quiz-subject">Choose a subject</label>
      <select
        id="quiz-subject"
        value={subject}
        onChange={(event) => setSubject(event.target.value)}
        disabled={isStarting}
      >
        {subjects.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
      <button type="button" onClick={() => void beginQuiz()} disabled={isStarting}>
        {isStarting ? "Preparing test…" : "Start 30-question test"}
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </main>
  );
}