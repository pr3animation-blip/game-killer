"use client";

import { useGameStore } from "@/state/game-store";

export function Crosshair() {
  const showHitMarker = useGameStore((state) => state.showHitMarker);
  const isHeadshotHit = useGameStore((state) => state.isHeadshotHit);
  const inventory = useGameStore((state) => state.inventory);
  const isADS = inventory.isADS;
  const baseColor = isADS ? "#f0f8ff" : "#c8bfb0";
  const hitColor = isHeadshotHit ? "#fbbf24" : "#f87171";
  const color = showHitMarker ? hitColor : baseColor;
  const gap = 4 + inventory.reticleSpread * 10;
  const charge = Math.max(0, Math.min(1, inventory.chargeRatio));

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      {/* Scope vignette overlay for sniper ADS */}
      {inventory.fireMode === "semi" && isADS && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: "radial-gradient(circle at center, transparent 28%, rgba(0,0,0,0.6) 52%, rgba(0,0,0,0.92) 70%)",
          }}
        />
      )}
      <svg
        aria-hidden="true"
        width="64"
        height="64"
        viewBox="0 0 64 64"
        className={`${isADS ? "drop-shadow-[0_0_8px_rgba(240,248,255,0.6)]" : "drop-shadow-[0_0_8px_rgba(200,191,176,0.4)]"} ${
          showHitMarker ? "hit-marker-pop" : ""
        } transition-[filter] duration-200`}
      >
        {inventory.fireMode === "semi" && isADS ? (
          <>
            {/* Scope reticle — thin cross with mil-dots */}
            <circle cx="32" cy="32" r="1.2" fill={color} />
            <circle
              cx="32"
              cy="32"
              r="18"
              stroke={color}
              strokeOpacity="0.3"
              strokeWidth="1"
              fill="none"
            />
            {/* Vertical line */}
            <line x1="32" y1="4" x2="32" y2="28" stroke={color} strokeOpacity="0.6" strokeWidth="0.8" />
            <line x1="32" y1="36" x2="32" y2="60" stroke={color} strokeOpacity="0.6" strokeWidth="0.8" />
            {/* Horizontal line */}
            <line x1="4" y1="32" x2="28" y2="32" stroke={color} strokeOpacity="0.6" strokeWidth="0.8" />
            <line x1="36" y1="32" x2="60" y2="32" stroke={color} strokeOpacity="0.6" strokeWidth="0.8" />
            {/* Mil-dots */}
            <circle cx="32" cy="22" r="0.8" fill={color} fillOpacity="0.5" />
            <circle cx="32" cy="42" r="0.8" fill={color} fillOpacity="0.5" />
            <circle cx="22" cy="32" r="0.8" fill={color} fillOpacity="0.5" />
            <circle cx="42" cy="32" r="0.8" fill={color} fillOpacity="0.5" />
          </>
        ) : inventory.fireMode === "semi" ? (
          <>
            {/* Hip fire sniper — simple dot */}
            <circle cx="32" cy="32" r="2" fill={color} />
          </>
        ) : isADS && inventory.fireMode !== "charge" ? (
          <>
            <circle cx="32" cy="32" r="1.8" fill={color} />
            <circle
              cx="32"
              cy="32"
              r="6"
              stroke={color}
              strokeOpacity="0.5"
              strokeWidth="1.2"
              fill="none"
            />
            <line x1="32" y1="24" x2="32" y2="28" stroke={color} strokeOpacity="0.4" strokeWidth="1" />
            <line x1="32" y1="36" x2="32" y2="40" stroke={color} strokeOpacity="0.4" strokeWidth="1" />
            <line x1="24" y1="32" x2="28" y2="32" stroke={color} strokeOpacity="0.4" strokeWidth="1" />
            <line x1="36" y1="32" x2="40" y2="32" stroke={color} strokeOpacity="0.4" strokeWidth="1" />
          </>
        ) : inventory.fireMode === "charge" ? (
          <>
            <circle
              cx="32"
              cy="32"
              r="12"
              stroke={color}
              strokeOpacity="0.24"
              strokeWidth="2"
              fill="none"
            />
            <circle
              cx="32"
              cy="32"
              r="12"
              stroke={color}
              strokeWidth="2.6"
              strokeLinecap="round"
              fill="none"
              pathLength={100}
              strokeDasharray={`${Math.max(8, charge * 100)} 100`}
              transform="rotate(-90 32 32)"
            />
            <circle cx="32" cy="32" r="2" fill={color} />
          </>
        ) : (
          <>
            <line x1="32" y1={14 - gap} x2="32" y2={22 - gap * 0.5} stroke={color} strokeWidth={inventory.fireMode === "projectile" ? "3" : "2"} />
            <line x1="32" y1={50 + gap * 0.5} x2="32" y2={42 + gap} stroke={color} strokeWidth={inventory.fireMode === "projectile" ? "3" : "2"} />
            <line x1={14 - gap} y1="32" x2={22 - gap * 0.5} y2="32" stroke={color} strokeWidth={inventory.fireMode === "projectile" ? "3" : "2"} />
            <line x1={50 + gap * 0.5} y1="32" x2={42 + gap} y2="32" stroke={color} strokeWidth={inventory.fireMode === "projectile" ? "3" : "2"} />
            <circle
              cx="32"
              cy="32"
              r={inventory.fireMode === "projectile" ? "2.5" : "1.5"}
              fill={color}
            />
            {(inventory.fireMode === "auto" || inventory.fireMode === "burst") && (
              <circle
                cx="32"
                cy="32"
                r={inventory.fireMode === "burst" ? "10" : "8"}
                stroke={color}
                strokeOpacity="0.18"
                strokeWidth="1.5"
                fill="none"
              />
            )}
            {inventory.fireMode === "scatter" && (
              <circle
                cx="32"
                cy="32"
                r="15"
                stroke={color}
                strokeOpacity="0.22"
                strokeWidth="2"
                fill="none"
              />
            )}
          </>
        )}

        {showHitMarker && (
          <>
            <line x1="20" y1="20" x2="26" y2="26" stroke={hitColor} strokeWidth={isHeadshotHit ? "3" : "2"} />
            <line x1="44" y1="20" x2="38" y2="26" stroke={hitColor} strokeWidth={isHeadshotHit ? "3" : "2"} />
            <line x1="20" y1="44" x2="26" y2="38" stroke={hitColor} strokeWidth={isHeadshotHit ? "3" : "2"} />
            <line x1="44" y1="44" x2="38" y2="38" stroke={hitColor} strokeWidth={isHeadshotHit ? "3" : "2"} />
          </>
        )}
      </svg>
    </div>
  );
}
