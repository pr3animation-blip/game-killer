"use client";

import { useGameStore } from "@/state/game-store";

export function BossIntroBanner() {
  const boss = useGameStore((state) => state.boss);
  const gameState = useGameStore((state) => state.gameState);

  if (!boss.active || !boss.introActive || gameState !== "playing") {
    return null;
  }

  return (
    <div className="absolute inset-x-0 top-20 flex justify-center">
      <div className="menu-card-enter rounded-sm border border-border bg-[rgba(2,8,18,0.84)] px-6 py-4 text-center shadow-[0_18px_60px_rgba(0,0,0,0.5)]">
        <div className="font-mono text-[0.68rem] uppercase tracking-[0.28em] text-primary/60">
          Threat Escalation
        </div>
        <div className="mt-1 font-mono text-2xl font-bold uppercase tracking-[0.16em] text-white">
          {boss.name}
        </div>
        <div className="mt-2 font-mono text-xs uppercase tracking-[0.16em] text-white/58">
          {boss.introText}
        </div>
      </div>
    </div>
  );
}
