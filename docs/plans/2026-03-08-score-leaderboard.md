# Score & Leaderboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Single-life permadeath with a local top-10 leaderboard shown on game over and from the main menu.

**Architecture:** Death triggers `"gameover"` state instead of respawn. Engine emits a new `gameOver` event carrying final stats. A `LeaderboardEntry` is saved to localStorage. Two new UI components — game-over screen and leaderboard overlay — consume the store.

**Tech Stack:** TypeScript, Zustand, localStorage, React (shadcn/ui + Tailwind), existing engine event system.

---

### Task 1: Add types and leaderboard storage key

**Files:**
- Modify: `src/game/types.ts`

**Step 1: Add LeaderboardEntry and GameOverStats types to types.ts**

After the `PersonalBestSnapshot` interface (~line 463), add:

```typescript
export interface GameOverStats {
  score: number;
  kills: number;
  timeAlive: number;
  bestCombo: number;
  levelReached: string;
  killedBy: string;
}

export interface LeaderboardEntry {
  score: number;
  kills: number;
  timeAlive: number;
  bestCombo: number;
  levelReached: string;
  date: number; // Date.now()
}
```

**Step 2: Add gameOver to GameEventMap**

In the `GameEventMap` type (~line 575), add:

```typescript
gameOver: GameOverStats;
```

**Step 3: Commit**

```bash
git add src/game/types.ts
git commit -m "feat: add GameOverStats and LeaderboardEntry types"
```

---

### Task 2: Track total kills in engine and implement permadeath

**Files:**
- Modify: `src/game/engine.ts`

**Step 1: Add a totalKills counter**

In the private fields of `GameEngine` (~line 308), add:

```typescript
private totalKills = 0;
```

**Step 2: Increment totalKills on each bot kill**

In the `handleBotKill` method (the method that calls `addComboValue` and `awardKillXp`), add before the combo/xp calls:

```typescript
this.totalKills += 1;
```

**Step 3: Reset totalKills on new run**

In the block that resets run state (~line 1242, where `this.player.score = 0`), add:

```typescript
this.totalKills = 0;
```

**Step 4: Change handlePlayerDeath to trigger game over**

Replace the current `handlePlayerDeath` method body. Instead of setting `respawnTimer`, transition to gameover:

```typescript
private handlePlayerDeath(killerName: string): void {
  this.gameState = "gameover";

  const stats: GameOverStats = {
    score: this.player.score + this.bankState.level + this.bankState.run,
    kills: this.totalKills,
    timeAlive: Number(this.runTime.toFixed(1)),
    bestCombo: this.comboState.bestMultiplier,
    levelReached: this.currentLevel.name,
    killedBy: killerName,
  };

  this.updatePersonalBest(false);

  this.emit("kill", {
    killer: killerName,
    victim: "You",
    weapon: "Rifle",
    timestamp: Date.now(),
  });
  this.emit("gameStateChanged", "gameover");
  this.emit("gameOver", stats);
  this.emit("personalBestChanged", this.personalBest);
  this.audio.playDeath();
  this.input.exitPointerLock();
  this.pushState();
}
```

**Step 5: Remove the dead-player respawn block in the update loop**

In the `update` method (~line 659), the block that checks `!this.player.isAlive` and counts down `respawnTimer` — replace it with a simple early return:

```typescript
if (!this.player.isAlive) {
  this.pushState();
  return;
}
```

**Step 6: Add gameover to the early-return states at top of update**

Near line 642, where `runComplete` and `levelUpChoice` cause early returns, add `gameover`:

```typescript
if (this.gameState === "runComplete" || this.gameState === "levelUpChoice" || this.gameState === "gameover") {
```

**Step 7: Wire the gameOver listener type**

In the `EngineEventCallback` interface (~line 214), add:

```typescript
gameOver: (stats: GameOverStats) => void;
```

Import `GameOverStats` from `./types` in the engine imports.

**Step 8: Commit**

```bash
git add src/game/engine.ts
git commit -m "feat: permadeath - death ends game instead of respawning"
```

---

### Task 3: Add leaderboard logic to the Zustand store

**Files:**
- Modify: `src/state/game-store.ts`

**Step 1: Add leaderboard state and actions to GameStore interface**

Add to the interface:

```typescript
// Leaderboard
gameOverStats: GameOverStats | null;
leaderboard: LeaderboardEntry[];

// Actions
setGameOverStats: (stats: GameOverStats) => void;
loadLeaderboard: () => void;
saveToLeaderboard: (stats: GameOverStats) => void;
```

Import `GameOverStats` and `LeaderboardEntry` from `@/game/types`.

**Step 2: Add defaults and implementations**

Defaults:

```typescript
gameOverStats: null,
leaderboard: [],
```

Actions:

```typescript
setGameOverStats: (gameOverStats) => set({ gameOverStats }),

loadLeaderboard: () => {
  try {
    const raw = localStorage.getItem("game-killer-leaderboard-v1");
    if (raw) set({ leaderboard: JSON.parse(raw) });
  } catch {
    // ignore corrupt data
  }
},

saveToLeaderboard: (stats) =>
  set((state) => {
    const entry: LeaderboardEntry = {
      score: stats.score,
      kills: stats.kills,
      timeAlive: stats.timeAlive,
      bestCombo: stats.bestCombo,
      levelReached: stats.levelReached,
      date: Date.now(),
    };
    const updated = [...state.leaderboard, entry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    localStorage.setItem("game-killer-leaderboard-v1", JSON.stringify(updated));
    return { leaderboard: updated };
  }),
```

**Step 3: Reset gameOverStats in the existing reset() action**

Add `gameOverStats: null` to the reset object. Do NOT reset leaderboard — it persists.

**Step 4: Commit**

```bash
git add src/state/game-store.ts
git commit -m "feat: add leaderboard state and persistence to store"
```

---

### Task 4: Wire gameOver event in GameCanvas

**Files:**
- Modify: `src/components/game/game-canvas.tsx`

**Step 1: Add gameOver event listener**

After the existing `playerDied` listener (~line 52), add:

```typescript
engine.on("gameOver", (stats) => {
  useGameStore.getState().setGameOverStats(stats);
  useGameStore.getState().saveToLeaderboard(stats);
});
```

**Step 2: Commit**

```bash
git add src/components/game/game-canvas.tsx
git commit -m "feat: wire gameOver event to store and leaderboard"
```

---

### Task 5: Create the Leaderboard component

**Files:**
- Create: `src/components/menu/leaderboard.tsx`

**Step 1: Build the leaderboard overlay**

```typescript
"use client";

import { useGameStore } from "@/state/game-store";
import { useEffect } from "react";

interface LeaderboardProps {
  onBack: () => void;
}

export function Leaderboard({ onBack }: LeaderboardProps) {
  const leaderboard = useGameStore((s) => s.leaderboard);
  const loadLeaderboard = useGameStore((s) => s.loadLeaderboard);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-xl px-6">
        <h2 className="mb-6 text-center font-mono text-lg uppercase tracking-[0.4em] text-primary/80">
          Top Runs
        </h2>

        {leaderboard.length === 0 ? (
          <p className="text-center font-mono text-sm text-primary/40">
            No runs recorded yet. Deploy and fight.
          </p>
        ) : (
          <div className="space-y-1">
            {/* Header */}
            <div className="grid grid-cols-[2rem_1fr_4rem_4rem_4rem] gap-2 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-primary/40">
              <span>#</span>
              <span>Score</span>
              <span className="text-right">Kills</span>
              <span className="text-right">Time</span>
              <span className="text-right">Combo</span>
            </div>

            {leaderboard.map((entry, i) => (
              <div
                key={`${entry.date}-${i}`}
                className="grid grid-cols-[2rem_1fr_4rem_4rem_4rem] gap-2 rounded px-3 py-2 font-mono text-xs tabular-nums text-primary/70 odd:bg-primary/5"
              >
                <span className="text-primary/40">{i + 1}</span>
                <span className="text-primary">{entry.score.toLocaleString()}</span>
                <span className="text-right">{entry.kills}</span>
                <span className="text-right">{formatTime(entry.timeAlive)}</span>
                <span className="text-right">{entry.bestCombo}x</span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 flex justify-center">
          <button
            onClick={onBack}
            className="cyber-btn flex h-10 items-center gap-3 px-6"
          >
            <span className="font-mono text-[11px] uppercase tracking-[0.3em]">
              Back
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/menu/leaderboard.tsx
git commit -m "feat: create leaderboard overlay component"
```

---

### Task 6: Create the Game Over screen

**Files:**
- Create: `src/components/menu/game-over-screen.tsx`

**Step 1: Build the game over screen**

Shows final stats, the player's rank in the leaderboard, and a return-to-menu button. Follows the existing cyber/HUD aesthetic.

```typescript
"use client";

import { useGameStore } from "@/state/game-store";
import { Skull } from "lucide-react";

interface GameOverScreenProps {
  onReturnToMenu: () => void;
}

export function GameOverScreen({ onReturnToMenu }: GameOverScreenProps) {
  const stats = useGameStore((s) => s.gameOverStats);
  const leaderboard = useGameStore((s) => s.leaderboard);

  if (!stats) return null;

  const rank = leaderboard.findIndex((e) => e.score <= stats.score) + 1 || leaderboard.length + 1;
  const isTop = rank <= leaderboard.length;

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center">
      {/* Dim backdrop */}
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" />

      <div className="relative z-10 flex flex-col items-center gap-6 px-6">
        {/* Death icon */}
        <Skull className="h-10 w-10 text-red-500/80" />

        <h1 className="font-mono text-2xl font-bold uppercase tracking-[0.5em] text-red-500/90">
          Killed
        </h1>

        <p className="font-mono text-xs text-primary/40">
          Eliminated by {stats.killedBy}
        </p>

        {/* Stats grid */}
        <div className="mt-2 grid grid-cols-2 gap-x-10 gap-y-3">
          {[
            ["Score", stats.score.toLocaleString()],
            ["Kills", String(stats.kills)],
            ["Time", formatTime(stats.timeAlive)],
            ["Best Combo", `${stats.bestCombo}x`],
            ["Level", stats.levelReached],
            ["Rank", isTop ? `#${rank} of ${leaderboard.length}` : "Unranked"],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-col">
              <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-primary/35">
                {label}
              </span>
              <span className="font-mono text-sm tabular-nums text-primary/80">
                {value}
              </span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-4">
          <button
            onClick={onReturnToMenu}
            className="cyber-btn cyber-btn-primary flex h-12 items-center gap-3 px-8"
          >
            <span className="font-mono text-xs uppercase tracking-[0.3em]">
              Return to Menu
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/menu/game-over-screen.tsx
git commit -m "feat: create game over screen with stats display"
```

---

### Task 7: Wire game over screen into page.tsx

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Import new components**

```typescript
import { GameOverScreen } from "@/components/menu/game-over-screen";
import { Leaderboard } from "@/components/menu/leaderboard";
```

**Step 2: Add leaderboard state**

In the `Home` component, add:

```typescript
const [showLeaderboard, setShowLeaderboard] = useState(false);
```

**Step 3: Add game over screen inside the `{isGame && ...}` block**

After the pause overlay conditional (~line 135), add:

```typescript
{gameState === "gameover" && (
  <GameOverScreen onReturnToMenu={handleQuitToMenu} />
)}
```

**Step 4: Add leaderboard overlay in the main menu section**

After the `MainMenu` component (~line 121), add:

```typescript
{showLeaderboard && (
  <Leaderboard onBack={() => setShowLeaderboard(false)} />
)}
```

**Step 5: Pass leaderboard opener to MainMenu**

Update the MainMenu usage:

```typescript
<MainMenu
  onPlay={handlePlay}
  onSettings={handleOpenSettings}
  onExit={() => handleOpenExit("mainMenu")}
  onLeaderboard={() => setShowLeaderboard(true)}
/>
```

**Step 6: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: wire game over screen and leaderboard into page"
```

---

### Task 8: Add Leaderboard button to MainMenu

**Files:**
- Modify: `src/components/menu/main-menu.tsx`

**Step 1: Update props interface**

```typescript
interface MainMenuProps {
  onPlay: () => void;
  onSettings: () => void;
  onExit: () => void;
  onLeaderboard: () => void;
}
```

**Step 2: Add Trophy icon import**

```typescript
import { Play, Power, Settings2, Trophy, Zap } from "lucide-react";
```

**Step 3: Add Leaderboard button**

In the left actions column, between the Settings and Exit buttons, add:

```tsx
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
```

Adjust the Exit button's `animationDelay` to `"450ms"` to maintain the stagger.

**Step 4: Update the function signature**

```typescript
export function MainMenu({ onPlay, onSettings, onExit, onLeaderboard }: MainMenuProps) {
```

**Step 5: Load leaderboard on mount**

Add at the top of the component:

```typescript
import { useGameStore } from "@/state/game-store";
// ...
const loadLeaderboard = useGameStore((s) => s.loadLeaderboard);
useEffect(() => { loadLeaderboard(); }, [loadLeaderboard]);
```

**Step 6: Commit**

```bash
git add src/components/menu/main-menu.tsx
git commit -m "feat: add leaderboard button to main menu"
```

---

### Task 9: Smoke test the full flow

**Step 1: Build the project**

```bash
bun run dev:next
```

Verify no TypeScript or build errors.

**Step 2: Manual test checklist**

- [ ] Start game from main menu
- [ ] Get killed by a bot — game over screen appears (no respawn)
- [ ] Game over screen shows score, kills, time, combo, level, rank
- [ ] Click "Return to Menu" — returns to main menu
- [ ] Click "Leaderboard" on main menu — shows the run you just completed
- [ ] Play again, die — leaderboard now has 2 entries sorted by score
- [ ] Refresh page — leaderboard persists from localStorage

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: score leaderboard system - permadeath with top-10 local leaderboard"
```
