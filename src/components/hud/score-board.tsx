"use client";

import { useGameStore } from "@/state/game-store";

export function ScoreBoard() {
  const score = useGameStore((s) => s.score);
  const levelTimer = useGameStore((s) => s.levelTimer);
  const medalPace = useGameStore((s) => s.medalPace);
  const progression = useGameStore((s) => s.progression);
  const xpRatio =
    progression.xpToNextLevel > 0
      ? Math.max(0, Math.min(1, progression.xpIntoLevel / progression.xpToNextLevel))
      : 0;

  return (
    <div
      className="hud-reveal hud-ghost absolute top-5 left-1/2 -translate-x-1/2"
      style={{ animationDelay: "100ms" }}
    >
      <div className="flex items-center gap-5">
        {/* Level + XP */}
        <div className="flex items-center gap-2">
          <span className="hud-ghost-value text-[0.65rem] uppercase tracking-[0.18em] text-primary/70">
            Lv {progression.level}
          </span>
          <div className="h-[3px] w-16 overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full bg-primary/70 transition-[width] duration-200"
              style={{ width: `${xpRatio * 100}%` }}
            />
          </div>
        </div>

        {/* Timer — center anchor */}
        <span className="hud-ghost-value text-sm font-semibold">
          {formatTime(levelTimer)}
        </span>

        {/* Score + medal pace */}
        <div className="flex items-center gap-2">
          <span className="hud-ghost-value text-xs text-white/50">
            {score}
          </span>
          <span
            className="hud-ghost-value text-[0.6rem] uppercase tracking-[0.2em] text-white/30 transition-opacity duration-150"
            style={{
              visibility: medalPace.current ? "visible" : "hidden",
              opacity: medalPace.current ? 1 : 0,
            }}
          >
            {medalPace.current || "\u00A0"}
          </span>
        </div>
      </div>
    </div>
  );
}

function formatTime(value: number): string {
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  const tenths = Math.floor((value % 1) * 10);
  return `${minutes}:${String(seconds).padStart(2, "0")}.${tenths}`;
}
