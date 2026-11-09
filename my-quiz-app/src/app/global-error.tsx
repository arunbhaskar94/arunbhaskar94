"use client";

import { useEffect } from "react";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error("Application rendering failed.", error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="mx-auto flex min-h-screen max-w-lg flex-col items-start justify-center gap-4 p-6">
          <h1 className="text-2xl font-bold">QuizMaster is having trouble</h1>
          <p>Try reloading the application.</p>
          {error.digest ? <p>Error reference: {error.digest}</p> : null}
          <button type="button" onClick={reset}>Try again</button>
        </main>
      </body>
    </html>
  );
}
