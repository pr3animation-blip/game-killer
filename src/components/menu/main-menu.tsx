"use client";

import { useEffect, useState } from "react";
import {
  Power,
  Settings2,
  Trophy,
  Zap,
} from "lucide-react";
import { MenuBackground } from "@/components/menu/menu-background";

interface MainMenuProps {
  onPlay: () => void;
  onSettings: () => void;
  onExit: () => void;
  onLeaderboard: () => void;
}

export function MainMenu({ onPlay, onSettings, onExit, onLeaderboard }: MainMenuProps) {
  const [time, setTime] = useState("");

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="menu-cinematic-shell absolute inset-0 z-30 overflow-hidden">
      <MenuBackground />

      {/* Scanline overlay */}
      <div className="cyber-scanlines" />

      {/* ── CONTENT LAYER ── */}
      <div className="relative z-10 flex h-full flex-col justify-between p-6 sm:p-8 lg:p-10">

        {/* ── TOP BAR ── */}
        <header className="flex items-start justify-between">
          {/* Logo mark — top left */}
          <div
            className="cyber-slide-in flex items-center gap-3"
            style={{ animationDelay: "100ms" }}
          >
            <div className="cyber-dot" />
            <span
              className="font-mono text-[10px] uppercase tracking-[0.5em] text-primary/60"
            >
              GK-SYS
            </span>
          </div>

          {/* Status — top right */}
          <div
            className="cyber-slide-in-right flex items-center gap-4"
            style={{ animationDelay: "150ms" }}
          >
            <span className="font-mono text-[10px] tabular-nums tracking-[0.3em] text-primary/40">
              {time}
            </span>
            <span className="hud-chip">v0.1.0</span>
          </div>
        </header>

        {/* ── CENTER — intentionally empty to show 3D scene ── */}
        <div className="flex-1" />

        {/* ── BOTTOM ACTION BAR ── */}
        <footer className="flex items-end justify-between gap-4">
          {/* Left actions */}
          <div className="flex flex-col gap-2">
            <button
              id="menu-settings-button"
              onClick={onSettings}
              className="cyber-btn cyber-slide-in flex h-10 items-center gap-3 px-5"
              style={{ animationDelay: "300ms" }}
              aria-label="Open settings"
            >
              <Settings2 className="h-3.5 w-3.5" />
              <span className="font-mono text-[11px] uppercase tracking-[0.3em]">
                Systems
              </span>
            </button>

            <button
              id="menu-leaderboard-button"
              onClick={onLeaderboard}
              className="cyber-btn cyber-slide-in flex h-10 items-center gap-3 px-5"
              style={{ animationDelay: "350ms" }}
              aria-label="View leaderboard"
            >
              <Trophy className="h-3.5 w-3.5" />
              <span className="font-mono text-[11px] uppercase tracking-[0.3em]">
                Leaderboard
              </span>
            </button>

            <button
              id="menu-exit-button"
              onClick={onExit}
              className="cyber-btn cyber-slide-in flex h-10 items-center gap-3 px-5"
              style={{ animationDelay: "450ms" }}
              aria-label="Exit game"
            >
              <Power className="h-3.5 w-3.5" />
              <span className="font-mono text-[11px] uppercase tracking-[0.3em]">
                Disconnect
              </span>
            </button>
          </div>

          {/* Center — Play button */}
          <button
            id="menu-play-button"
            onClick={onPlay}
            className="cyber-btn cyber-btn-primary hud-reveal group relative flex h-14 items-center gap-4 px-10"
            style={{ animationDelay: "200ms" }}
          >
            <Zap className="h-4 w-4" />
            <span className="text-base font-bold uppercase tracking-[0.35em]">
              Deploy
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] opacity-50">
              Enter
            </span>

            {/* Animated bottom neon line */}
            <span className="absolute -bottom-px left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-[oklch(0.82_0.16_192)] to-transparent opacity-60 group-hover:opacity-100 transition-opacity" />
          </button>

          {/* Right — decorative data readout */}
          <div
            className="cyber-slide-in-right flex flex-col items-end gap-1"
            style={{ animationDelay: "350ms" }}
          >
            <span className="font-mono text-[9px] uppercase tracking-[0.4em] text-primary/30">
              Arena Status
            </span>
            <span className="font-mono text-[11px] tabular-nums text-primary/60">
              READY // 12 TARGETS
            </span>
            <div className="mt-1 flex gap-1">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="h-1 w-4 rounded-sm"
                  style={{
                    background:
                      i < 4
                        ? "oklch(0.82 0.16 192 / 50%)"
                        : "oklch(0.82 0.16 192 / 15%)",
                  }}
                />
              ))}
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
