"use client";

import { useGameStore } from "@/state/game-store";

export function AmmoCounter() {
  const inventory = useGameStore((state) => state.inventory);

  const isCritical = !inventory.isReloading && inventory.ammo <= 5;

  return (
    <div
      className="hud-reveal hud-ghost absolute bottom-8 right-8 flex flex-col items-end gap-1"
      style={{ animationDelay: "300ms" }}
    >
      <span className="hud-ghost-label">
        {inventory.activeWeaponName ?? "Unarmed"}
      </span>
      <div className="relative min-h-[2rem] min-w-[5rem] flex items-end justify-end">
        <span
          className="hud-ghost-value absolute inset-0 flex items-center justify-end animate-pulse text-lg font-semibold text-white/60 transition-opacity duration-100"
          style={{ opacity: inventory.isReloading ? 1 : 0, pointerEvents: inventory.isReloading ? "auto" : "none" }}
        >
          RELOADING
        </span>
        <div
          className="flex items-baseline gap-1 transition-opacity duration-100"
          style={{ opacity: inventory.isReloading ? 0 : 1, pointerEvents: inventory.isReloading ? "none" : "auto" }}
        >
          <span
            className={`hud-ghost-value text-2xl font-semibold leading-none ${
              isCritical ? "text-red-400/90" : ""
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
            {inventory.ammo}
          </span>
          <span className="font-mono text-sm text-white/25">/</span>
          <span className="hud-ghost-value text-sm text-white/50">
            {inventory.reserveAmmo}
          </span>
        </div>
      </div>
    </div>
  );
}
