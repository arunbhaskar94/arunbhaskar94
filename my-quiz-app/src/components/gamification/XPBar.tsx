"use client";

type XPBarProps = {
  xp: number;
  level: number;
};

function getLevelFloor(level: number): number {
  return level >= 100 ? 1_000_000 : level * level * 100;
}

export function XPBar({ xp, level }: XPBarProps) {
  const safeLevel = Math.min(100, Math.max(1, Math.floor(level)));
  const safeXp = Math.max(0, Math.floor(xp));
  const currentFloor = getLevelFloor(safeLevel);
  const nextFloor = getLevelFloor(safeLevel + 1);
  const progress =
    safeLevel >= 100
      ? 100
      : Math.min(100, Math.max(0, ((safeXp - currentFloor) / (nextFloor - currentFloor)) * 100));

  return (
    <section aria-label={`Level ${safeLevel} experience`}>
      <div className="mb-1 flex justify-between text-sm">
        <span>Level {safeLevel}</span>
        <span>{safeXp.toLocaleString()} XP</span>
      </div>
      <progress
        className="h-3 w-full"
        value={progress}
        max={100}
        aria-label={safeLevel >= 100 ? "Maximum level reached" : `${Math.round(progress)}% to next level`}
      />
      <p className="mt-1 text-xs text-muted-foreground">
        {safeLevel >= 100
          ? "Maximum level reached"
          : `${Math.max(0, nextFloor - safeXp).toLocaleString()} XP to level ${safeLevel + 1}`}
      </p>
    </section>
  );
}