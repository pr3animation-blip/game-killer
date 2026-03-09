"use client";

import { useGameStore } from "@/state/game-store";

export function ObjectivePanel() {
  const objective = useGameStore((state) => state.objective);

  if (!objective.text) return null;

  const progressMatch = objective.progress.match(/^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
  const completed = progressMatch ? Number(progressMatch[1]) : 0;
  const total = progressMatch ? Number(progressMatch[2]) : 0;
  const isTimerProgress =
    Boolean(progressMatch) && (!Number.isInteger(completed) || !Number.isInteger(total));
  const phaseLabel =
    objective.phase === "boss"
      ? "BOSS"
      : objective.phase === "extract"
        ? "EXTRACT"
        : "OBJECTIVE";

  return (
    <div className="absolute top-6 right-8">
      <div
        className="hud-reveal flex flex-col items-end gap-1.5 rounded-md border border-white/10 bg-[rgba(4,10,22,0.6)] px-4 py-3 backdrop-blur-sm"
        style={{ animationDelay: "140ms" }}
      >
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[0.6rem] font-bold uppercase tracking-[0.18em] text-primary/80">
            {phaseLabel}
          </span>
          <span className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-white/55">
            {objective.title}
          </span>
        </div>

        <div className="max-w-[20rem] min-h-[2.5rem] text-right">
          <p className="font-mono text-sm font-semibold uppercase tracking-[0.12em] text-white/84">
            {objective.text}
          </p>
          {objective.detail ? (
            <p className="mt-1 font-mono text-[0.68rem] leading-5 tracking-[0.08em] text-foreground/50">
              {objective.detail}
            </p>
          ) : null}
          {objective.interactPrompt ? (
            <p className="mt-2 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-emerald-300/80">
              {objective.interactPrompt}
            </p>
          ) : null}
          {objective.opportunityHint ? (
            <p className="mt-2 font-mono text-[0.64rem] leading-5 tracking-[0.08em] text-amber-200/72">
              Route: {objective.opportunityHint}
            </p>
          ) : null}
        </div>

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
                className="h-full rounded-full bg-primary/60 transition-[width] duration-200"
                style={{
                  width: `${Math.min(100, (completed / total) * 100)}%`,
                }}
              />
            </div>
            <span className="font-mono text-[0.68rem] tabular-nums tracking-[0.12em] text-white/62">
              {completed.toFixed(1)}/{total.toFixed(1)}
            </span>
          </div>
        ) : total > 0 && objective.phase !== "boss" ? (
          <div className="flex items-center gap-1.5">
            {Array.from({ length: total }, (_, i) => (
              <span
                key={i}
                className={`inline-block h-2 w-2 rounded-full ${
                  i < completed
                    ? "bg-primary/80"
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
