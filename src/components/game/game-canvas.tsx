"use client";

import { useEffect, useRef, type RefObject } from "react";
import { GameEngine } from "@/game/engine";
import { useGameStore } from "@/state/game-store";

interface GameCanvasProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  onEngineReady: (engine: GameEngine) => void;
  active: boolean;
}

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => void;
    __gameEngine?: GameEngine;
  }
}

export function GameCanvas({ canvasRef, onEngineReady, active }: GameCanvasProps) {
  const engineRef = useRef<GameEngine | null>(null);

  useEffect(() => {
    if (!active || !canvasRef.current || engineRef.current) return;

    const engine = new GameEngine(canvasRef.current);
    engineRef.current = engine;

    // Bridge engine events to Zustand store
    engine.on("healthChanged", (health) => {
      useGameStore.setState({ health });
    });
    engine.on("ammoChanged", (current, reserve) => {
      useGameStore.setState({ ammo: current, reserveAmmo: reserve });
    });
    engine.on("inventoryChanged", (inventory) => {
      useGameStore.getState().setInventory(inventory);
    });
    engine.on("pickupPromptChanged", (pickupPrompt) => {
      useGameStore.getState().setPickupPrompt(pickupPrompt);
    });
    engine.on("scoreChanged", (score) => {
      useGameStore.setState({ score });
    });
    engine.on("deathsChanged", (deaths) => {
      useGameStore.setState({ deaths });
    });
    engine.on("kill", (entry) => {
      useGameStore.getState().addKill(entry);
    });
    engine.on("playerDied", () => {
      // State already updated via healthChanged
    });
    engine.on("gameOver", (stats) => {
      useGameStore.getState().setGameOverStats(stats);
      useGameStore.getState().saveToLeaderboard(stats);
    });
    engine.on("gameStateChanged", (state) => {
      useGameStore.setState({ gameState: state });
    });
    engine.on("fpsUpdate", (fps) => {
      useGameStore.setState({ fps });
    });
    engine.on("hit", () => {
      useGameStore.getState().flashHitMarker();
    });
    engine.on("reloading", (isReloading) => {
      useGameStore.setState({ isReloading });
    });
    engine.on("threatChanged", (threatAlert) => {
      useGameStore.setState({ threatAlert });
    });
    engine.on("radarChanged", (radar) => {
      useGameStore.setState({ radar });
    });
    engine.on("movementChanged", ({ state, dashCooldown }) => {
      useGameStore.setState({ movementState: state, dashCooldown });
    });
    engine.on("objectiveChanged", (objective) => {
      useGameStore.setState({
        objective,
        objectiveText: objective.text,
        objectiveProgress: objective.progress,
        escapeTimer: objective.escapeTimer,
      });
    });
    engine.on("levelChanged", (currentLevel) => {
      useGameStore.setState({ currentLevel });
    });
    engine.on("runTimerChanged", ({ runTime, levelTime, escapeTimer }) => {
      useGameStore.setState({ runTimer: runTime, levelTimer: levelTime, escapeTimer });
    });
    engine.on("levelComplete", (levelCompleteSummary) => {
      useGameStore.setState({ levelCompleteSummary });
    });
    engine.on("comboChanged", (combo) => {
      useGameStore.setState({ combo });
    });
    engine.on("scoreEventsChanged", (scoreEvents) => {
      useGameStore.setState({ scoreEvents });
    });
    engine.on("mutatorChanged", (activeMutator) => {
      useGameStore.setState({ activeMutator });
    });
    engine.on("upgradesChanged", (activeUpgrades) => {
      useGameStore.setState({ activeUpgrades });
    });
    engine.on("progressionChanged", (progression) => {
      useGameStore.setState({ progression });
    });
    engine.on("levelUpChoiceChanged", (levelUpChoice) => {
      useGameStore.setState({ levelUpChoice });
    });
    engine.on("runtimeModifiersChanged", (runtimeModifiers) => {
      useGameStore.setState({ runtimeModifiers });
    });
    engine.on("balanceChanged", (balance) => {
      useGameStore.setState({ balance });
    });
    engine.on("opportunityChanged", (opportunity) => {
      useGameStore.setState({ opportunity });
    });
    engine.on("medalPaceChanged", (medalPace) => {
      useGameStore.setState({ medalPace });
    });
    engine.on("personalBestChanged", (personalBest) => {
      useGameStore.setState({ personalBest });
    });

    window.__gameEngine = engine;
    window.render_game_to_text = () => engine.renderGameToText();
    window.advanceTime = (ms: number) => engine.advanceTime(ms);

    engine.start();
    onEngineReady(engine);

    return () => {
      engine.dispose();
      engineRef.current = null;
      if (window.__gameEngine === engine) {
        delete window.__gameEngine;
        delete window.render_game_to_text;
        delete window.advanceTime;
      }
    };
  }, [active, canvasRef, onEngineReady]);

  return null;
}
