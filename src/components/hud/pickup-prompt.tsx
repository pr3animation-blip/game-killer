"use client";

import { useGameStore } from "@/state/game-store";

export function PickupPrompt() {
  const pickupPrompt = useGameStore((state) => state.pickupPrompt);
  const objectivePrompt = useGameStore((state) => state.objective.interactPrompt);

  if (!pickupPrompt.active || objectivePrompt) return null;

  return (
    <div className="absolute bottom-[10rem] left-1/2 -translate-x-1/2">
      <div className="hud-ghost flex flex-col items-center gap-1">
        <span className="font-mono text-xs uppercase tracking-[0.18em] text-white/70">
          {pickupPrompt.text}
        </span>
        {pickupPrompt.action === "replace" ? (
          <div className="h-[2px] w-24 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-white/60 transition-[width] duration-75"
              style={{ width: `${Math.max(0, Math.min(100, pickupPrompt.progress * 100))}%` }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
