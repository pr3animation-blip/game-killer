import { create } from "zustand";
import {
  AppliedUpgrade,
  BalanceSnapshot,
  BossState,
  ComboState,
  GameOverStats,
  GameState,
  InventoryState,
  KillEntry,
  LeaderboardEntry,
  LevelUpChoiceState,
  LevelCompleteSummary,
  LevelSummary,
  MedalPaceState,
  MovementState,
  ObjectiveState,
  OpportunityState,
  PersonalBestSnapshot,
  PickupPromptState,
  ProgressionState,
  RadarState,
  RunMutator,
  RuntimeModifiers,
  ScoreEvent,
  ThreatAlert,
} from "@/game/types";
import {
  createInactiveLevelUpChoice,
  createInitialProgressionState,
  DEFAULT_BALANCE_SNAPSHOT,
  DEFAULT_RUNTIME_MODIFIERS,
} from "@/game/progression";

const DEFAULT_THREAT_ALERT: ThreatAlert = {
  active: false,
  direction: "front",
  count: 0,
  distance: 0,
};

const DEFAULT_RADAR_STATE: RadarState = {
  range: 22,
  contacts: [],
};

const DEFAULT_LEVEL_SUMMARY: LevelSummary = {
  id: "relay-loop",
  name: "Relay Loop",
  index: 1,
  total: 3,
};

const DEFAULT_OBJECTIVE_STATE: ObjectiveState = {
  kind: "terminal-sequence",
  phase: "objective",
  title: "",
  text: "",
  detail: "",
  progress: "",
  interactPrompt: null,
  extractionUnlocked: false,
  escapeTimer: null,
  opportunityHint: null,
};

const DEFAULT_INVENTORY_STATE: InventoryState = {
  slots: [
    {
      index: 0,
      weaponId: null,
      name: null,
      shortName: null,
      ammo: null,
      reserveAmmo: null,
    },
    {
      index: 1,
      weaponId: null,
      name: null,
      shortName: null,
      ammo: null,
      reserveAmmo: null,
    },
    {
      index: 2,
      weaponId: null,
      name: null,
      shortName: null,
      ammo: null,
      reserveAmmo: null,
    },
  ],
  activeSlot: 0,
  activeWeaponId: null,
  activeWeaponName: null,
  fireMode: null,
  ammo: 0,
  reserveAmmo: 0,
  isReloading: false,
  reloadProgress: 0,
  reloadDuration: 0,
  chargeRatio: 0,
  reticleSpread: 0,
  isADS: false,
};

const DEFAULT_PICKUP_PROMPT: PickupPromptState = {
  active: false,
  pickupId: null,
  weaponId: null,
  label: "",
  action: "pickup",
  text: "",
  progress: 0,
};

const DEFAULT_COMBO_STATE: ComboState = {
  multiplier: 1,
  liveBonus: 0,
  bankedLevel: 0,
  bankedRun: 0,
  timer: 0,
  maxTimer: 4.4,
  bestMultiplier: 1,
  bestLiveBonus: 0,
  streak: 0,
  heat: 0,
};

const DEFAULT_MEDAL_PACE: MedalPaceState = {
  current: null,
  next: "bronze",
  pointsToNext: 0,
  maxTier: "s",
  degraded: false,
  targetTime: 0,
  splitDelta: null,
  bestScore: 0,
  bestTime: null,
};

const DEFAULT_PERSONAL_BEST: PersonalBestSnapshot = {
  bestRunScore: 0,
  bestRunTime: null,
  levelBestTimes: {},
  levelBestScores: {},
  lastRunScore: 0,
};

const DEFAULT_LEVEL_UP_CHOICE: LevelUpChoiceState = createInactiveLevelUpChoice();
const DEFAULT_PROGRESSION: ProgressionState = createInitialProgressionState();
const DEFAULT_BOSS_STATE: BossState = {
  active: false,
  introActive: false,
  defeated: false,
  id: null,
  name: "",
  weaponType: null,
  health: 0,
  maxHealth: 0,
  phase: 1,
  telegraph: null,
  introText: null,
};

interface GameStore {
  // Player state
  health: number;
  maxHealth: number;
  ammo: number;
  reserveAmmo: number;
  score: number;
  deaths: number;
  isReloading: boolean;

  // Game state
  gameState: GameState;
  fps: number;
  showScoreboard: boolean;

  // Kill feed
  killFeed: KillEntry[];

  // Hit marker
  showHitMarker: boolean;
  isHeadshotHit: boolean;

  // Weapons
  inventory: InventoryState;
  pickupPrompt: PickupPromptState;

  // Enemy awareness
  threatAlert: ThreatAlert;
  radar: RadarState;
  boss: BossState;

  // Objective run state
  currentLevel: LevelSummary;
  objective: ObjectiveState;
  objectiveText: string;
  objectiveProgress: string;
  dashCooldown: number;
  movementState: MovementState;
  escapeTimer: number | null;
  runTimer: number;
  levelTimer: number;
  levelCompleteSummary: LevelCompleteSummary | null;
  combo: ComboState;
  scoreEvents: ScoreEvent[];
  activeMutator: RunMutator | null;
  activeUpgrades: AppliedUpgrade[];
  progression: ProgressionState;
  levelUpChoice: LevelUpChoiceState;
  runtimeModifiers: RuntimeModifiers;
  balance: BalanceSnapshot;
  opportunity: OpportunityState | null;
  medalPace: MedalPaceState;
  personalBest: PersonalBestSnapshot;
  activeClassName: string | null;

  // Damage vignette
  damageFlash: number;

  // Leaderboard
  gameOverStats: GameOverStats | null;
  leaderboard: LeaderboardEntry[];

  // Actions
  setHealth: (health: number) => void;
  setAmmo: (ammo: number, reserve: number) => void;
  setScore: (score: number) => void;
  setDeaths: (deaths: number) => void;
  setGameState: (state: GameState) => void;
  setFps: (fps: number) => void;
  setInventory: (inventory: InventoryState) => void;
  setPickupPrompt: (pickupPrompt: PickupPromptState) => void;
  setReloading: (r: boolean) => void;
  addKill: (entry: KillEntry) => void;
  setShowScoreboard: (show: boolean) => void;
  setThreatAlert: (threatAlert: ThreatAlert) => void;
  setRadarState: (radar: RadarState) => void;
  setCurrentLevel: (level: LevelSummary) => void;
  setObjective: (objective: ObjectiveState) => void;
  setMovementState: (state: MovementState, dashCooldown: number) => void;
  setTimers: (runTimer: number, levelTimer: number, escapeTimer: number | null) => void;
  setLevelCompleteSummary: (summary: LevelCompleteSummary | null) => void;
  flashHitMarker: (isHeadshot?: boolean) => void;
  setGameOverStats: (stats: GameOverStats) => void;
  flashDamageVignette: (intensity: number) => void;
  loadLeaderboard: () => void;
  saveToLeaderboard: (stats: GameOverStats) => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  health: 100,
  maxHealth: 100,
  ammo: 30,
  reserveAmmo: 90,
  score: 0,
  deaths: 0,
  isReloading: false,
  gameState: "menu",
  fps: 0,
  showScoreboard: false,
  killFeed: [],
  showHitMarker: false,
  isHeadshotHit: false,
  inventory: DEFAULT_INVENTORY_STATE,
  pickupPrompt: DEFAULT_PICKUP_PROMPT,
  threatAlert: DEFAULT_THREAT_ALERT,
  radar: DEFAULT_RADAR_STATE,
  boss: DEFAULT_BOSS_STATE,
  currentLevel: DEFAULT_LEVEL_SUMMARY,
  objective: DEFAULT_OBJECTIVE_STATE,
  objectiveText: "",
  objectiveProgress: "",
  dashCooldown: 0,
  movementState: "walk",
  escapeTimer: null,
  runTimer: 0,
  levelTimer: 0,
  levelCompleteSummary: null,
  combo: DEFAULT_COMBO_STATE,
  scoreEvents: [],
  activeMutator: null,
  activeUpgrades: [],
  progression: DEFAULT_PROGRESSION,
  levelUpChoice: DEFAULT_LEVEL_UP_CHOICE,
  runtimeModifiers: DEFAULT_RUNTIME_MODIFIERS,
  balance: DEFAULT_BALANCE_SNAPSHOT,
  opportunity: null,
  medalPace: DEFAULT_MEDAL_PACE,
  personalBest: DEFAULT_PERSONAL_BEST,
  activeClassName: null,
  damageFlash: 0,
  gameOverStats: null,
  leaderboard: [],

  setHealth: (health) => set({ health }),
  setAmmo: (ammo, reserveAmmo) => set({ ammo, reserveAmmo }),
  setScore: (score) => set({ score }),
  setDeaths: (deaths) => set({ deaths }),
  setGameState: (gameState) => set({ gameState }),
  setFps: (fps) => set({ fps }),
  setInventory: (inventory) =>
    set({
      inventory,
      ammo: inventory.ammo,
      reserveAmmo: inventory.reserveAmmo,
      isReloading: inventory.isReloading,
    }),
  setPickupPrompt: (pickupPrompt) => set({ pickupPrompt }),
  setReloading: (isReloading) => set({ isReloading }),
  addKill: (entry) =>
    set((state) => ({
      killFeed: [entry, ...state.killFeed].slice(0, 5),
    })),
  setShowScoreboard: (showScoreboard) => set({ showScoreboard }),
  setThreatAlert: (threatAlert) => set({ threatAlert }),
  setRadarState: (radar) => set({ radar }),
  setCurrentLevel: (currentLevel) => set({ currentLevel }),
  setObjective: (objective) =>
    set({
      objective,
      objectiveText: objective.text,
      objectiveProgress: objective.progress,
      escapeTimer: objective.escapeTimer,
    }),
  setMovementState: (movementState, dashCooldown) =>
    set({ movementState, dashCooldown }),
  setTimers: (runTimer, levelTimer, escapeTimer) =>
    set({ runTimer, levelTimer, escapeTimer }),
  setLevelCompleteSummary: (levelCompleteSummary) => set({ levelCompleteSummary }),
  flashHitMarker: (isHeadshot) => {
    set({ showHitMarker: true, isHeadshotHit: isHeadshot ?? false });
    setTimeout(() => set({ showHitMarker: false, isHeadshotHit: false }), 150);
  },
  flashDamageVignette: (intensity) => {
    set({ damageFlash: Math.min(1, intensity) });
    setTimeout(() => set({ damageFlash: 0 }), 200);
  },
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
  reset: () =>
    set({
      health: 100,
      ammo: 30,
      reserveAmmo: 90,
      score: 0,
      deaths: 0,
      killFeed: [],
      isReloading: false,
      inventory: DEFAULT_INVENTORY_STATE,
      pickupPrompt: DEFAULT_PICKUP_PROMPT,
      threatAlert: DEFAULT_THREAT_ALERT,
      radar: DEFAULT_RADAR_STATE,
      boss: DEFAULT_BOSS_STATE,
      currentLevel: DEFAULT_LEVEL_SUMMARY,
      objective: DEFAULT_OBJECTIVE_STATE,
      objectiveText: "",
      objectiveProgress: "",
      dashCooldown: 0,
      movementState: "walk",
      escapeTimer: null,
      runTimer: 0,
      levelTimer: 0,
      levelCompleteSummary: null,
      combo: DEFAULT_COMBO_STATE,
      scoreEvents: [],
      activeMutator: null,
      activeUpgrades: [],
      progression: DEFAULT_PROGRESSION,
      levelUpChoice: DEFAULT_LEVEL_UP_CHOICE,
      runtimeModifiers: DEFAULT_RUNTIME_MODIFIERS,
      balance: DEFAULT_BALANCE_SNAPSHOT,
      opportunity: null,
      medalPace: DEFAULT_MEDAL_PACE,
      personalBest: DEFAULT_PERSONAL_BEST,
      activeClassName: null,
      damageFlash: 0,
      gameOverStats: null,
    }),
}));
