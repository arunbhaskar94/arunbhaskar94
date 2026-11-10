"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const themes = ["light", "dark", "system"] as const;
type ThemeChoice = (typeof themes)[number];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentTheme: ThemeChoice =
    themes.find((choice) => choice === theme) ?? "system";
  const nextTheme = themes[(themes.indexOf(currentTheme) + 1) % themes.length];

  return (
    <button
      type="button"
      className="rounded-md border px-3 py-2"
      disabled={!mounted}
      onClick={() => setTheme(nextTheme)}
      aria-label={`Theme: ${mounted ? currentTheme : "system"}. Switch to ${nextTheme} mode`}
    >
      Theme: {mounted ? currentTheme : "system"}
    </button>
  );
}
