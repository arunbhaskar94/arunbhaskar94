"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/lib/hooks/useAuth";

type AppLayoutProps = {
  children: ReactNode;
};

export default function AppLayout({ children }: AppLayoutProps) {
  const { isAuthenticated, isLoading, error, retryAnonymousSignIn } = useAuth();

  if (isLoading) {
    return <main aria-live="polite">Starting your anonymous session…</main>;
  }

  if (!isAuthenticated) {
    return (
      <main role="alert">
        <p>We couldn&apos;t start your session: {error ?? "Authentication is unavailable."}</p>
        <button type="button" onClick={() => void retryAnonymousSignIn()}>
          Retry
        </button>
      </main>
    );
  }

  return children;
}