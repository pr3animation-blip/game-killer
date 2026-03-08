"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { GameCanvas } from "@/components/game/game-canvas";
import { GameHUD } from "@/components/hud/game-hud";
import { ExitMenu } from "@/components/menu/exit-menu";
import { GameOverScreen } from "@/components/menu/game-over-screen";
import { Leaderboard } from "@/components/menu/leaderboard";
import { MainMenu } from "@/components/menu/main-menu";
import { PauseMenu } from "@/components/menu/pause-menu";
import { SettingsMenu, SettingsValues } from "@/components/menu/settings-menu";
import { useGameStore } from "@/state/game-store";
import { GameEngine } from "@/game/engine";

type Screen = "mainMenu" | "game" | "settings";
type ExitContext = "mainMenu" | "pause";
type ElectronAPI = {
  quitApp?: () => void;
};

export default function Home() {
  const [screen, setScreen] = useState<Screen>("mainMenu");
  const [showSettings, setShowSettings] = useState(false);
  const [exitContext, setExitContext] = useState<ExitContext | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const gameState = useGameStore((s) => s.gameState);
  const engineRef = useRef<GameEngine | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const autostartedRef = useRef(false);

  const handlePlay = (lockPointer = true) => {
    setShowSettings(false);
    setExitContext(null);
    setShowLeaderboard(false);
    useGameStore.getState().reset();
    useGameStore.setState({ gameState: "playing" });
    // Request pointer lock within the user gesture (click) context
    // before React re-renders — the canvas is always mounted
    if (lockPointer) {
      canvasRef.current?.requestPointerLock();
    }
    setScreen("game");
  };

  useEffect(() => {
    if (autostartedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("autostart") !== "1") return;

    const frameId = window.requestAnimationFrame(() => {
      autostartedRef.current = true;
      handlePlay(false);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  const handleEngineReady = useCallback((engine: GameEngine) => {
    engineRef.current = engine;
  }, []);

  const handleResume = () => {
    setExitContext(null);
    // Lock pointer within the click gesture context
    canvasRef.current?.requestPointerLock();
    engineRef.current?.resume();
  };

  const handleQuitToMenu = () => {
    engineRef.current?.dispose();
    engineRef.current = null;
    useGameStore.getState().reset();
    useGameStore.setState({ gameState: "menu" });
    setShowSettings(false);
    setExitContext(null);
    setScreen("mainMenu");
  };

  const handleApplySettings = (settings: SettingsValues) => {
    engineRef.current?.updateSettings(settings);
  };

  const handleOpenSettings = () => {
    setExitContext(null);
    setShowSettings(true);
  };

  const handleOpenExit = (context: ExitContext) => {
    setShowSettings(false);
    setExitContext(context);
  };

  const handleQuitDesktop = () => {
    if (typeof window !== "undefined") {
      const electronAPI = (window as Window & { electronAPI?: ElectronAPI })
        .electronAPI;

      if (electronAPI?.quitApp) {
        electronAPI.quitApp();
        return;
      }

      window.close();
    }
  };

  const isGame = screen === "game";

  return (
    <div className="game-shell">
      {/* Canvas is always mounted so pointer lock can be requested in click handlers */}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 w-full h-full block z-0 ${isGame ? "cursor-none" : "pointer-events-none"}`}
      />
      <GameCanvas canvasRef={canvasRef} onEngineReady={handleEngineReady} active={isGame} />

      {/* Main Menu */}
      {screen === "mainMenu" && (
        <MainMenu
          onPlay={handlePlay}
          onSettings={handleOpenSettings}
          onExit={() => handleOpenExit("mainMenu")}
          onLeaderboard={() => setShowLeaderboard(true)}
        />
      )}

      {showLeaderboard && (
        <Leaderboard onBack={() => setShowLeaderboard(false)} />
      )}

      {/* Game Screen */}
      {isGame && (
        <>
          <GameHUD />

          {/* Pause overlay */}
          {gameState === "paused" && !showSettings && (
            <PauseMenu
              onResume={handleResume}
              onSettings={handleOpenSettings}
              onExit={() => handleOpenExit("pause")}
            />
          )}

          {gameState === "gameover" && (
            <GameOverScreen onReturnToMenu={handleQuitToMenu} />
          )}
        </>
      )}

      {/* Settings overlay (shown over both main menu and pause) */}
      {showSettings && (
        <SettingsMenu
          onBack={() => setShowSettings(false)}
          onApply={handleApplySettings}
        />
      )}

      {exitContext && (
        <ExitMenu
          mode={exitContext}
          onBack={() => setExitContext(null)}
          onQuitDesktop={handleQuitDesktop}
          onQuitToMenu={
            exitContext === "pause" ? handleQuitToMenu : undefined
          }
        />
      )}
    </div>
  );
}
