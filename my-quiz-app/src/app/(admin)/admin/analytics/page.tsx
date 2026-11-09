"use client";

import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { loadAdminAnalytics } from "@/lib/api/admin";
import type { z } from "zod";
import { adminAnalyticsOutputSchema } from "@/lib/api/adminSchemas";

type Analytics = z.infer<typeof adminAnalyticsOutputSchema>;

export default function AdminAnalyticsPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void loadAdminAnalytics()
      .then((result) => {
        if (active) setAnalytics(result);
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
    <main className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">Platform analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">Daily activity and next-day cohort retention, UTC.</p>
      </header>
      {isLoading ? <p aria-live="polite">Loading analytics…</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {analytics ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-lg border p-4" aria-labelledby="dau-title">
            <h2 id="dau-title" className="mb-4 font-semibold">Daily active learners</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.dau} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={(value: string) => value.slice(5)} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="users" name="Active learners" stroke="#2563eb" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
          <section className="rounded-lg border p-4" aria-labelledby="retention-title">
            <h2 id="retention-title" className="mb-4 font-semibold">Cohort retention</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.retention} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" tickFormatter={(value: string) => value.slice(5)} />
                  <YAxis domain={[0, 100]} unit="%" />
                  <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                  <Line type="monotone" dataKey="rate" name="Returned next day" stroke="#16a34a" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}