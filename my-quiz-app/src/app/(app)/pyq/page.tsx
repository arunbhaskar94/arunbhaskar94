"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RequireVerified } from "@/components/guards/RequireVerified";
import { useAuth } from "@/lib/hooks/useAuth";
import { servePyq } from "@/lib/api/verified";
import { db } from "@/lib/firebase/client";
import { useQuizStore } from "@/stores/quizStore";

function PyqContent() {
  const router = useRouter();
  const { user } = useAuth();
  const setSession = useQuizStore((state) => state.setSession);
  const [hasServed, setHasServed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }

    return onSnapshot(
      doc(db, "users", user.uid),
      (snapshot) => {
        setHasServed(Boolean(snapshot.get("pyqServedAt")));
        setChecking(false);
      },
      (snapshotError) => {
        setError(snapshotError.message);
        setChecking(false);
      },
    );
  }, [user]);

  async function beginPyq() {
    setIsStarting(true);
    setError(null);
    try {
      const session = await servePyq();
      setSession({
        sessionId: session.sessionId,
        mode: "pyq",
        subject: null,
        questions: session.questions,
      });
      setHasServed(true);
      router.push(`/quiz/${session.sessionId}`);
    } catch (startError: unknown) {
      setError(
        startError instanceof Error ? startError.message : "The PYQ set could not be loaded.",
      );
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4">
      <h1 className="text-2xl font-bold">Previous Year Questions</h1>
      <p>One 30-question PYQ set is available once per verified account.</p>
      {checking ? <p aria-live="polite">Checking PYQ availability…</p> : null}
      {!checking && hasServed ? (
        <p role="status">Your one-time PYQ set has already been served.</p>
      ) : null}
      {!checking && !hasServed ? (
        <button type="button" onClick={() => void beginPyq()} disabled={isStarting}>
          {isStarting ? "Loading PYQ set…" : "Start 30-question PYQ set"}
        </button>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
    </main>
  );
}

export default function PyqPage() {
  return (
    <RequireVerified>
      <PyqContent />
    </RequireVerified>
  );
}