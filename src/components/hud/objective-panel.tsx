"use client";

import { useGameStore } from "@/state/game-store";

export function ObjectivePanel() {
  const objective = useGameStore((state) => state.objective);

  if (!objective.text) return null;

  // Parse progress "N/M" into completed/total for dot rendering
  const progressMatch = objective.progress.match(/^(\d+)\/(\d+)/);
  const completed = progressMatch ? parseInt(progressMatch[1], 10) : 0;
  const total = progressMatch ? parseInt(progressMatch[2], 10) : 0;

  // For hold-zone with timer progress like "2.4/5.0", show as time bar instead of dots
  const isTimerProgress = objective.progress.includes(".");

  const displayText = objective.interactPrompt ?? objective.text;

  return (
    <div className="absolute top-6 right-8">
      <div
        className="hud-reveal flex flex-col items-end gap-1.5 rounded-md border border-white/10 bg-[rgba(4,10,22,0.6)] px-4 py-3 backdrop-blur-sm"
        style={{ animationDelay: "140ms" }}
      >
        {/* Action directive */}
        <span className="font-mono text-sm font-semibold uppercase tracking-[0.12em] text-white/80">
          {displayText}
        </span>

        {/* Progress — dots or timer bar */}
        {objective.escapeTimer !== null ? (
          <span
            className="font-mono text-lg font-bold tabular-nums text-red-400/90"
            style={{
              textShadow:
                "0 0 14px rgba(248,113,113,0.5), 0 1px 4px rgba(0,0,0,0.8)",
            }}
          >
            {objective.escapeTimer.toFixed(1)}s
          </span>
        ) : isTimerProgress && total > 0 ? (
          <div className="flex items-center gap-2">
            <div className="h-[3px] w-20 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-sky-400/60 transition-[width] duration-200"
                style={{
                  width: `${Math.min(100, (completed / total) * 100)}%`,
                }}
              />
            </div>
          </div>
        ) : total > 0 ? (
          <div className="flex items-center gap-1.5">
            {Array.from({ length: total }, (_, i) => (
              <span
                key={i}
                className={`inline-block h-2 w-2 rounded-full ${
                  i < completed
                    ? "bg-sky-400/80 shadow-[0_0_6px_rgba(56,189,248,0.4)]"
                    : "bg-white/15"
                }`}
              />
            ))}
          </div>
        ) : null}

        {/* Extraction ready badge */}
        {objective.extractionUnlocked && objective.escapeTimer === null ? (
          <span className="font-mono text-xs uppercase tracking-[0.12em] text-emerald-400/70">
            Extract ready
          </span>
        ) : null}
      </div>
    </div>
  );
}
