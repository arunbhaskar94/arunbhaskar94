"use client";

import { useParams } from "next/navigation";
import { QuizSession } from "@/components/quiz/QuizSession";

export default function QuizSessionPage() {
  const params = useParams<{ sessionId: string }>();

  return <QuizSession sessionId={params.sessionId} />;
}