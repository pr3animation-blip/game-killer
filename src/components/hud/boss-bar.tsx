"use client";

import { useGameStore } from "@/state/game-store";

const WEAPON_LABELS = {
  "conductor-beam": "Conductor Beam",
  "siege-mortar": "Siege Mortar",
  "phase-rail": "Phase Rail",
} as const;

export function BossBar() {
  const boss = useGameStore((state) => state.boss);
  const gameState = useGameStore((state) => state.gameState);

  if (!boss.active || !["playing", "levelUpChoice"].includes(gameState)) {
    return null;
  }

  const healthPct = boss.maxHealth > 0 ? Math.max(0, Math.min(100, (boss.health / boss.maxHealth) * 100)) : 0;
  const weaponLabel = boss.weaponType ? WEAPON_LABELS[boss.weaponType] : "Boss Weapon";

  return (
    <div className="absolute top-6 left-1/2 w-[min(36rem,72vw)] -translate-x-1/2">
      <div className="hud-reveal rounded-sm border border-white/12 bg-[rgba(5,10,18,0.76)] px-5 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-primary/60">
              Boss Encounter
            </div>
            <div className="font-mono text-lg font-bold uppercase tracking-[0.12em] text-white">
              {boss.name}
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-white/45">
              {weaponLabel}
            </div>
            <div className="font-mono text-xs uppercase tracking-[0.16em] text-primary/60">
              Phase {boss.phase}
            </div>
          </div>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-white/8">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-red-600 transition-[width] duration-150"
            style={{ width: `${healthPct}%` }}
          />
        </div>

        <div className="mt-2 flex items-center justify-between gap-3 font-mono text-[0.68rem] uppercase tracking-[0.16em]">
          <span className="text-white/55">
            {boss.telegraph ?? "Tracking"}
          </span>
          <span className="text-white/72">
            {Math.max(0, Math.round(boss.health))}/{boss.maxHealth}
          </span>
        </div>
      </div>
    </div>
  );
}
