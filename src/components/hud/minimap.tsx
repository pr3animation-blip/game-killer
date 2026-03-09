"use client";

import { useGameStore } from "@/state/game-store";

const VIEWBOX_SIZE = 100;
const CENTER = VIEWBOX_SIZE / 2;
const RADIUS = 38;

export function Minimap() {
  const radar = useGameStore((state) => state.radar);
  const contacts = radar.contacts;

  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
      <div className="radar-scope relative h-24 w-24 rounded-full opacity-70">
        <div className="radar-sweep absolute inset-[-18%]" />

        <svg
          viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke="rgba(224, 96, 48, 0.2)"
            strokeWidth="0.8"
          />
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS * 0.5}
            fill="none"
            stroke="rgba(224, 96, 48, 0.1)"
            strokeWidth="0.6"
          />
          <path
            d={`M ${CENTER - RADIUS} ${CENTER} H ${CENTER + RADIUS} M ${CENTER} ${CENTER - RADIUS} V ${CENTER + RADIUS}`}
            stroke="rgba(224, 96, 48, 0.08)"
            strokeWidth="0.6"
          />

          {contacts.map((contact) => {
            const x = CENTER + contact.x * (RADIUS - 4);
            const y = CENTER - contact.y * (RADIUS - 4);
            const color = contact.watching
              ? "rgba(248, 113, 113, 0.9)"
              : "rgba(200, 191, 176, 0.85)";

            return (
              <g key={contact.id}>
                {contact.watching ? (
                  <circle
                    cx={x}
                    cy={y}
                    r={4.5}
                    fill="rgba(248, 113, 113, 0.12)"
                    className="animate-ping"
                  />
                ) : null}
                <circle
                  cx={x}
                  cy={y}
                  r={contact.clamped ? 2.4 : 3}
                  fill={color}
                  stroke="rgba(0, 0, 0, 0.6)"
                  strokeWidth="0.8"
                />
              </g>
            );
          })}

          <polygon
            points={`${CENTER},${CENTER - 5} ${CENTER + 4},${CENTER + 4} ${CENTER - 4},${CENTER + 4}`}
            fill="rgba(255, 255, 255, 0.85)"
            stroke="rgba(224, 96, 48, 0.5)"
            strokeWidth="0.8"
          />
        </svg>
      </div>
    </div>
  );
}
