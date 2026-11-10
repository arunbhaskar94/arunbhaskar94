"use client";

import { NotificationSetup } from "@/components/social/NotificationSetup";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { useUserRole } from "@/lib/hooks/useUserRole";

export default function SettingsPage() {
  const { isVerified } = useUserRole();

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4">
      <header>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Personalize your QuizMaster experience.</p>
      </header>
      <section className="space-y-3 rounded-lg border p-4">
        <div>
          <h2 className="font-semibold">Appearance</h2>
          <p className="text-sm text-muted-foreground">Choose light, dark, or follow your device setting.</p>
        </div>
        <ThemeToggle />
      </section>
      {isVerified ? <NotificationSetup /> : null}
    </main>
  );
}