"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { BadgeGrid } from "@/components/gamification/BadgeGrid";
import { StreakBadge } from "@/components/gamification/StreakBadge";
import { XPBar } from "@/components/gamification/XPBar";
import { ShareCard } from "@/components/social/ShareCard";
import { useAuth } from "@/lib/hooks/useAuth";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { db } from "@/lib/firebase/client";
import type { GamificationStats } from "@/types/gamification";

const defaultStats: GamificationStats = { xp: 0, level: 1, streak: 0, coins: 0 };

type ProfileData = {
  stats: GamificationStats;
  badges: string[];
  displayName: string | null;
};

function readNonNegativeInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : fallback;
}

export default function ProfilePage() {
  const { user } = useAuth();
  const { isAnonymous } = useUserRole();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }
    let active = true;
    const collection = isAnonymous ? "anon_profiles" : "users";
    const unsubscribe = onSnapshot(
      doc(db, collection, user.uid),
      (snapshot) => {
        if (!active) {
          return;
        }
        const data = snapshot.data() ?? {};
        const storedStats =
          typeof data.stats === "object" && data.stats !== null
            ? (data.stats as Record<string, unknown>)
            : {};
        const statValue = (
          key: keyof GamificationStats,
          fallback: number,
        ): number => {
          const rootValue = data[key];
          return readNonNegativeInteger(
            isAnonymous ? storedStats[key] : rootValue,
            readNonNegativeInteger(storedStats[key], fallback),
          );
        };
        const badges = Array.isArray(data.badges)
          ? data.badges.filter((badge): badge is string => typeof badge === "string")
          : [];

        setProfile({
          stats: {
            xp: statValue("xp", 0),
            level: Math.min(100, Math.max(1, statValue("level", 1))),
            streak: statValue("streak", 0),
            coins: statValue("coins", 0),
          },
          badges,
          displayName:
            typeof data.displayName === "string" && data.displayName.trim()
              ? data.displayName.trim()
              : user.displayName,
        });
        setError(null);
        setIsLoading(false);
      },
      (snapshotError) => {
        if (active) {
          setError(snapshotError.message);
          setIsLoading(false);
        }
      },
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [isAnonymous, user]);

  if (isLoading) {
    return <main aria-live="polite">Loading profile…</main>;
  }
  if (error) {
    return <main role="alert">Could not load your profile: {error}</main>;
  }

  const data = profile ?? {
    stats: defaultStats,
    badges: [],
    displayName: user?.displayName ?? null,
  };

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4">
      <header>
        <h1 className="text-2xl font-bold">{data.displayName ?? "Your profile"}</h1>
        <p className="text-sm text-muted-foreground">
          {isAnonymous ? "Anonymous learner" : "Verified learner"}
        </p>
      </header>
      <XPBar xp={data.stats.xp} level={data.stats.level} />
      <div className="flex flex-wrap items-center gap-4">
        <StreakBadge streak={data.stats.streak} />
        <p className="rounded border px-3 py-2" aria-label={`${data.stats.coins} coins`}>
          🪙 {data.stats.coins} coins
        </p>
      </div>
      <BadgeGrid unlockedBadges={data.badges} />
      <ShareCard
        displayName={data.displayName ?? "QuizMaster learner"}
        level={data.stats.level}
        xp={data.stats.xp}
        streak={data.stats.streak}
      />
    </main>
  );
}