"use client";

import { useEffect, useState } from "react";
import { loadAdminDashboard } from "@/lib/api/admin";
import type { z } from "zod";
import { adminDashboardOutputSchema } from "@/lib/api/adminSchemas";

type Dashboard = z.infer<typeof adminDashboardOutputSchema>;

const cards: { key: keyof Dashboard; label: string }[] = [
  { key: "users", label: "Verified users" },
  { key: "anonymousUsers", label: "Anonymous profiles" },
  { key: "questions", label: "Question bank" },
  { key: "pendingAiQuestions", label: "AI review queue" },
  { key: "todayActive", label: "Active today (UTC)" },
];

export default function AdminDashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void loadAdminDashboard()
      .then((result) => {
        if (active) setData(result);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Could not load analytics.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold">Admin overview</h1>
      <p className="mt-1 text-sm text-muted-foreground">Current platform counts</p>
      {isLoading ? <p aria-live="polite">Loading dashboard…</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {data ? (
        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map(({ key, label }) => (
            <article key={key} className="rounded-lg border p-5">
              <h2 className="text-sm text-muted-foreground">{label}</h2>
              <p className="mt-2 text-3xl font-semibold">{data[key].toLocaleString()}</p>
            </article>
          ))}
        </section>
      ) : null}
    </main>
  );
}