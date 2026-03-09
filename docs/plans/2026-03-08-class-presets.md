# Class Preset System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let players choose a class (weapon + upgrade preset) on a dedicated screen before the game starts.

**Architecture:** Define 6 class presets as data in a new `classes.ts` file. Add a `ClassSelect` screen component between main menu and gameplay. Thread the selected class through `page.tsx` → `GameCanvas` → `GameEngine.initializeLevel()`, which applies the starting weapon and 2-stack upgrade on run reset.

**Tech Stack:** React, Tailwind CSS, Zustand, existing game engine types

---

### Task 1: Define class preset data

**Files:**
- Create: `src/game/classes.ts`

**Step 1: Create the class definitions file**

```typescript
import { UpgradeId, WeaponId } from "./types";
import { UPGRADE_DEFINITIONS } from "./progression";
import { WEAPON_DEFINITIONS } from "./weapons";

export interface ClassPreset {
  id: string;
  name: string;
  description: string;
  weaponId: WeaponId;
  upgradeId: UpgradeId | null;
  upgradeStacks: number;
}

export const CLASS_PRESETS: ClassPreset[] = [
  {
    id: "recruit",
    name: "Recruit",
    description: "No specialty — classic start with the standard carbine.",
    weaponId: "vanguard-carbine",
    upgradeId: null,
    upgradeStacks: 0,
  },
  {
    id: "assault",
    name: "Assault",
    description: "Sustained firepower with an overclocked fire rate.",
    weaponId: "vanguard-carbine",
    upgradeId: "overcrank",
    upgradeStacks: 2,
  },
  {
    id: "recon",
    name: "Recon",
    description: "Precision at range with tighter weapon spread.",
    weaponId: "phantom-sniper",
    upgradeId: "tight-choke",
    upgradeStacks: 2,
  },
  {
    id: "breacher",
    name: "Breacher",
    description: "Fast and close-range with enhanced movement speed.",
    weaponId: "scattershot",
    upgradeId: "fleet-step",
    upgradeStacks: 2,
  },
  {
    id: "demolitionist",
    name: "Demolitionist",
    description: "Explosive power with boosted weapon damage.",
    weaponId: "plasma-lobber",
    upgradeId: "hollow-point",
    upgradeStacks: 2,
  },
  {
    id: "operator",
    name: "Operator",
    description: "Tactical burst fighter with faster dash recovery.",
    weaponId: "helix-burst-rifle",
    upgradeId: "dash-capacitors",
    upgradeStacks: 2,
  },
];

export function getClassWeaponName(preset: ClassPreset): string {
  return WEAPON_DEFINITIONS[preset.weaponId].name;
}

export function getClassUpgradeName(preset: ClassPreset): string | null {
  if (!preset.upgradeId) return null;
  return UPGRADE_DEFINITIONS[preset.upgradeId].name;
}
```

**Step 2: Commit**

```bash
git add src/game/classes.ts
git commit -m "feat: add class preset definitions"
```

---

### Task 2: Thread class preset through engine initialization

**Files:**
- Modify: `src/game/engine.ts:1251-1276` (initializeLevel resetRun block)
- Modify: `src/game/engine.ts:315-342` (constructor — store preset)
- Modify: `src/game/weapon.ts:653-662` (resetForNewRun accepts optional weaponId)

**Step 1: Update `WeaponSystem.resetForNewRun` to accept an optional starting weapon**

In `src/game/weapon.ts`, change `resetForNewRun()` at line 653:

```typescript
resetForNewRun(startingWeaponId?: WeaponId): void {
  this.clearTransientState();
  this.removeAllProjectiles();
  this.removeAllTraces();
  this.slots = [createWeaponInstance(startingWeaponId ?? STARTER_WEAPON_ID), null, null];
  this.activeSlotIndex = 0;
  this.runtimeModifiers = { ...DEFAULT_RUNTIME_MODIFIERS };
  this.goldenChamberReady = [false, false, false];
  this.syncViewModelVisibility();
}
```

Add `WeaponId` import if not already present (it's imported from `./types` already via the `WeaponInstance` import).

**Step 2: Add class preset support to the engine**

In `src/game/engine.ts`:

1. Add import at top:
```typescript
import { ClassPreset } from "./classes";
```

2. Add a private field near other state fields (~line 294):
```typescript
private classPreset: ClassPreset | null = null;
```

3. Add a public method to set the class before the game starts (near `chooseUpgrade` ~line 400):
```typescript
setClassPreset(preset: ClassPreset | null): void {
  this.classPreset = preset;
}
```

4. Modify `initializeLevel` resetRun block (lines 1261-1276). After `this.activeUpgrades = [];` and `this.progression = ...`, add class preset application:

```typescript
if (resetRun) {
  this.runTime = 0;
  this.totalKills = 0;
  this.player.score = 0;
  this.player.deaths = 0;
  this.claimedWeaponPickups.clear();
  this.weapon.resetForNewRun(this.classPreset?.weaponId);
  this.comboState = createEmptyComboState();
  this.bankState = createEmptyBankState();
  this.scoreEvents = [];
  this.activeUpgrades = [];
  this.progression = createInitialProgressionState();

  // Apply class preset upgrade
  if (this.classPreset?.upgradeId) {
    for (let i = 0; i < this.classPreset.upgradeStacks; i++) {
      this.activeUpgrades = applyUpgrade(this.activeUpgrades, this.classPreset.upgradeId);
    }
    this.progression = {
      ...this.progression,
      powerScore: computePowerScore(this.activeUpgrades),
    };
  }

  this.activeMutator = this.rollMutator();
  this.levelUpChoice = createInactiveLevelUpChoice();
  this.recoveryShard = createInactiveRecoveryShard();
}
```

**Step 3: Commit**

```bash
git add src/game/engine.ts src/game/weapon.ts
git commit -m "feat: thread class preset through engine and weapon initialization"
```

---

### Task 3: Build the class select screen component

**Files:**
- Create: `src/components/menu/class-select.tsx`

**Step 1: Create the component**

Build a full-screen overlay matching the existing cyber/HUD aesthetic from `main-menu.tsx`. It should:

- Import `CLASS_PRESETS, ClassPreset, getClassWeaponName, getClassUpgradeName` from `@/game/classes`
- Import `UPGRADE_DEFINITIONS` from `@/game/progression` for upgrade descriptions
- Display 6 class cards in a responsive grid (2 cols on small, 3 cols on large)
- Each card shows: class name, weapon name, upgrade name + description (or "No specialty" for Recruit)
- Highlight the selected card, confirm with a "Deploy" button
- Props: `onSelect: (preset: ClassPreset) => void`, `onBack: () => void`
- Use the same `cyber-btn`, `cyber-slide-in`, `font-mono`, `tracking-*` patterns from `main-menu.tsx`
- Use `MenuBackground` component behind the cards
- Recruit card should be visually distinct (more subdued, no upgrade section)

```typescript
interface ClassSelectProps {
  onSelect: (preset: ClassPreset) => void;
  onBack: () => void;
}
```

**Step 2: Commit**

```bash
git add src/components/menu/class-select.tsx
git commit -m "feat: create class select screen component"
```

---

### Task 4: Wire class select into page flow

**Files:**
- Modify: `src/app/page.tsx:15,22,31-43,109-126`

**Step 1: Add class select screen to the page routing**

1. Update the `Screen` type:
```typescript
type Screen = "mainMenu" | "classSelect" | "game" | "settings";
```

2. Add import:
```typescript
import { ClassSelect } from "@/components/menu/class-select";
import { ClassPreset } from "@/game/classes";
```

3. Change `handlePlay` to navigate to class select instead of starting the game:
```typescript
const handlePlay = () => {
  setShowSettings(false);
  setExitContext(null);
  setShowLeaderboard(false);
  setScreen("classSelect");
};
```

4. Add a new handler for when a class is selected:
```typescript
const handleClassSelected = (preset: ClassPreset, lockPointer = true) => {
  useGameStore.getState().reset();
  useGameStore.setState({ gameState: "playing" });
  engineRef.current?.setClassPreset(preset);
  if (lockPointer) {
    canvasRef.current?.requestPointerLock();
  }
  setScreen("game");
};
```

5. Add the ClassSelect screen to the JSX, between the MainMenu and Game blocks:
```tsx
{screen === "classSelect" && (
  <ClassSelect
    onSelect={handleClassSelected}
    onBack={() => setScreen("mainMenu")}
  />
)}
```

6. Update the autostart flow to use Recruit preset:
```typescript
import { CLASS_PRESETS } from "@/game/classes";

// In the autostart useEffect:
const recruit = CLASS_PRESETS[0]; // Recruit
handleClassSelected(recruit, false);
```

**Step 2: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: wire class select screen into page flow"
```

---

### Task 5: Emit class state to store and HUD

**Files:**
- Modify: `src/game/engine.ts` (emit class info after initializeLevel)
- Modify: `src/state/game-store.ts` (add activeClass field)
- Modify: `src/components/game/game-canvas.tsx` (listen for class event)

**Step 1: Add class tracking to the store**

In `src/state/game-store.ts`, add to the interface and defaults:
```typescript
// Interface:
activeClassName: string | null;

// Default:
activeClassName: null,

// In reset():
activeClassName: null,
```

**Step 2: Emit upgrades/progression after class application in engine**

In `src/game/engine.ts`, at the end of `initializeLevel`, after `this.applyRunModifiers()` (line 1332), add:
```typescript
if (resetRun) {
  this.emit("upgradesChanged", this.activeUpgrades);
  this.emit("progressionChanged", this.progression);
  this.emit("runtimeModifiersChanged", this.runtimeModifiers);
  this.emit("balanceChanged", this.balanceSnapshot);
}
```

**Step 3: Set class name in store from page.tsx**

In `handleClassSelected` in `page.tsx`, after `setClassPreset`:
```typescript
useGameStore.setState({ activeClassName: preset.name });
```

**Step 4: Commit**

```bash
git add src/game/engine.ts src/state/game-store.ts src/app/page.tsx
git commit -m "feat: emit class preset state to store for HUD display"
```

---

### Task 6: Verify and test end-to-end

**Step 1: Run type check**

```bash
npx tsc --noEmit
```
Expected: No errors.

**Step 2: Run dev server and manually test**

```bash
bun run dev:next
```

Test each class:
- Click Play → class select screen appears
- Click Back → returns to main menu
- Select Recruit → game starts with Vanguard Carbine, no upgrades
- Select Assault → game starts with Vanguard Carbine, Overcrank x2
- Select Recon → game starts with Phantom Sniper, Tight Choke x2
- Select Breacher → game starts with Scattershot, Fleet Step x2
- Select Demolitionist → game starts with Plasma Lobber, Hollow Point x2
- Select Operator → game starts with Helix Burst Rifle, Dash Capacitors x2
- Verify upgrades appear in HUD perk display
- Verify enemy scaling adjusts (subtle — enemies slightly tougher with class upgrades)

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: class preset system — complete implementation"
```
