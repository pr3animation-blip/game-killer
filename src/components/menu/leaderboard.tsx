"use client";

import { useGameStore } from "@/state/game-store";
import { useEffect } from "react";

interface LeaderboardProps {
  onBack: () => void;
}

export function Leaderboard({ onBack }: LeaderboardProps) {
  const leaderboard = useGameStore((s) => s.leaderboard);
  const loadLeaderboard = useGameStore((s) => s.loadLeaderboard);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80">
      <div className="w-full max-w-xl px-6">
        <h2 className="mb-6 text-center font-mono text-lg uppercase tracking-[0.4em] text-primary/80">
          Top Runs
        </h2>

        {leaderboard.length === 0 ? (
          <p className="text-center font-mono text-sm text-primary/40">
            No runs recorded yet. Deploy and fight.
          </p>
        ) : (
          <div className="space-y-1">
            {/* Header */}
            <div className="grid grid-cols-[2rem_1fr_4rem_4rem_4rem] gap-2 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-primary/40">
              <span>#</span>
              <span>Score</span>
              <span className="text-right">Kills</span>
              <span className="text-right">Time</span>
              <span className="text-right">Combo</span>
            </div>

            {leaderboard.map((entry, i) => (
              <div
                key={`${entry.date}-${i}`}
                className="grid grid-cols-[2rem_1fr_4rem_4rem_4rem] gap-2 rounded px-3 py-2 font-mono text-xs tabular-nums text-primary/70 odd:bg-primary/5"
              >
                <span className="text-primary/40">{i + 1}</span>
                <span className="text-primary">{entry.score.toLocaleString()}</span>
                <span className="text-right">{entry.kills}</span>
                <span className="text-right">{formatTime(entry.timeAlive)}</span>
                <span className="text-right">{entry.bestCombo}x</span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 flex justify-center">
          <button
            onClick={onBack}
            className="tac-btn flex h-10 items-center gap-3 px-6"
          >
            <span className="font-mono text-[11px] uppercase tracking-[0.3em]">
              Back
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
