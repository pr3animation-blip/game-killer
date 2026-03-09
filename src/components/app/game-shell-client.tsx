"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { MainMenu } from "@/components/menu/main-menu";
import type { GameEngineHandle } from "@/components/game/game-canvas";
import type { SettingsValues } from "@/components/menu/settings-menu";
import type { ClassPresetId } from "@/game/classes";
import { useGameStore } from "@/state/game-store";
import { preloadClassSelect, preloadGameCanvas } from "./game-shell-loaders";

const DynamicClassSelect = dynamic(
  () => import("@/components/menu/class-select").then((mod) => mod.ClassSelect)
);
const DynamicExitMenu = dynamic(
  () => import("@/components/menu/exit-menu").then((mod) => mod.ExitMenu)
);
const DynamicGameCanvas = dynamic(
  () => import("@/components/game/game-canvas").then((mod) => mod.GameCanvas),
  { ssr: false }
);
const DynamicGameHUD = dynamic(
  () => import("@/components/hud/game-hud").then((mod) => mod.GameHUD)
);
const DynamicGameOverScreen = dynamic(
  () => import("@/components/menu/game-over-screen").then((mod) => mod.GameOverScreen)
);
const DynamicLeaderboard = dynamic(
  () => import("@/components/menu/leaderboard").then((mod) => mod.Leaderboard)
);
const DynamicPauseMenu = dynamic(
  () => import("@/components/menu/pause-menu").then((mod) => mod.PauseMenu)
);
const DynamicSettingsMenu = dynamic(
  () => import("@/components/menu/settings-menu").then((mod) => mod.SettingsMenu)
);

const AUTOSTART_CLASS_ID: ClassPresetId = "recruit";

type Screen = "mainMenu" | "classSelect" | "game";
type ExitContext = "mainMenu" | "pause";
type ElectronAPI = {
  quitApp?: () => void;
};

export function GameShellClient() {
  const [screen, setScreen] = useState<Screen>("mainMenu");
  const [showSettings, setShowSettings] = useState(false);
  const [exitContext, setExitContext] = useState<ExitContext | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<ClassPresetId | null>(null);
  const gameState = useGameStore((state) => state.gameState);
  const engineRef = useRef<GameEngineHandle | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const autostartedRef = useRef(false);

  const handleEngineReady = useCallback((engine: GameEngineHandle | null) => {
    engineRef.current = engine;
  }, []);

  const handlePlayIntent = useCallback(() => {
    void preloadClassSelect();
  }, []);

  const handleDeployIntent = useCallback(() => {
    void preloadGameCanvas();
  }, []);

  const handlePlay = useCallback(() => {
    handlePlayIntent();
    setShowSettings(false);
    setExitContext(null);
    setShowLeaderboard(false);
    setScreen("classSelect");
  }, [handlePlayIntent]);

  const handleClassSelected = useCallback(
    (presetId: ClassPresetId, lockPointer = true) => {
      handleDeployIntent();
      useGameStore.getState().reset();
      useGameStore.setState({ gameState: "playing", activeClassName: null });
      setSelectedClassId(presetId);
      if (lockPointer) {
        canvasRef.current?.requestPointerLock();
      }
      setScreen("game");
    },
    [handleDeployIntent]
  );

  useEffect(() => {
    if (autostartedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("autostart") !== "1") return;

    const frameId = window.requestAnimationFrame(() => {
      autostartedRef.current = true;
      handleClassSelected(AUTOSTART_CLASS_ID, false);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [handleClassSelected]);

  const handleResume = useCallback(() => {
    setExitContext(null);
    canvasRef.current?.requestPointerLock();
    engineRef.current?.resume();
  }, []);

  const handleRetry = useCallback(() => {
    engineRef.current?.restartRun();
    canvasRef.current?.requestPointerLock();
  }, []);

  const handleQuitToMenu = useCallback(() => {
    engineRef.current?.dispose();
    engineRef.current = null;
    useGameStore.getState().reset();
    useGameStore.setState({ gameState: "menu" });
    setSelectedClassId(null);
    setShowSettings(false);
    setExitContext(null);
    setShowLeaderboard(false);
    setScreen("mainMenu");
  }, []);

  const handleApplySettings = useCallback((settings: SettingsValues) => {
    engineRef.current?.updateSettings(settings);
  }, []);

  const handleOpenSettings = useCallback(() => {
    setExitContext(null);
    setShowSettings(true);
  }, []);

  const handleOpenExit = useCallback((context: ExitContext) => {
    setShowSettings(false);
    setExitContext(context);
  }, []);

  const handleQuitDesktop = useCallback(() => {
    const electronAPI = (window as Window & { electronAPI?: ElectronAPI }).electronAPI;

    if (electronAPI?.quitApp) {
      electronAPI.quitApp();
      return;
    }

    window.close();
  }, []);

  const isGame = screen === "game";

  return (
    <div className="game-shell">
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 z-0 block h-full w-full ${
          isGame && gameState === "playing" ? "cursor-none" : "pointer-events-none"
        }`}
      />

      {isGame && selectedClassId ? (
        <DynamicGameCanvas
          canvasRef={canvasRef}
          onEngineReady={handleEngineReady}
          active={isGame}
          classPresetId={selectedClassId}
        />
      ) : null}

      {screen === "mainMenu" ? (
        <MainMenu
          onPlay={handlePlay}
          onSettings={handleOpenSettings}
          onExit={() => handleOpenExit("mainMenu")}
          onLeaderboard={() => setShowLeaderboard(true)}
          onIntentToPlay={handlePlayIntent}
        />
      ) : null}

      {showLeaderboard ? (
        <DynamicLeaderboard onBack={() => setShowLeaderboard(false)} />
      ) : null}

      {screen === "classSelect" ? (
        <DynamicClassSelect
          onSelect={handleClassSelected}
          onBack={() => setScreen("mainMenu")}
          onIntentToDeploy={handleDeployIntent}
        />
      ) : null}

      {isGame ? (
        <>
          <DynamicGameHUD />

          {gameState === "paused" && !showSettings ? (
            <DynamicPauseMenu
              onResume={handleResume}
              onSettings={handleOpenSettings}
              onExit={() => handleOpenExit("pause")}
            />
          ) : null}

          {gameState === "gameover" ? (
            <DynamicGameOverScreen onReturnToMenu={handleQuitToMenu} onRetry={handleRetry} />
          ) : null}
        </>
      ) : null}

      {showSettings ? (
        <DynamicSettingsMenu
          onBack={() => setShowSettings(false)}
          onApply={handleApplySettings}
        />
      ) : null}

      {exitContext ? (
        <DynamicExitMenu
          mode={exitContext}
          onBack={() => setExitContext(null)}
          onQuitDesktop={handleQuitDesktop}
          onQuitToMenu={exitContext === "pause" ? handleQuitToMenu : undefined}
        />
      ) : null}
    </div>
  );
}
