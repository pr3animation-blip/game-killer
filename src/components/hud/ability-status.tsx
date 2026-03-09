"use client";

import { useGameStore } from "@/state/game-store";

export function AbilityStatus() {
  const dashCooldown = useGameStore((state) => state.dashCooldown);

  if (dashCooldown <= 0) return null;

  return (
    <div className="absolute bottom-[8.5rem] left-1/2 -translate-x-1/2">
      <span className="hud-ghost-value text-xs text-white/40">
        Dash {dashCooldown.toFixed(1)}s
      </span>
    </div>
  );
}
