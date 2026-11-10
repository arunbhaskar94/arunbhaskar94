"use client";

import { useCallback, useEffect, useState } from "react";
import {
  loadAdminUsers,
  manageAdminUser,
} from "@/lib/api/admin";
import type { z } from "zod";
import { adminUsersOutputSchema } from "@/lib/api/adminSchemas";

type AdminUser = z.infer<typeof adminUsersOutputSchema>["users"][number];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [xpAmounts, setXpAmounts] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await loadAdminUsers();
      setUsers(result.users);
      setError(null);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : "Could not load users.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function performAction(input: {
    uid: string;
    action: "ban" | "unban" | "verify" | "adjust_xp";
    amount?: number;
  }) {
    if (busyUid) return;
    setBusyUid(input.uid);
    setError(null);
    setMessage(null);
    try {
      const result = await manageAdminUser(input);
      setMessage(result.message);
      await refresh();
    } catch (actionError: unknown) {
      setError(actionError instanceof Error ? actionError.message : "User action failed.");
    } finally {
      setBusyUid(null);
    }
  }

  return (
    <main className="space-y-5 p-6">
      <header>
        <h1 className="text-2xl font-bold">User management</h1>
        <p className="mt-1 text-sm text-muted-foreground">Emails are intentionally omitted from the admin list.</p>
      </header>
      {isLoading ? <p aria-live="polite">Loading users…</p> : null}
      {message ? <p role="status">{message}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      <div className="space-y-3">
        {users.map((user) => (
          <article key={user.uid} className="space-y-3 rounded-lg border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-semibold">{user.displayName || "Learner"}</h2>
                <p className="break-all font-mono text-xs text-muted-foreground">{user.uid}</p>
              </div>
              <p className="text-sm">
                {user.role} · {user.emailVerified ? "verified" : "unverified"} · {user.disabled ? "banned" : "active"}
              </p>
            </div>
            <p className="text-sm">Level {user.level} · {user.xp.toLocaleString()} XP · {user.streak} day streak</p>
            <div className="flex flex-wrap gap-2">
              {user.role === "verified" && !user.emailVerified ? (
                <button type="button" disabled={busyUid !== null} onClick={() => void performAction({ uid: user.uid, action: "verify" })}>
                  Verify
                </button>
              ) : null}
              {user.role === "verified" ? (
                <button
                  type="button"
                  disabled={busyUid !== null}
                  onClick={() => void performAction({ uid: user.uid, action: user.disabled ? "unban" : "ban" })}
                >
                  {user.disabled ? "Unban" : "Ban"}
                </button>
              ) : null}
              <label className="flex items-center gap-2 text-sm">
                XP adjustment
                <input
                  className="w-28 rounded border p-1"
                  type="number"
                  min={-1_000_000}
                  max={1_000_000}
                  value={xpAmounts[user.uid] ?? ""}
                  onChange={(event) => setXpAmounts((current) => ({ ...current, [user.uid]: event.target.value }))}
                />
              </label>
              <button
                type="button"
                disabled={busyUid !== null || !xpAmounts[user.uid] || !Number.isInteger(Number(xpAmounts[user.uid]))}
                onClick={() => {
                  const amount = Number(xpAmounts[user.uid]);
                  void performAction({ uid: user.uid, action: "adjust_xp", amount });
                }}
              >
                Adjust XP
              </button>
            </div>
          </article>
        ))}
      </div>
      {!isLoading && users.length === 0 ? <p>No users found.</p> : null}
    </main>
  );
}