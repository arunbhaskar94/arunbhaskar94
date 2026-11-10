"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { importAdminQuestions, loadAdminQuestions } from "@/lib/api/admin";
import type { z } from "zod";
import { adminQuestionListOutputSchema } from "@/lib/api/adminSchemas";

type QuestionList = z.infer<typeof adminQuestionListOutputSchema>;
type AdminQuestion = QuestionList["questions"][number];

export default function AdminQuestionsPage() {
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshQuestions = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await loadAdminQuestions();
      setQuestions(result.questions);
      setError(null);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : "Could not load questions.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshQuestions();
  }, [refreshQuestions]);

  async function importFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || isImporting) return;

    const formData = new FormData();
    formData.set("file", file);
    event.currentTarget.reset();
    setFile(null);
    setIsImporting(true);
    setMessage(null);
    setError(null);
    try {
      const result = await importAdminQuestions(formData);
      setMessage(result.message);
      await refreshQuestions();
    } catch (importError: unknown) {
      setError(importError instanceof Error ? importError.message : "Import failed.");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <main className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">Question bank</h1>
        <p className="mt-1 text-sm text-muted-foreground">Import a JSON array or a CSV file (maximum 500 questions).</p>
      </header>
      <form className="flex flex-wrap items-end gap-3 rounded-lg border p-4" onSubmit={(event) => void importFile(event)}>
        <label className="flex-1">
          CSV or JSON file
          <input
            className="mt-1 block w-full"
            type="file"
            accept=".csv,.json,text/csv,application/json"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            required
          />
        </label>
        <button type="submit" disabled={!file || isImporting}>
          {isImporting ? "Importing…" : "Import questions"}
        </button>
      </form>
      <p className="text-xs text-muted-foreground">
        Required CSV columns: question, options (pipe-separated), correctOptionIndex, solution,
        subject, chapter, topic, difficulty. Optional CSV fields include questionImage and questionType.
        JSON may be an array or an object with a questions array.
      </p>
      {message ? <p role="status">{message}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      <section>
        <h2 className="text-lg font-semibold">Latest questions</h2>
        {isLoading ? <p aria-live="polite">Loading questions…</p> : null}
        {!isLoading && questions.length === 0 ? <p>No questions found.</p> : null}
        <ul className="mt-3 space-y-3">
          {questions.map((question) => (
            <li className="rounded-lg border p-4" key={question.id}>
              <div className="flex flex-wrap justify-between gap-2">
                <p className="font-medium">{question.question}</p>
                <span className="text-xs">{question.status}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {question.subject} · {question.chapter} · {question.topic} · {question.difficulty}
              </p>
              <ol className="mt-2 list-inside list-decimal text-sm">
                {question.options.map((option, index) => <li key={`${question.id}-${index}`}>{option}</li>)}
              </ol>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}