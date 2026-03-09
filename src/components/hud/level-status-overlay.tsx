"use client";

import { Button } from "@/components/ui/button";
import type { GameEngine } from "@/game/engine";
import { useGameStore } from "@/state/game-store";

declare global {
  interface Window {
    __gameEngine?: GameEngine;
  }
}

export function LevelStatusOverlay() {
  const gameState = useGameStore((state) => state.gameState);
  const summary = useGameStore((state) => state.levelCompleteSummary);

  if (
    !summary ||
    (gameState !== "levelComplete" && gameState !== "runComplete" && gameState !== "levelUpChoice")
  ) {
    return null;
  }

  return (
    <div className="menu-overlay-enter pointer-events-none absolute inset-0 flex items-center justify-center bg-background/44">
      <div className="menu-card-enter tac-panel-strong pointer-events-auto w-[min(42rem,94vw)] rounded-sm px-7 py-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="tac-hud-label">
              {summary.runComplete
                ? "Run Complete"
                : gameState === "levelUpChoice"
                  ? "Level Up"
                  : "Level Clear"}
            </span>
            <h2 className="font-mono text-3xl font-bold uppercase tracking-[0.14em] text-primary">
              {summary.levelName}
            </h2>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="tac-chip">{summary.levelTime.toFixed(1)}s</span>
            <span className="tac-chip">
              Medal: {(summary.medal ?? "none").toUpperCase()}
            </span>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-sm border border-primary/14 bg-background/68 px-4 py-3">
            <span className="tac-hud-label">Gain</span>
            <div className="tac-hud-value mt-2 text-2xl font-semibold">
              +{summary.scoreGained}
            </div>
          </div>
          <div className="rounded-sm border border-primary/14 bg-background/68 px-4 py-3">
            <span className="tac-hud-label">Score</span>
            <div className="tac-hud-value mt-2 text-2xl font-semibold">
              {summary.totalScore}
            </div>
          </div>
          <div className="rounded-sm border border-primary/14 bg-background/68 px-4 py-3">
            <span className="tac-hud-label">Run Time</span>
            <div className="tac-hud-value mt-2 text-2xl font-semibold">
              {summary.totalRunTime.toFixed(1)}s
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-sm border border-border/45 bg-background/52 px-4 py-3">
            <span className="tac-hud-label">Banked</span>
            <div className="tac-hud-value mt-2 text-xl font-semibold">
              +{summary.bankedBonus}
            </div>
          </div>
          <div className="rounded-sm border border-border/45 bg-background/52 px-4 py-3">
            <span className="tac-hud-label">Best Combo</span>
            <div className="tac-hud-value mt-2 text-xl font-semibold">
              x{summary.bestCombo.toFixed(0)}
            </div>
          </div>
          <div className="rounded-sm border border-border/45 bg-background/52 px-4 py-3">
            <span className="tac-hud-label">Deaths</span>
            <div className="tac-hud-value mt-2 text-xl font-semibold">
              {summary.deaths}
            </div>
          </div>
          <div className="rounded-sm border border-border/45 bg-background/52 px-4 py-3">
            <span className="tac-hud-label">Missed</span>
            <div className="tac-hud-value mt-2 text-xl font-semibold">
              {summary.missedBonuses}
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-sm border border-primary/14 bg-background/56 px-4 py-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-foreground/58">
              {summary.runComplete
                ? "Operation complete. Chase the next personal best immediately."
                : gameState === "levelUpChoice"
                  ? "Upgrade pending. Choose one boost before the run resumes."
                  : "Momentum banked. Prepare the next chamber route."}
            </p>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary/84">
              {summary.nextTarget}
            </p>
          </div>
        </div>

        {summary.runComplete ? (
          <div className="mt-5 flex justify-end gap-3">
            <Button variant="outline" onClick={() => window.__gameEngine?.restartRun?.()}>
              Restart Run
            </Button>
            <Button onClick={() => window.__gameEngine?.restartRun?.()}>
              Chase PB
            </Button>
          </div>
        ) : gameState === "levelComplete" ? (
          <div className="mt-5 flex justify-end gap-3">
            <Button onClick={() => window.__gameEngine?.continueAfterLevelComplete?.()}>
              Continue
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
