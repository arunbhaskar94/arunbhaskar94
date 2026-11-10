"use client";

import { useState } from "react";
import { answerQuiz } from "@/lib/api/quiz";
import { QuestionCard } from "@/components/quiz/QuestionCard";
import { useQuizStore } from "@/stores/quizStore";

type QuizSessionProps = {
  sessionId: string;
};

export function QuizSession({ sessionId }: QuizSessionProps) {
  const [requestPending, setRequestPending] = useState(false);
  const storedSessionId = useQuizStore((state) => state.sessionId);
  const questions = useQuizStore((state) => state.questions);
  const index = useQuizStore((state) => state.currentQuestionIndex);
  const selectedOption = useQuizStore((state) => state.selectedOption);
  const answerResult = useQuizStore((state) => state.answerResult);
  const error = useQuizStore((state) => state.error);
  const selectOption = useQuizStore((state) => state.selectOption);
  const setAnswerResult = useQuizStore((state) => state.setAnswerResult);
  const setError = useQuizStore((state) => state.setError);
  const nextQuestion = useQuizStore((state) => state.nextQuestion);

  if (!storedSessionId || storedSessionId !== sessionId || questions.length === 0) {
    return (
      <main>
        <h1>Quiz session unavailable</h1>
        <p>Start a new quiz to continue.</p>
        <a href="/quiz/full">Start a full mock</a>
      </main>
    );
  }

  const question = questions[index];
  if (!question) {
    return <p role="alert">This quiz session has no current question.</p>;
  }

  const isLastQuestion = index === questions.length - 1;

  async function submitAnswer() {
    if (selectedOption === null || answerResult || requestPending) {
      return;
    }

    setRequestPending(true);
    setError(null);
    try {
      const result = await answerQuiz({
        sessionId,
        questionId: question.id,
        selectedOption,
      });
      setAnswerResult(result);
    } catch (submitError: unknown) {
      setError(
        submitError instanceof Error ? submitError.message : "Your answer could not be submitted.",
      );
    } finally {
      setRequestPending(false);
    }
  }

  return (
    <main>
      <p>
        Question {index + 1} of {questions.length}
      </p>
      <QuestionCard
        question={question}
        selectedOption={selectedOption}
        onSelect={selectOption}
        disabled={requestPending}
        result={answerResult}
      />
      {error ? <p role="alert">{error}</p> : null}
      {!answerResult ? (
        <button
          type="button"
          onClick={() => void submitAnswer()}
          disabled={selectedOption === null || requestPending}
        >
          {requestPending ? "Submitting…" : "Submit answer"}
        </button>
      ) : isLastQuestion ? (
        <p role="status">Quiz complete. You answered all {questions.length} questions.</p>
      ) : (
        <button type="button" onClick={nextQuestion}>
          Next question
        </button>
      )}
    </main>
  );
}