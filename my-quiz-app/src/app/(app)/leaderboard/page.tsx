"use client";

import { useEffect, useState } from "react";
import { fetchLeaderboard, leaderboardKindSchema } from "@/lib/api/leaderboard";
import type { z } from "zod";
import { leaderboardOutputSchema } from "@/lib/api/leaderboard";

type LeaderboardResult = z.infer<typeof leaderboardOutputSchema>;
type LeaderboardKind = "daily" | "weekly" | "subject";

const subjects = ["Quantitative Aptitude", "Reasoning", "English", "General Awareness"];

export default function LeaderboardPage() {
  const [kind, setKind] = useState<LeaderboardKind>("daily");
  const [subject, setSubject] = useState(subjects[0]);
  const [result, setResult] = useState<LeaderboardResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    void fetchLeaderboard(kind === "subject" ? { kind, subject } : { kind })
      .then((leaderboard) => {
        if (active) {
          setResult(leaderboard);
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error ? loadError.message : "Could not load the leaderboard.",
          );
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [kind, subject]);

  return (
    <main className="mx-auto max-w-3xl p-4">
      <h1 className="text-2xl font-bold">Cohort leaderboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Compete with learners in your level cohort.
      </p>
      <div className="my-4 flex flex-wrap gap-3">
        <label>
          Period
          <select
            className="ml-2 rounded border p-2"
            value={kind}
            onChange={(event) => {
              const parsedKind = leaderboardKindSchema.safeParse(event.target.value);
              if (parsedKind.success) {
                setKind(parsedKind.data);
              }
            }}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="subject">Subject</option>
          </select>
        </label>
        {kind === "subject" ? (
          <label>
            Subject
            <select
              className="ml-2 rounded border p-2"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
            >
              {subjects.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
        ) : null}
      </div>
      {result ? (
        <p className="mb-3 text-sm">Level cohort: {result.cohortStartLevel}–{Math.min(100, result.cohortStartLevel + 9)}</p>
      ) : null}
      {isLoading ? <p aria-live="polite">Loading rankings…</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {!isLoading && !error && result?.entries.length === 0 ? (
        <p>No scores have been recorded for this leaderboard yet.</p>
      ) : null}
      {result?.ownRank ? <p aria-live="polite">Your rank: #{result.ownRank}</p> : null}
      {result?.entries.length ? (
        <ol className="mt-3 divide-y rounded-lg border">
          {result.entries.map((entry) => (
            <li
              key={`${entry.rank}-${entry.displayName}`}
              className={`flex items-center justify-between p-3 ${entry.isCurrentUser ? "bg-muted font-semibold" : ""}`}
            >
              <span>#{entry.rank} · {entry.displayName}{entry.isCurrentUser ? " (you)" : ""}</span>
              <span>Lv. {entry.level} · {entry.score.toLocaleString()} XP</span>
            </li>
          ))}
        </ol>
      ) : null}
    </main>
  );
}