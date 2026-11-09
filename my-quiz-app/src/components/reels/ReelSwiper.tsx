"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { answerQuiz } from "@/lib/api/quiz";
import { fetchReels } from "@/lib/api/reels";
import type { AnswerQuizOutput } from "@/lib/api/schemas";
import type { Question } from "@/types/question";

type ReelItem = {
  reelId: string;
  questionId: string;
  order: number;
  question: Question;
  sessionId: string;
};

type ReelAnswerState = {
  selectedOption: number | null;
  result: AnswerQuizOutput | null;
  error: string | null;
  submitting: boolean;
};

const emptyAnswer: ReelAnswerState = {
  selectedOption: null,
  result: null,
  error: null,
  submitting: false,
};

export function ReelSwiper() {
  const containerRef = useRef<HTMLElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef(false);
  const cursorRef = useRef<string | null>(null);
  const hasMoreRef = useRef(true);
  const [reels, setReels] = useState<ReelItem[]>([]);
  const [answers, setAnswers] = useState<Record<string, ReelAnswerState>>({});
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(async (cursor: string | null) => {
    if (loadingRef.current || (!hasMoreRef.current && cursor !== null)) {
      return;
    }

    loadingRef.current = true;
    if (cursor === null) {
      setIsLoading(true);
    }
    setError(null);
    try {
      const page = await fetchReels(cursor ? { cursor } : {});
      setReels((current) => [
        ...current,
        ...page.reels.map((item) => ({ ...item, sessionId: page.sessionId })),
      ]);
      cursorRef.current = page.nextCursor;
      hasMoreRef.current = page.nextCursor !== null;
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : "Could not load reels.");
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPage(null);
  }, [loadPage]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) {
      return;
    }

    observerRef.current?.disconnect();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }

          const index = Number((entry.target as HTMLElement).dataset.index);
          if (!Number.isInteger(index)) {
            continue;
          }
          setActiveIndex(index);
          if (index >= reels.length - 3 && hasMoreRef.current && !loadingRef.current) {
            void loadPage(cursorRef.current);
          }
        }
      },
      { root, threshold: 0.65 },
    );
    observerRef.current = observer;

    root.querySelectorAll<HTMLElement>("[data-reel-index]").forEach((element) => {
      observer.observe(element);
    });

    return () => observer.disconnect();
  }, [loadPage, reels]);

  async function submitAnswer(reel: ReelItem, selectedOption: number) {
    const current = answers[reel.reelId] ?? emptyAnswer;
    if (current.result || current.submitting) {
      return;
    }

    setAnswers((previous) => ({
      ...previous,
      [reel.reelId]: { ...current, selectedOption, submitting: true, error: null },
    }));

    try {
      const result = await answerQuiz({
        sessionId: reel.sessionId,
        questionId: reel.questionId,
        selectedOption,
      });
      setAnswers((previous) => ({
        ...previous,
        [reel.reelId]: { selectedOption, result, error: null, submitting: false },
      }));
    } catch (answerError: unknown) {
      setAnswers((previous) => ({
        ...previous,
        [reel.reelId]: {
          selectedOption: null,
          result: null,
          error:
            answerError instanceof Error
              ? answerError.message
              : "Your answer could not be submitted.",
          submitting: false,
        },
      }));
    }
  }

  function goToNext() {
    containerRef.current
      ?.querySelector<HTMLElement>(`[data-reel-index="${activeIndex + 1}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (activeIndex >= reels.length - 2 && hasMoreRef.current) {
      void loadPage(cursorRef.current);
    }
  }

  if (isLoading && reels.length === 0) {
    return <main aria-live="polite">Loading questions…</main>;
  }

  if (error && reels.length === 0) {
    return (
      <main>
        <p role="alert">{error}</p>
        <button type="button" onClick={() => void loadPage(null)}>
          Try again
        </button>
      </main>
    );
  }

  if (reels.length === 0) {
    return <main>No reel questions are available yet.</main>;
  }

  return (
    <main
      ref={containerRef}
      aria-label="Question reels"
      className="h-[calc(100dvh-4rem)] snap-y snap-mandatory overflow-y-auto"
    >
      {reels.map((reel, index) => {
        const answer = answers[reel.reelId] ?? emptyAnswer;
        return (
          <motion.article
            key={reel.reelId}
            data-reel-index={index}
            data-index={index}
            initial={{ opacity: 0.7, y: 20 }}
            animate={{ opacity: index === activeIndex ? 1 : 0.85, y: 0 }}
            transition={{ duration: 0.25 }}
            className="flex min-h-full snap-start flex-col justify-center gap-4 p-6"
            aria-labelledby={`reel-question-${reel.reelId}`}
          >
            <p>{reel.question.subject} · {reel.question.topic}</p>
            <h1 id={`reel-question-${reel.reelId}`} className="text-2xl font-semibold">
              {reel.question.question}
            </h1>
            {reel.question.questionImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={reel.question.questionImage}
                alt="Question illustration"
                className="max-h-64 max-w-full object-contain"
              />
            ) : null}
            <div className="grid gap-3">
              {reel.question.options.map((option, optionIndex) => (
                <button
                  type="button"
                  key={`${reel.questionId}-${optionIndex}`}
                  disabled={answer.submitting || answer.result !== null}
                  aria-pressed={answer.selectedOption === optionIndex}
                  onClick={() => void submitAnswer(reel, optionIndex)}
                  className="rounded-lg border p-3 text-left disabled:opacity-70"
                >
                  {option}
                </button>
              ))}
            </div>
            {answer.submitting ? <p aria-live="polite">Checking your answer…</p> : null}
            {answer.error ? <p role="alert">{answer.error}</p> : null}
            {answer.result ? (
              <div role="status">
                <p>{answer.result.isCorrect ? "Correct!" : "Not quite."}</p>
                <p>{answer.result.solution}</p>
                {answer.result.xpEarned > 0 ? <p>+{answer.result.xpEarned} XP</p> : null}
                <button type="button" onClick={goToNext}>Next question</button>
              </div>
            ) : null}
          </motion.article>
        );
      })}
      {error ? <p role="alert" className="p-4">{error}</p> : null}
      {isLoading ? <p className="p-4">Loading more questions…</p> : null}
      {!hasMoreRef.current ? <p className="p-4">You&apos;re all caught up.</p> : null}
    </main>
  );
}