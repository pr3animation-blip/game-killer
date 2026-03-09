"use client";

import { Play, Power, Settings2 } from "lucide-react";
import { useGameStore } from "@/state/game-store";

const CONTROLS: [string, string][] = [
  ["WASD", "Move"],
  ["Mouse", "Aim"],
  ["LMB", "Fire"],
  ["RMB", "ADS"],
  ["R", "Reload"],
  ["Shift", "Sprint"],
  ["Ctrl", "Slide"],
  ["Space", "Jump / Dash"],
  ["1-3", "Swap Weapon"],
  ["E", "Interact"],
  ["Esc", "Pause"],
];

interface PauseMenuProps {
  onResume: () => void;
  onSettings: () => void;
  onExit: () => void;
}

export function PauseMenu({ onResume, onSettings, onExit }: PauseMenuProps) {
  const score = useGameStore((s) => s.score);
  const deaths = useGameStore((s) => s.deaths);
  const runTimer = useGameStore((s) => s.runTimer);
  const currentLevel = useGameStore((s) => s.currentLevel);
  const activeClassName = useGameStore((s) => s.activeClassName);

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="menu-overlay-enter absolute inset-0 z-20 flex cursor-default items-center justify-center bg-black/60 px-4">
      <div className="menu-card-enter tac-panel-strong w-full max-w-sm p-8">
        <div className="flex flex-col items-center gap-6">
          <div className="space-y-2 text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.45em] text-primary/50">
              Session Hold
            </p>
            <h2 className="text-3xl font-bold uppercase tracking-[0.3em] text-foreground">
              PAUSED
            </h2>
            <div className="tac-divider mx-auto mt-3 w-24" />
          </div>

          {/* Run Stats */}
          <div className="grid w-full grid-cols-2 gap-x-6 gap-y-1.5">
            {[
              ["Score", score.toLocaleString()],
              ["Deaths", String(deaths)],
              ["Time", formatTime(runTimer)],
              ["Level", currentLevel.name],
              ...(activeClassName ? [["Class", activeClassName]] : []),
            ].map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between">
                <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-primary/40">
                  {label}
                </span>
                <span className="font-mono text-[11px] tabular-nums text-primary/80">
                  {value}
                </span>
              </div>
            ))}
          </div>

          <div className="tac-divider w-full" />

          <div className="flex w-full flex-col gap-2">
            <button
              id="pause-resume-button"
              onClick={onResume}
              className="tac-btn tac-btn-primary flex h-12 w-full items-center justify-between px-5"
            >
              <span className="flex items-center gap-3">
                <Play className="h-4 w-4 fill-current" />
                <span className="font-bold uppercase tracking-[0.3em]">
                  Resume
                </span>
              </span>
              <span className="font-mono text-[9px] uppercase tracking-widest opacity-50">
                Esc
              </span>
            </button>

            <button
              id="pause-settings-button"
              onClick={onSettings}
              className="tac-btn flex h-11 w-full items-center justify-between px-5"
            >
              <span className="flex items-center gap-3">
                <Settings2 className="h-3.5 w-3.5" />
                <span className="text-sm font-semibold uppercase tracking-[0.3em]">
                  Settings
                </span>
              </span>
              <span className="font-mono text-[9px] uppercase tracking-widest opacity-40">
                Tune
              </span>
            </button>

            <button
              id="pause-exit-button"
              onClick={onExit}
              className="tac-btn flex h-11 w-full items-center justify-between px-5"
            >
              <span className="flex items-center gap-3">
                <Power className="h-3.5 w-3.5" />
                <span className="text-sm font-semibold uppercase tracking-[0.3em]">
                  Exit
                </span>
              </span>
              <span className="font-mono text-[9px] uppercase tracking-widest opacity-40">
                Disconnect
              </span>
            </button>
          </div>

          <div className="tac-divider w-full" />

          {/* Controls Reference */}
          <div className="w-full">
            <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.4em] text-primary/40">
              Controls
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-0.5">
              {CONTROLS.map(([key, action]) => (
                <div key={key} className="flex items-baseline justify-between">
                  <span className="font-mono text-[10px] text-primary/60">{key}</span>
                  <span className="font-mono text-[10px] text-primary/35">{action}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
