"use client";

import type { ReactNode } from "react";
import { useUserRole } from "@/lib/hooks/useUserRole";

type RequireVerifiedProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

export function RequireVerified({ children, fallback }: RequireVerifiedProps) {
  const { isLoading, isVerified } = useUserRole();

  if (isLoading) {
    return <main aria-live="polite">Checking account access…</main>;
  }
  if (!isVerified) {
    return (
      fallback ?? (
        <main className="mx-auto max-w-xl p-6" role="status">
          <h1 className="text-xl font-semibold">Verified account required</h1>
          <p className="mt-2">
            Verify your email to unlock PYQ practice, chat, and AI tutoring.
          </p>
        </main>
      )
    );
  }

  return children;
}