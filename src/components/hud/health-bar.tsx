"use client";

import { useGameStore } from "@/state/game-store";

export function HealthBar() {
  const health = useGameStore((s) => s.health);
  const maxHealth = useGameStore((s) => s.maxHealth);
  const pct = (health / maxHealth) * 100;

  const barColor =
    pct > 60
      ? "bg-white/80"
      : pct > 30
        ? "bg-amber-400/90"
        : "bg-red-500/90";

  const isCritical = pct <= 30;

  return (
    <div
      className="hud-reveal hud-ghost absolute bottom-8 left-8 flex items-center gap-3"
      style={{ animationDelay: "200ms" }}
    >
      <div className="flex flex-col gap-1">
        <div className="h-[3px] w-36 overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full ${barColor} transition-[width] duration-100 ease-out`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <span
        className={`hud-ghost-value text-xl font-semibold leading-none ${
          isCritical ? "text-red-400/90 health-critical" : ""
        }`}
        style={
          isCritical
            ? {
                textShadow:
                  "0 0 12px rgba(248,113,113,0.6), 0 1px 4px rgba(0,0,0,0.8)",
              }
            : undefined
        }
      >
        {health}
      </span>
    </div>
  );
}
