"use client";

import { useEffect } from "react";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error("Page rendering failed.", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-start justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold">This page couldn&apos;t load</h1>
      <p className="text-muted-foreground">
        Please try again. Your account and saved progress are unchanged.
      </p>
      {error.digest ? <p className="text-xs text-muted-foreground">Error reference: {error.digest}</p> : null}
      <button className="rounded-md bg-primary px-4 py-2 text-white" type="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
