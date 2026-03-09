# Terminal UX Cleanup — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the verbose, unclear Terminal objective UI with a compact two-line card showing a single action directive and dot-based step progress.

**Architecture:** The ObjectivePanel React component gets rewritten. The engine's `buildObjectiveState` text values get simplified to action verbs. The 3D label sprites for interactables drop the hint text and show only the terminal letter. No type changes needed — we reuse the existing `ObjectiveState` shape.

**Tech Stack:** React (ObjectivePanel component), TypeScript (engine.ts, arena.ts, levels.ts), Three.js (label sprites), Tailwind CSS

---

### Task 1: Simplify engine objective text values

**Files:**
- Modify: `src/game/engine.ts:1443-1457` (terminal-sequence branch of `buildObjectiveState`)
- Modify: `src/game/engine.ts:1460-1483` (hold-zone branch)
- Modify: `src/game/engine.ts:1485-1503` (switch-escape branch)
- Modify: `src/game/engine.ts:968-974` (interactPrompt in `updateObjectives`)
- Modify: `src/game/engine.ts:1004-1009` (extraction interactPrompt)

**Step 1: Change terminal-sequence text and progress in `buildObjectiveState`**

In `engine.ts`, find the `terminal-sequence` branch (~line 1443). Change:

```typescript
// OLD
text: active
  ? `Activate ${active.def.label}`
  : `Move to ${this.arena.extraction.def.label}`,
detail: active ? active.def.hint : this.arena.extraction.def.hint,
progress: `${this.levelRuntime.completedInteractables.length}/${this.currentLevel.interactables.length} terminals synced`,
```

To:

```typescript
// NEW
text: active
  ? `Go to ${active.def.label}`
  : "Move to extraction",
detail: "",
progress: `${this.levelRuntime.completedInteractables.length}/${this.currentLevel.interactables.length}`,
```

**Step 2: Change hold-zone text and progress**

In the hold-zone branch (~line 1460). Change:

```typescript
// OLD
text: active
  ? `Hold ${active.def.label}`
  : `Move to ${this.arena.extraction.def.label}`,
detail: active ? active.def.hint : this.arena.extraction.def.hint,
progress: active
  ? `${Math.min(active.def.duration, progressValue).toFixed(1)}/${active.def.duration.toFixed(1)}s secure`
  : `${this.currentLevel.holdZones.length}/${this.currentLevel.holdZones.length} uplinks stable`,
```

To:

```typescript
// NEW
text: active
  ? `Hold ${active.def.label}`
  : "Move to extraction",
detail: "",
progress: active
  ? `${Math.min(active.def.duration, progressValue).toFixed(1)}/${active.def.duration.toFixed(1)}`
  : `${this.currentLevel.holdZones.length}/${this.currentLevel.holdZones.length}`,
```

**Step 3: Change switch-escape text and progress**

In the switch-escape branch (~line 1485). Change:

```typescript
// OLD
text: switchComplete
  ? `Race to ${this.arena.extraction.def.label}`
  : `Trigger ${this.currentLevel.interactables[0]?.label ?? "reactor"}`,
detail: switchComplete
  ? this.arena.extraction.def.hint
  : (this.currentLevel.interactables[0]?.hint ?? "Trigger the reactor to open evac."),
progress: switchComplete ? "Evac route live" : "Reactor offline",
```

To:

```typescript
// NEW
text: switchComplete
  ? "Get to extraction"
  : `Trigger ${this.currentLevel.interactables[0]?.label ?? "reactor"}`,
detail: "",
progress: switchComplete ? "1/1" : "0/1",
```

**Step 4: Simplify interact prompts**

In `updateObjectives` (~line 968-974), change:

```typescript
// OLD
interactPrompt = `Hold E to sync ${activeInteractable.def.label}`;
```

To:

```typescript
// NEW
interactPrompt = `Hold E — ${activeInteractable.def.label}`;
```

And the extraction prompt (~line 1004-1009), change:

```typescript
// OLD
interactPrompt = `Hold inside ${this.arena.extraction.def.label} to leave`;
```

To:

```typescript
// NEW
interactPrompt = `Hold E — Extract`;
```

**Step 5: Verify build**

Run: `cd /Volumes/Bitcoin/Projects/Frontend/experiments/game-killer && bun run dev:next`
Expected: No TypeScript errors. App compiles.

**Step 6: Commit**

```bash
git add src/game/engine.ts
git commit -m "refactor: simplify objective text to action directives"
```

---

### Task 2: Simplify 3D interactable label sprites

**Files:**
- Modify: `src/game/arena.ts:311-317` (createInteractableVisual label sprite call)

**Step 1: Change the label sprite to show only the terminal letter, no hint**

In `createInteractableVisual` (~line 311), change:

```typescript
// OLD
const label = createLabelSprite(
  def.label,
  "rgba(122, 183, 255, 0.96)",
  def.hint
);
label.position.set(0, 4.15, 0);
label.scale.set(3.5, 1.18, 1);
```

To:

```typescript
// NEW
const shortLabel = def.label.replace(/^Terminal\s+/i, "");
const label = createLabelSprite(
  shortLabel,
  "rgba(122, 183, 255, 0.96)"
);
label.position.set(0, 3.6, 0);
label.scale.set(1.8, 0.72, 1);
```

This drops the hint subtitle and shrinks the sprite. The letter "A" / "B" / "C" is all that shows. Position lowered slightly since the sprite is smaller.

**Step 2: Verify build**

Run: `cd /Volumes/Bitcoin/Projects/Frontend/experiments/game-killer && bun run dev:next`
Expected: No TypeScript errors.

**Step 3: Commit**

```bash
git add src/game/arena.ts
git commit -m "refactor: simplify 3D terminal labels to single letter"
```

---

### Task 3: Rewrite ObjectivePanel component

**Files:**
- Modify: `src/components/hud/objective-panel.tsx` (full rewrite)

**Step 1: Rewrite the component**

Replace entire contents of `objective-panel.tsx` with:

```tsx
"use client";

import { useGameStore } from "@/state/game-store";

export function ObjectivePanel() {
  const objective = useGameStore((state) => state.objective);

  if (!objective.text) return null;

  // Parse progress "N/M" into completed/total for dot rendering
  const progressMatch = objective.progress.match(/^(\d+)\/(\d+)/);
  const completed = progressMatch ? parseInt(progressMatch[1], 10) : 0;
  const total = progressMatch ? parseInt(progressMatch[2], 10) : 0;

  // For hold-zone with timer progress like "2.4/5.0", show as time bar instead of dots
  const isTimerProgress = objective.progress.includes(".");

  const displayText = objective.interactPrompt ?? objective.text;

  return (
    <div className="absolute top-6 right-8">
      <div
        className="hud-reveal flex flex-col items-end gap-1.5 rounded-md border border-white/10 bg-[rgba(4,10,22,0.6)] px-4 py-3 backdrop-blur-sm"
        style={{ animationDelay: "140ms" }}
      >
        {/* Action directive */}
        <span className="font-mono text-sm font-semibold uppercase tracking-[0.12em] text-white/80">
          {displayText}
        </span>

        {/* Progress — dots or timer bar */}
        {objective.escapeTimer !== null ? (
          <span
            className="font-mono text-lg font-bold tabular-nums text-red-400/90"
            style={{
              textShadow:
                "0 0 14px rgba(248,113,113,0.5), 0 1px 4px rgba(0,0,0,0.8)",
            }}
          >
            {objective.escapeTimer.toFixed(1)}s
          </span>
        ) : isTimerProgress && total > 0 ? (
          <div className="flex items-center gap-2">
            <div className="h-[3px] w-20 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-sky-400/60 transition-[width] duration-200"
                style={{
                  width: `${Math.min(100, (completed / total) * 100)}%`,
                }}
              />
            </div>
          </div>
        ) : total > 0 ? (
          <div className="flex items-center gap-1.5">
            {Array.from({ length: total }, (_, i) => (
              <span
                key={i}
                className={`inline-block h-2 w-2 rounded-full ${
                  i < completed
                    ? "bg-sky-400/80 shadow-[0_0_6px_rgba(56,189,248,0.4)]"
                    : "bg-white/15"
                }`}
              />
            ))}
          </div>
        ) : null}

        {/* Extraction ready badge */}
        {objective.extractionUnlocked && objective.escapeTimer === null ? (
          <span className="font-mono text-xs uppercase tracking-[0.12em] text-emerald-400/70">
            Extract ready
          </span>
        ) : null}
      </div>
    </div>
  );
}
```

**Step 2: Verify build**

Run: `cd /Volumes/Bitcoin/Projects/Frontend/experiments/game-killer && bun run dev:next`
Expected: No TypeScript errors. Panel renders as compact card.

**Step 3: Commit**

```bash
git add src/components/hud/objective-panel.tsx
git commit -m "feat: redesign objective panel as compact two-line card with dot progress"
```

---

### Task 4: Visual verification

**Step 1: Run the game and verify each level's objective panel**

Run: `cd /Volumes/Bitcoin/Projects/Frontend/experiments/game-killer && bun run dev:next`

Check in browser at localhost:3000:

1. **Relay Loop** (terminal-sequence): Panel shows "GO TO TERMINAL A" with 3 empty dots. When near terminal, shows "HOLD E — TERMINAL A". After completing, dot fills. After all 3, shows "MOVE TO EXTRACTION" with all dots filled + "Extract ready".

2. **Uplink Split** (hold-zone): Panel shows "HOLD UPLINK A" with a progress bar filling. After both uplinks, shows "MOVE TO EXTRACTION".

3. **Blackout Run** (switch-escape): Panel shows "TRIGGER REACTOR SWITCH" with 1 empty dot. After triggering, shows "GET TO EXTRACTION" with countdown timer.

4. **3D labels**: Terminals show just "A", "B", "C" — no hint text.

**Step 2: Final commit if any tweaks needed**

```bash
git add -A
git commit -m "fix: terminal UX visual polish tweaks"
```
