"use client";

import { useState } from "react";
import { AudioLines, Gauge, MousePointer2, SlidersHorizontal } from "lucide-react";
import { Slider } from "@/components/ui/slider";

interface SettingsMenuProps {
  onBack: () => void;
  onApply?: (settings: SettingsValues) => void;
}

export interface SettingsValues {
  mouseSensitivity: number;
  masterVolume: number;
  sfxVolume: number;
  fov: number;
}

export function SettingsMenu({ onBack, onApply }: SettingsMenuProps) {
  const [sensitivity, setSensitivity] = useState(50);
  const [masterVol, setMasterVol] = useState(80);
  const [sfxVol, setSfxVol] = useState(80);
  const [fov, setFov] = useState(75);

  const handleApply = () => {
    onApply?.({
      mouseSensitivity: (sensitivity / 100) * 0.005,
      masterVolume: masterVol / 100,
      sfxVolume: sfxVol / 100,
      fov,
    });
    onBack();
  };

  return (
    <div className="menu-overlay-enter absolute inset-0 z-30 flex cursor-default items-center justify-center bg-black/50 px-4">
      <div className="menu-card-enter tac-panel-strong w-full max-w-lg p-0">
        {/* Header */}
        <div className="space-y-4 px-6 pt-6">
          <div className="tac-border inline-flex items-center gap-2 px-3 py-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/80">
              System Config
            </span>
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold uppercase tracking-[0.15em] text-foreground">
              Tune Arena
            </h2>
            <p className="font-mono text-xs text-muted-foreground">
              Adjust parameters. Changes apply on confirm.
            </p>
          </div>
          <div className="tac-divider" />
        </div>

        {/* Sliders */}
        <div className="space-y-3 px-6 py-5">
          <SettingRow
            label="Mouse Sensitivity"
            value={sensitivity}
            icon={<MousePointer2 className="h-3.5 w-3.5 text-primary" />}
          >
            <Slider
              aria-label="Mouse sensitivity"
              value={[sensitivity]}
              onValueChange={(v) => setSensitivity(Array.isArray(v) ? v[0] : v)}
              max={100}
              min={1}
              step={1}
              className="flex-1"
            />
          </SettingRow>

          <SettingRow
            label="Master Volume"
            value={masterVol}
            icon={<AudioLines className="h-3.5 w-3.5 text-primary" />}
          >
            <Slider
              aria-label="Master volume"
              value={[masterVol]}
              onValueChange={(v) => setMasterVol(Array.isArray(v) ? v[0] : v)}
              max={100}
              min={0}
              step={1}
              className="flex-1"
            />
          </SettingRow>

          <SettingRow
            label="SFX Volume"
            value={sfxVol}
            icon={<AudioLines className="h-3.5 w-3.5 text-primary" />}
          >
            <Slider
              aria-label="SFX volume"
              value={[sfxVol]}
              onValueChange={(v) => setSfxVol(Array.isArray(v) ? v[0] : v)}
              max={100}
              min={0}
              step={1}
              className="flex-1"
            />
          </SettingRow>

          <SettingRow
            label="Field of View"
            value={fov}
            icon={<Gauge className="h-3.5 w-3.5 text-primary" />}
          >
            <Slider
              aria-label="Field of view"
              value={[fov]}
              onValueChange={(v) => setFov(Array.isArray(v) ? v[0] : v)}
              max={120}
              min={60}
              step={1}
              className="flex-1"
            />
          </SettingRow>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-6 pb-6">
          <button
            onClick={onBack}
            className="tac-btn h-11 flex-1 font-mono text-xs uppercase tracking-[0.3em]"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="tac-btn tac-btn-primary h-11 flex-1 font-bold uppercase tracking-[0.3em]"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingRow({
  label,
  value,
  icon,
  children,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="tac-border rounded-sm p-4">
      <div className="mb-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center tac-border rounded-sm">
            {icon}
          </div>
          <span className="text-sm font-medium uppercase tracking-[0.15em] text-foreground">
            {label}
          </span>
        </div>
        <span className="font-mono text-sm tabular-nums text-primary/60">
          {value}
        </span>
      </div>
      {children}
    </div>
  );
}
