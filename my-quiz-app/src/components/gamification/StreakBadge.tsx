"use client";

type StreakBadgeProps = {
  streak: number;
  className?: string;
};

export function StreakBadge({ streak, className }: StreakBadgeProps) {
  const safeStreak = Math.max(0, Math.floor(streak));

  return (
    <div
      className={className}
      role="img"
      aria-label={`${safeStreak} day study streak`}
      title={`${safeStreak} day study streak`}
    >
      <span aria-hidden="true">🔥</span> {safeStreak} day{safeStreak === 1 ? "" : "s"}
    </div>
  );
}