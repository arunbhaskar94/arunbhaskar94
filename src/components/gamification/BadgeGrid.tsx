"use client";

import type { Badge } from "@/types/gamification";

const badgeCatalog: Badge[] = [
  { id: "first-quiz", name: "First Steps", unlockedAt: null },
  { id: "first-correct", name: "First Correct", unlockedAt: null },
  { id: "ten-correct", name: "Getting Warm", unlockedAt: null },
  { id: "hundred-correct", name: "Century", unlockedAt: null },
  { id: "first-mock", name: "Mock Starter", unlockedAt: null },
  { id: "ten-mocks", name: "Mock Veteran", unlockedAt: null },
  { id: "first-pyq", name: "Past-Paper Pro", unlockedAt: null },
  { id: "first-reel", name: "Quick Learner", unlockedAt: null },
  { id: "streak-three", name: "Three-Day Spark", unlockedAt: null },
  { id: "streak-seven", name: "Week of Focus", unlockedAt: null },
  { id: "streak-thirty", name: "Monthly Momentum", unlockedAt: null },
  { id: "streak-hundred", name: "Unstoppable", unlockedAt: null },
  { id: "level-five", name: "Rising Star", unlockedAt: null },
  { id: "level-ten", name: "Double Digits", unlockedAt: null },
  { id: "level-twenty-five", name: "Quarter Century", unlockedAt: null },
  { id: "perfect-quiz", name: "Perfect Run", unlockedAt: null },
  { id: "daily-challenge", name: "Challenge Accepted", unlockedAt: null },
  { id: "battle-win", name: "Battle Victor", unlockedAt: null },
  { id: "group-member", name: "Team Player", unlockedAt: null },
  { id: "referral", name: "Study Buddy", unlockedAt: null },
];

type BadgeGridProps = {
  unlockedBadges: string[];
};

export function BadgeGrid({ unlockedBadges }: BadgeGridProps) {
  const unlocked = new Set(unlockedBadges);

  return (
    <section aria-labelledby="badge-grid-title">
      <h2 id="badge-grid-title" className="text-lg font-semibold">Achievements</h2>
      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {badgeCatalog.map((badge) => {
          const isUnlocked = unlocked.has(badge.id);
          return (
            <li
              key={badge.id}
              aria-label={`${badge.name}: ${isUnlocked ? "unlocked" : "locked"}`}
              className={`rounded-lg border p-3 ${isUnlocked ? "" : "opacity-50"}`}
            >
              <span aria-hidden="true">{isUnlocked ? "🏅" : "🔒"}</span>
              <span className="ml-2">{badge.name}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}