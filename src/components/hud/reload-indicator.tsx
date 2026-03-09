"use client";

import { useGameStore } from "@/state/game-store";

const RING_SIZE = 72;
const STROKE_WIDTH = 2.5;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ReloadIndicator() {
  const inventory = useGameStore((s) => s.inventory);

  if (!inventory.isReloading) return null;

  const progress = Math.max(0, Math.min(1, inventory.reloadProgress));
  const remaining = Math.max(
    0,
    inventory.reloadDuration * (1 - progress)
  );
  const dashOffset = CIRCUMFERENCE * (1 - progress);

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      {/* Outer ring container — offset slightly below crosshair */}
      <div
        className="relative"
        style={{
          width: RING_SIZE,
          height: RING_SIZE,
          marginTop: 48,
        }}
      >
        {/* Track ring (dim background) */}
        <svg
          className="absolute inset-0"
          width={RING_SIZE}
          height={RING_SIZE}
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        >
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="rgba(200, 191, 176, 0.08)"
            strokeWidth={STROKE_WIDTH}
          />
        </svg>

        {/* Progress ring */}
        <svg
          className="absolute inset-0"
          width={RING_SIZE}
          height={RING_SIZE}
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          style={{ transform: "rotate(-90deg)" }}
        >
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="rgba(224, 96, 48, 0.7)"
            strokeWidth={STROKE_WIDTH}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{
              filter: "drop-shadow(0 0 4px rgba(224, 96, 48, 0.4))",
            }}
          />
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-mono text-[0.55rem] font-semibold uppercase tracking-[0.22em]"
            style={{
              color: "rgba(224, 96, 48, 0.55)",
              textShadow: "0 1px 3px rgba(0,0,0,0.7)",
            }}
          >
            RLD
          </span>
          <span
            className="font-mono text-sm tabular-nums leading-none"
            style={{
              color: "rgba(200, 191, 176, 0.85)",
              textShadow:
                "0 0 8px rgba(224, 96, 48, 0.25), 0 1px 3px rgba(0,0,0,0.7)",
            }}
          >
            {remaining.toFixed(1)}
          </span>
        </div>
      </div>
    </div>
  );
}
