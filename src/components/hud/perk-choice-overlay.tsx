"use client";

import { Button } from "@/components/ui/button";
import type { GameEngine } from "@/game/engine";
import { useGameStore } from "@/state/game-store";
import { UpgradeIcon } from "./upgrade-icons";
import type { UpgradeId } from "@/game/types";

declare global {
  interface Window {
    __gameEngine?: GameEngine;
  }
}

export function PerkChoiceOverlay() {
  const gameState = useGameStore((state) => state.gameState);
  const levelUpChoice = useGameStore((state) => state.levelUpChoice);
  const pendingLevelUps = useGameStore((state) => state.progression.pendingLevelUps);

  if (gameState !== "levelUpChoice" || !levelUpChoice.active) {
    return null;
  }

  return (
    <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-background/52">
      <div className="menu-card-enter tac-panel-strong w-[min(42rem,94vw)] rounded-sm px-6 py-6">
        <div className="mb-5 flex flex-col gap-2">
          <span className="tac-hud-label">Level Up</span>
          <h2 className="font-mono text-3xl font-bold uppercase tracking-[0.14em] text-primary">
            Choose Your Upgrade
          </h2>
          <p className="text-sm text-foreground/66">
            Combat is paused. Pick one upgrade and get back to the run stronger.
          </p>
          {pendingLevelUps >= 2 && (
            <p className="font-mono text-xs tracking-widest text-primary/70">
              {pendingLevelUps} upgrades pending
            </p>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {levelUpChoice.choices.map((upgrade) => (
            <button
              key={upgrade.id}
              type="button"
              aria-label={`Select ${upgrade.name} upgrade`}
              onClick={() => window.__gameEngine?.chooseUpgrade?.(upgrade.id)}
              className="group rounded-sm border border-border/55 bg-background/48 px-5 py-5 text-left transition-colors hover:border-primary/35 hover:bg-primary/8"
            >
              <div className="flex items-start gap-4">
                <UpgradeIcon
                  upgradeId={upgrade.id as UpgradeId}
                  className="mt-0.5 shrink-0 rounded-sm border border-border/40 bg-primary/8 p-2.5 text-primary transition-colors group-hover:border-primary/30 group-hover:bg-primary/12"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-sm uppercase tracking-[0.18em] text-primary">
                      {upgrade.name}
                    </p>
                    <span className="tac-chip transition-colors group-hover:border-primary/30 group-hover:text-primary">
                      {upgrade.rarity}
                    </span>
                  </div>
                  <p className="mt-2.5 text-sm leading-6 text-foreground/70">
                    {upgrade.description}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-5 flex justify-end">
          <Button
            variant="outline"
            onClick={() => window.__gameEngine?.chooseUpgrade?.(levelUpChoice.choices[0]?.id ?? "")}
          >
            Quick Pick
          </Button>
        </div>
      </div>
    </div>
  );
}
