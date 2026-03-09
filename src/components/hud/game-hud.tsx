"use client";

import { Crosshair } from "./crosshair";
import { HealthBar } from "./health-bar";
import { AmmoCounter } from "./ammo-counter";
import { KillFeed } from "./kill-feed";
import { ScoreBoard } from "./score-board";
import { ThreatAlert } from "./threat-alert";
import { Minimap } from "./minimap";
import { ObjectivePanel } from "./objective-panel";
import { AbilityStatus } from "./ability-status";
import { LevelStatusOverlay } from "./level-status-overlay";
import { PickupPrompt } from "./pickup-prompt";
import { ArcadeStatus } from "./arcade-status";
import { PerkChoiceOverlay } from "./perk-choice-overlay";
import { BossBar } from "./boss-bar";
import { BossIntroBanner } from "./boss-intro-banner";
import { LevelTransitionOverlay } from "./level-transition-overlay";
import { ReloadIndicator } from "./reload-indicator";
import { useGameStore } from "@/state/game-store";

export function GameHUD() {
  const gameState = useGameStore((s) => s.gameState);
  const isAlive = useGameStore((s) => s.health > 0);
  const damageFlash = useGameStore((s) => s.damageFlash);

  if (!["playing", "dying", "levelUpChoice", "levelComplete", "levelTransition", "runComplete"].includes(gameState)) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <Crosshair />
      <HealthBar />
      <AmmoCounter />
      <KillFeed />
      <ScoreBoard />
      <ThreatAlert />
      <ObjectivePanel />
      <BossBar />
      <BossIntroBanner />
      <AbilityStatus />
      <Minimap />
      <PickupPrompt />
      <ArcadeStatus />
      <ReloadIndicator />
      <LevelStatusOverlay />
      <PerkChoiceOverlay />

      {/* Damage vignette */}
      {damageFlash > 0 && (
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 40%, rgba(180, 20, 20, 0.6) 100%)",
            opacity: damageFlash,
            transition: "opacity 80ms ease-out",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Death vignette + overlay during dying sequence */}
      {gameState === "dying" && (
        <>
          <div className="death-vignette absolute inset-0" />
          <div className="menu-overlay-enter absolute inset-0 flex items-center justify-center">
            <div className="death-overlay-enter text-center">
              <h2
                className="font-mono text-3xl font-bold uppercase tracking-[0.2em] text-red-500/80"
                style={{
                  textShadow:
                    "0 0 40px rgba(248,113,113,0.4), 0 2px 8px rgba(0,0,0,0.9)",
                }}
              >
                Eliminated
              </h2>
            </div>
          </div>
        </>
      )}

      {/* Level transition overlay */}
      {gameState === "levelTransition" && <LevelTransitionOverlay />}
    </div>
  );
}
