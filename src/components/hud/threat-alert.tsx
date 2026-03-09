"use client";

import { useGameStore } from "@/state/game-store";

const directionArrow: Record<string, string> = {
  front: "\u2191",
  right: "\u2192",
  behind: "\u2193",
  left: "\u2190",
};

export function ThreatAlert() {
  const threatAlert = useGameStore((state) => state.threatAlert);

  if (!threatAlert.active) return null;

  const isBehind = threatAlert.direction === "behind";

  return (
    <div role="alert" aria-live="assertive" className="threat-enter absolute top-[3.25rem] left-1/2 -translate-x-1/2">
      <div className="hud-ghost flex items-center gap-2">
        <span
          className={`text-lg font-bold ${isBehind ? "text-red-400/90" : "text-white/60"}`}
          style={{
            textShadow: isBehind
              ? "0 0 14px rgba(248,113,113,0.5), 0 1px 4px rgba(0,0,0,0.8)"
              : "0 1px 4px rgba(0,0,0,0.8)",
          }}
        >
          {directionArrow[threatAlert.direction]}
        </span>
        <span
          className={`font-mono text-xs uppercase tracking-[0.2em] ${isBehind ? "text-red-400/80" : "text-white/50"}`}
        >
          {threatAlert.count > 1
            ? `${threatAlert.count} watching`
            : "watched"}
        </span>
        <span className="font-mono text-xs text-white/30">
          {Math.round(threatAlert.distance)}m
        </span>
      </div>
    </div>
  );
}
