"use client";

import { useGameStore } from "@/state/game-store";
import { Skull } from "lucide-react";

interface GameOverScreenProps {
  onReturnToMenu: () => void;
  onRetry?: () => void;
}

export function GameOverScreen({ onReturnToMenu, onRetry }: GameOverScreenProps) {
  const stats = useGameStore((s) => s.gameOverStats);
  const leaderboard = useGameStore((s) => s.leaderboard);

  if (!stats) return null;

  const rankIndex = leaderboard.findIndex(
    (e) => e.score === stats.score && e.kills === stats.kills && e.timeAlive === stats.timeAlive
  );
  const isTop = rankIndex !== -1;
  const rank = isTop ? rankIndex + 1 : 0;

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center">
      {/* Dim backdrop */}
      <div className="absolute inset-0 bg-black/85" />

      <div className="relative z-10 flex flex-col items-center gap-6 px-6">
        {/* Death icon */}
        <Skull className="h-10 w-10 text-red-500/80" />

        <h1 className="font-mono text-2xl font-bold uppercase tracking-[0.5em] text-red-500/90">
          Killed
        </h1>

        <p className="font-mono text-xs text-primary/40">
          Eliminated by {stats.killedBy}
        </p>

        {/* Stats grid */}
        <div className="mt-2 grid grid-cols-2 gap-x-10 gap-y-3">
          {[
            ["Score", stats.score.toLocaleString()],
            ["Kills", String(stats.kills)],
            ["Time", formatTime(stats.timeAlive)],
            ["Best Combo", `${stats.bestCombo}x`],
            ["Level", stats.levelReached],
            ["Rank", isTop ? `#${rank} of ${leaderboard.length}` : "Unranked"],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-col">
              <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-primary/35">
                {label}
              </span>
              <span className="font-mono text-sm tabular-nums text-primary/80">
                {value}
              </span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-4">
          {onRetry ? (
            <button
              onClick={onRetry}
              className="tac-btn tac-btn-primary flex h-12 items-center gap-3 px-8"
            >
              <span className="font-mono text-xs uppercase tracking-[0.3em]">
                Retry
              </span>
            </button>
          ) : null}
          <button
            onClick={onReturnToMenu}
            className={`tac-btn flex h-12 items-center gap-3 px-8 ${onRetry ? "" : "tac-btn-primary"}`}
          >
            <span className="font-mono text-xs uppercase tracking-[0.3em]">
              Return to Menu
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
