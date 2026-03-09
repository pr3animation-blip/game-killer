"use client";

import { useGameStore } from "@/state/game-store";

export function ArcadeStatus() {
  const combo = useGameStore((state) => state.combo);
  const scoreEvents = useGameStore((state) => state.scoreEvents);
  const activeUpgrades = useGameStore((state) => state.activeUpgrades);

  const showCombo = combo.multiplier > 1;

  return (
    <>
      {/* Combo multiplier — bottom-left, above health */}
      {showCombo ? (
        <div className="hud-ghost absolute bottom-[3.75rem] left-8 flex items-baseline gap-2">
          <span
            className="hud-ghost-value text-lg font-bold text-amber-300/80"
            style={{
              textShadow:
                "0 0 16px rgba(251,191,36,0.3), 0 1px 4px rgba(0,0,0,0.8)",
            }}
          >
            x<span className="tabular-nums">{combo.multiplier.toFixed(0)}</span>
          </span>
          <div className="h-[2px] w-16 overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full bg-amber-300/50 transition-[width] duration-150"
              style={{
                width: `${Math.max(0, Math.min(100, (combo.timer / Math.max(0.001, combo.maxTimer)) * 100))}%`,
              }}
            />
          </div>
        </div>
      ) : null}

      {/* Score events — right edge, brief popups */}
      {scoreEvents.length > 0 ? (
        <div className="absolute right-8 bottom-[4.5rem] flex flex-col items-end gap-0.5">
          {scoreEvents.slice(0, 3).map((event) => (
            <div
              key={event.id}
              className="hud-ghost font-mono text-xs animate-in fade-in slide-in-from-right duration-150"
            >
              <span className="text-white/40">{event.label}</span>
              {event.amount > 0 ? (
                <span className="ml-1.5 text-white/60">+{event.amount}</span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {/* Active upgrades — tiny indicators bottom-left corner */}
      {activeUpgrades.length > 0 ? (
        <div className="absolute bottom-[5.75rem] left-8 flex flex-wrap gap-x-2 gap-y-1 max-w-48">
          {activeUpgrades.map((upgrade) => (
            <span
              key={upgrade.id}
              className="hud-ghost-label text-[0.55rem] text-white/25"
            >
              {upgrade.name}
            </span>
          ))}
        </div>
      ) : null}
    </>
  );
}
