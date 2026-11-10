"use client";

import Link from "next/link";

export default function WelcomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center gap-8 p-6">
      <header className="max-w-2xl space-y-4">
        <p className="font-semibold text-primary">QUIZMASTER</p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          Make every study session count.
        </h1>
        <p className="text-lg text-muted-foreground">
          Practice SSC and Banking questions with quick quizzes, mock tests, and daily progress tracking.
          Start anonymously, with no account required.
        </p>
      </header>
      <div className="flex flex-wrap gap-3">
        <Link className="rounded-md bg-primary px-5 py-3 font-semibold text-white" href="/home">
          Start practicing
        </Link>
        <Link className="rounded-md border px-5 py-3 font-semibold" href="/reels">
          Explore question reels
        </Link>
      </div>
    </main>
  );
}