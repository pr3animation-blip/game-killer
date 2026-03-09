"use client";

import { useGameStore } from "@/state/game-store";

export function KillFeed() {
  const visible = useGameStore((s) => s.killFeed);

  if (visible.length === 0) return null;

  return (
    <div role="log" aria-live="polite" className="absolute top-[7.5rem] right-8 flex flex-col gap-1">
      {visible.map((entry, i) => (
        <div
          key={`${entry.timestamp}-${i}`}
          className="hud-ghost flex items-center gap-1.5 font-mono text-xs animate-in slide-in-from-right duration-200"
        >
          <span
            className={
              entry.killer === "You"
                ? "font-semibold text-white/90"
                : "text-white/50"
            }
          >
            {entry.killer}
          </span>
          <span className="text-white/20">{entry.weapon}</span>
          <span
            className={
              entry.victim === "You"
                ? "font-semibold text-red-400/80"
                : "text-white/60"
            }
          >
            {entry.victim}
          </span>
        </div>
      ))}
    </div>
  );
}
