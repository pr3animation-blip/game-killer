"use client";

import { AlertTriangle, DoorOpen, MonitorOff, Undo2 } from "lucide-react";

interface ExitMenuProps {
  mode: "mainMenu" | "pause";
  onBack: () => void;
  onQuitDesktop: () => void;
  onQuitToMenu?: () => void;
}

export function ExitMenu({
  mode,
  onBack,
  onQuitDesktop,
  onQuitToMenu,
}: ExitMenuProps) {
  const isPauseExit = mode === "pause";

  return (
    <div className="menu-overlay-enter absolute inset-0 z-40 flex cursor-default items-center justify-center bg-black/70 px-4">
      <div className="menu-card-enter tac-panel-strong relative w-full max-w-xl overflow-hidden p-0">
        {/* Header */}
        <div className="border-b border-primary/15 px-6 py-5 sm:px-7">
          <div className="flex items-start gap-4">
            <div className="tac-border-danger flex h-10 w-10 items-center justify-center text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="space-y-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.45em] text-primary/40">
                Exit Protocol
              </p>
              <h2 className="text-2xl font-semibold uppercase tracking-[0.15em] text-foreground">
                {isPauseExit ? "LEAVE SESSION" : "EXIT GAME KILLER"}
              </h2>
              <p className="max-w-lg font-mono text-xs leading-6 text-muted-foreground">
                {isPauseExit
                  ? "Return to menu or terminate desktop session."
                  : "Close the application."}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3 px-6 py-6 sm:px-7 sm:py-7">
          {isPauseExit && onQuitToMenu ? (
            <button
              id="exit-menu-button"
              onClick={onQuitToMenu}
              className="tac-btn flex h-14 w-full items-center justify-between px-5 text-left"
            >
              <span className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.25em]">
                <DoorOpen className="h-4 w-4" />
                Quit To Menu
              </span>
              <span className="font-mono text-[9px] uppercase tracking-widest opacity-40">
                End match
              </span>
            </button>
          ) : null}

          <button
            id="exit-desktop-button"
            onClick={onQuitDesktop}
            className="tac-btn tac-btn-danger flex h-14 w-full items-center justify-between px-5 text-left"
          >
            <span className="flex items-center gap-3 text-sm font-bold uppercase tracking-[0.25em]">
              <MonitorOff className="h-4 w-4" />
              Exit Desktop
            </span>
            <span className="font-mono text-[9px] uppercase tracking-widest opacity-50">
              Terminate
            </span>
          </button>

          <button
            id="exit-back-button"
            onClick={onBack}
            className="tac-btn flex h-12 w-full items-center justify-between px-5 text-left"
          >
            <span className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.25em]">
              <Undo2 className="h-4 w-4" />
              {isPauseExit ? "Return To Pause" : "Back To Menu"}
            </span>
            <span className="font-mono text-[9px] uppercase tracking-widest opacity-40">
              Cancel
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
