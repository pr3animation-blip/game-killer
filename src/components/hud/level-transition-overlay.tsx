"use client";

import { useGameStore } from "@/state/game-store";

export function LevelTransitionOverlay() {
  const currentLevel = useGameStore((s) => s.currentLevel);

  return (
    <div className="menu-overlay-enter absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
      <p className="font-mono text-[10px] uppercase tracking-[0.5em] text-primary/50">
        Deploying
      </p>
      <h2
        className="mt-3 font-mono text-3xl font-bold uppercase tracking-[0.25em] text-primary"
        style={{
          textShadow: "0 0 30px rgba(224, 96, 48, 0.4)",
        }}
      >
        {currentLevel.name}
      </h2>
      <div className="mt-6 h-[2px] w-48 overflow-hidden rounded-full bg-primary/20">
        <div className="level-transition-bar h-full bg-primary/70" />
      </div>
    </div>
  );
}
