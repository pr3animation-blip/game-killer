"use client";

import { useState } from "react";
import {
  ArrowLeft,
  Crosshair,
  Eye,
  Flame,
  Bomb,
  Target,
  Shield,
  Zap,
} from "lucide-react";
import { MenuBackground } from "@/components/menu/menu-background";
import {
  CLASS_PRESETS,
  ClassPreset,
  getClassWeaponName,
  getClassUpgradeName,
} from "@/game/classes";

interface ClassSelectProps {
  onSelect: (preset: ClassPreset) => void;
  onBack: () => void;
}

const CLASS_ICONS = [Shield, Crosshair, Eye, Flame, Bomb, Target] as const;

export function ClassSelect({ onSelect, onBack }: ClassSelectProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  return (
    <div className="menu-cinematic-shell absolute inset-0 z-30 overflow-hidden">
      <MenuBackground />

      {/* Scanline overlay */}
      <div className="cyber-scanlines" />

      {/* ── CONTENT LAYER ── */}
      <div className="relative z-10 flex h-full flex-col justify-between p-6 sm:p-8 lg:p-10">
        {/* ── HEADER ── */}
        <header
          className="cyber-slide-in flex flex-col gap-1"
          style={{ animationDelay: "100ms" }}
        >
          <span className="hud-label text-primary/50">Loadout Selection</span>
          <h1 className="font-mono text-2xl font-bold uppercase tracking-[0.25em] text-primary/90 sm:text-3xl">
            Choose Your Class
          </h1>
          <div className="neon-line mt-2 w-48" />
        </header>

        {/* ── CLASS GRID ── */}
        <div className="flex flex-1 items-center justify-center py-6">
          <div className="grid w-full max-w-4xl grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            {CLASS_PRESETS.map((preset, i) => {
              const Icon = CLASS_ICONS[i];
              const isSelected = selectedIndex === i;
              const isRecruit = preset.id === "recruit";
              const weaponName = getClassWeaponName(preset);
              const upgradeName = getClassUpgradeName(preset);

              return (
                <button
                  key={preset.id}
                  onClick={() => setSelectedIndex(i)}
                  className={`cyber-slide-in group corner-cut border border-border/55 bg-background/48 px-5 py-4 text-left transition-all hover:border-primary/35 hover:bg-primary/8 ${
                    isSelected
                      ? "border-primary/50 bg-primary/12 ring-1 ring-primary/20"
                      : ""
                  }`}
                  style={{ animationDelay: `${150 + i * 50}ms` }}
                >
                  {/* Icon + Name */}
                  <div className="mb-3 flex items-center gap-3">
                    <div
                      className={`neon-border flex h-8 w-8 items-center justify-center rounded ${
                        isRecruit ? "opacity-50" : ""
                      }`}
                    >
                      <Icon className="h-4 w-4 text-primary/80" />
                    </div>
                    <span
                      className={`font-mono text-sm font-bold uppercase tracking-[0.2em] ${
                        isRecruit ? "text-primary/50" : "text-primary/90"
                      }`}
                    >
                      {preset.name}
                    </span>
                  </div>

                  {/* Description */}
                  <p
                    className={`mb-3 text-xs leading-relaxed ${
                      isRecruit
                        ? "text-muted-foreground/50"
                        : "text-muted-foreground/70"
                    }`}
                  >
                    {preset.description}
                  </p>

                  {/* Weapon */}
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-primary/35">
                      Weapon
                    </span>
                    <span className="font-mono text-[11px] text-primary/70">
                      {weaponName}
                    </span>
                  </div>

                  {/* Upgrade */}
                  {!isRecruit && upgradeName && (
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-primary/35">
                        Upgrade
                      </span>
                      <span className="font-mono text-[11px] text-primary/70">
                        {upgradeName}{" "}
                        <span className="text-primary/40">(x2)</span>
                      </span>
                    </div>
                  )}

                  {isRecruit && (
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-primary/25">
                        No specialty
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── BOTTOM ACTION BAR ── */}
        <footer className="flex items-end justify-between gap-4">
          {/* Back button */}
          <button
            onClick={onBack}
            className="cyber-btn cyber-slide-in flex h-10 items-center gap-3 px-5"
            style={{ animationDelay: "450ms" }}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="font-mono text-[11px] uppercase tracking-[0.3em]">
              Back
            </span>
          </button>

          {/* Deploy button */}
          <button
            onClick={() => onSelect(CLASS_PRESETS[selectedIndex])}
            className="cyber-btn cyber-btn-primary hud-reveal group relative flex h-14 items-center gap-4 px-10"
            style={{ animationDelay: "500ms" }}
          >
            <Zap className="h-4 w-4" />
            <span className="text-base font-bold uppercase tracking-[0.35em]">
              Deploy
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] opacity-50">
              Enter
            </span>

            {/* Animated bottom neon line */}
            <span className="absolute -bottom-px left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-[oklch(0.82_0.16_192)] to-transparent opacity-60 transition-opacity group-hover:opacity-100" />
          </button>

          {/* Right — selected class readout */}
          <div
            className="cyber-slide-in-right flex flex-col items-end gap-1"
            style={{ animationDelay: "450ms" }}
          >
            <span className="font-mono text-[9px] uppercase tracking-[0.4em] text-primary/30">
              Selected Class
            </span>
            <span className="font-mono text-[11px] tabular-nums text-primary/60">
              {CLASS_PRESETS[selectedIndex].name.toUpperCase()} // READY
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
