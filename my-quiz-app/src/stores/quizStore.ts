import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AnswerQuizOutput, StartQuizOutput } from "@/lib/api/schemas";
import type { Question } from "@/types/question";

type QuizState = {
  sessionId: string | null;
  mode: StartQuizOutput["mode"] | null;
  subject: string | null;
  questions: Question[];
  currentQuestionIndex: number;
  selectedOption: number | null;
  answerResult: AnswerQuizOutput | null;
  isSubmitting: boolean;
  error: string | null;
  setSession: (session: StartQuizOutput) => void;
  selectOption: (optionIndex: number) => void;
  setAnswerResult: (result: AnswerQuizOutput) => void;
  setSubmitting: (isSubmitting: boolean) => void;
  setError: (error: string | null) => void;
  nextQuestion: () => void;
  clearSession: () => void;
};

const initialQuizState = {
  sessionId: null,
  mode: null,
  subject: null,
  questions: [],
  currentQuestionIndex: 0,
  selectedOption: null,
  answerResult: null,
  isSubmitting: false,
  error: null,
};

export const useQuizStore = create<QuizState>()(
  persist(
    (set) => ({
      ...initialQuizState,
      setSession: (session) =>
        set({
          sessionId: session.sessionId,
          mode: session.mode,
          subject: session.subject,
          questions: session.questions,
          currentQuestionIndex: 0,
          selectedOption: null,
          answerResult: null,
          isSubmitting: false,
          error: null,
        }),
      selectOption: (optionIndex) => set({ selectedOption: optionIndex, error: null }),
      setAnswerResult: (answerResult) => set({ answerResult, error: null }),
      setSubmitting: (isSubmitting) => set({ isSubmitting }),
      setError: (error) => set({ error }),
      nextQuestion: () =>
        set((state) => ({
          currentQuestionIndex: Math.min(
            state.currentQuestionIndex + 1,
            Math.max(state.questions.length - 1, 0),
          ),
          selectedOption: null,
          answerResult: null,
          error: null,
        })),
      clearSession: () => set(initialQuizState),
    }),
    {
      name: "quizmaster-active-quiz",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        sessionId: state.sessionId,
        mode: state.mode,
        subject: state.subject,
        questions: state.questions,
        currentQuestionIndex: state.currentQuestionIndex,
        selectedOption: state.selectedOption,
        answerResult: state.answerResult,
        isSubmitting: false,
        error: null,
      }),
    },
  ),
);