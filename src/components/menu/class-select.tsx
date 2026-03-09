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
  Lock,
} from "lucide-react";
import { DeferredMenuBackground } from "@/components/menu/deferred-menu-background";
import {
  CLASS_PRESETS,
  type ClassPresetId,
  getClassWeaponName,
  getClassUpgradeName,
} from "@/game/classes";
import { ClassPreviewStage } from "@/components/menu/class-preview-stage";

interface ClassSelectProps {
  onSelect: (presetId: ClassPresetId) => void;
  onBack: () => void;
  onIntentToDeploy?: () => void;
}

const CLASS_ICONS = [Shield, Crosshair, Eye, Flame, Bomb, Target] as const;

export function ClassSelect({
  onSelect,
  onBack,
  onIntentToDeploy,
}: ClassSelectProps) {
  const [lockedIndex, setLockedIndex] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // The preview shows the hovered class only if nothing is locked,
  // otherwise it always shows the locked-in class.
  const previewIndex = lockedIndex;
  const previewPreset = CLASS_PRESETS[previewIndex];

  const handleLockIn = (index: number) => {
    setLockedIndex(index);
    onIntentToDeploy?.();
  };

  return (
    <div className="menu-cinematic-shell absolute inset-0 z-30 overflow-hidden">
      <DeferredMenuBackground />


      {/* ── CONTENT LAYER ── */}
      <div className="relative z-10 flex h-full flex-col justify-between p-5 sm:p-6 lg:p-8">
        {/* ── HEADER ── */}
        <header
          className="tac-fade-in flex flex-col gap-1"
          style={{ animationDelay: "100ms" }}
        >
          <span className="tac-hud-label text-primary/50">Loadout Selection</span>
          <h1 className="font-mono text-2xl font-bold uppercase tracking-[0.25em] text-primary/90 sm:text-3xl">
            Choose Your Class
          </h1>
          <div className="tac-divider mt-2 w-48" />
        </header>

        {/* ── PREVIEW + CLASS GRID ── */}
        <div className="flex min-h-0 flex-1 flex-col items-center gap-3 overflow-y-auto py-2 sm:gap-4 lg:flex-row lg:items-stretch lg:gap-6">
          {/* Preview — fixed height on mobile, flex on desktop */}
          <div className="w-full shrink-0 lg:w-[45%] lg:shrink">
            <ClassPreviewStage presetId={previewPreset.id} />
          </div>

          {/* Class grid — scrollable area */}
          <div className="grid w-full grid-cols-2 content-start gap-2.5 sm:gap-3 lg:grid-cols-2 lg:overflow-y-auto">
            {CLASS_PRESETS.map((preset, i) => {
              const Icon = CLASS_ICONS[i];
              const isLocked = lockedIndex === i;
              const isHovered = hoveredIndex === i;
              const isRecruit = preset.id === "recruit";
              const weaponName = getClassWeaponName(preset);
              const upgradeName = getClassUpgradeName(preset);

              return (
                <button
                  key={preset.id}
                  aria-label={`Select ${preset.name} class`}
                  onClick={() => handleLockIn(i)}
                  onPointerEnter={() => setHoveredIndex(i)}
                  onPointerLeave={() => setHoveredIndex(null)}
                  className={`tac-fade-in group relative border bg-background/48 px-4 py-3 text-left transition-all ${
                    isLocked
                      ? "border-primary/60 bg-primary/14 ring-1 ring-primary/30 shadow-[0_0_32px_rgba(224,96,48,0.18)]"
                      : "border-border/55 hover:border-primary/25 hover:bg-primary/6"
                  }`}
                  style={{ animationDelay: `${150 + i * 50}ms` }}
                >
                  {/* Locked-in indicator */}
                  {isLocked && (
                    <div className="absolute -top-px -right-px flex items-center gap-1.5 border border-primary/40 bg-primary/20 px-2 py-0.5">
                      <Lock className="h-2.5 w-2.5 text-primary" />
                      <span className="font-mono text-[8px] font-bold uppercase tracking-[0.3em] text-primary">
                        Locked
                      </span>
                    </div>
                  )}

                  {/* Icon + Name */}
                  <div className="mb-2 flex items-center gap-2.5">
                    <div
                      className={`tac-border flex h-8 w-8 items-center justify-center rounded transition-colors ${
                        isLocked
                          ? "border-primary/40 bg-primary/10"
                          : isRecruit
                            ? "opacity-50"
                            : ""
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${isLocked ? "text-primary" : "text-primary/80"}`} />
                    </div>
                    <span
                      className={`font-mono text-sm font-bold uppercase tracking-[0.2em] ${
                        isLocked
                          ? "text-primary"
                          : isRecruit
                            ? "text-primary/50"
                            : "text-primary/90"
                      }`}
                    >
                      {preset.name}
                    </span>
                  </div>

                  {/* Description */}
                  <p
                    className={`mb-2 text-xs leading-snug ${
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
            className="tac-btn tac-fade-in flex h-10 items-center gap-3 px-5"
            style={{ animationDelay: "450ms" }}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="font-mono text-[11px] uppercase tracking-[0.3em]">
              Back
            </span>
          </button>

          {/* Deploy button */}
          <button
            onClick={() => onSelect(CLASS_PRESETS[lockedIndex].id)}
            onPointerEnter={onIntentToDeploy}
            onPointerDown={onIntentToDeploy}
            onFocus={onIntentToDeploy}
            className="tac-btn tac-btn-primary hud-reveal group relative flex h-14 items-center gap-4 px-10"
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
            <span className="absolute -bottom-px left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-[#e06030] to-transparent opacity-60 transition-opacity group-hover:opacity-100" />
          </button>

          {/* Right — selected class readout */}
          <div
            className="tac-fade-in flex flex-col items-end gap-1"
            style={{ animationDelay: "450ms" }}
          >
            <span className="font-mono text-[9px] uppercase tracking-[0.4em] text-primary/30">
              Locked Class
            </span>
            <span className="font-mono text-[11px] tabular-nums text-primary/70">
              <Lock className="mr-1.5 inline h-2.5 w-2.5 text-primary/50" />
              {previewPreset.name.toUpperCase()} {"// LOCKED IN"}
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
