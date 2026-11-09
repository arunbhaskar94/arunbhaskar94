"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { useUserRole } from "@/lib/hooks/useUserRole";

const practiceLinks = [
  { href: "/quiz/subject", title: "Subject test", description: "Focus on one subject." },
  { href: "/quiz/full", title: "Full mock", description: "Try a mixed practice test." },
  { href: "/reels", title: "Question reels", description: "Swipe through quick questions." },
  { href: "/leaderboard", title: "Leaderboard", description: "See your cohort progress." },
];

export default function HomePage() {
  const { isVerified } = useUserRole();

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-primary">QUIZMASTER</p>
          <h1 className="mt-1 text-3xl font-bold">Ready for a quick practice?</h1>
          <p className="mt-2 text-muted-foreground">
            {isVerified ? "Your study tools are ready." : "You are practicing anonymously. No sign-in needed."}
          </p>
        </div>
        <ThemeToggle />
      </header>
      <section className="grid gap-4 sm:grid-cols-2">
        {practiceLinks.map((item) => (
          <Link
            className="space-y-2 rounded-xl border p-5 transition-colors hover:bg-muted"
            href={item.href}
            key={item.href}
          >
            <h2 className="text-lg font-semibold">{item.title}</h2>
            <p className="text-sm text-muted-foreground">{item.description}</p>
          </Link>
        ))}
      </section>
      <nav className="flex flex-wrap gap-x-5 gap-y-3 text-sm">
        <Link href="/profile">Profile & share card</Link>
        <Link href="/settings">Settings</Link>
        {isVerified ? <Link href="/pyq">Previous-year questions</Link> : null}
      </nav>
    </main>
  );
}