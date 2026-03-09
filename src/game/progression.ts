import {
  AppliedUpgrade,
  BalanceSnapshot,
  LevelUpChoiceState,
  ProgressionState,
  RuntimeModifiers,
  UpgradeDefinition,
  UpgradeId,
  MedalThresholds,
} from "./types";

const XP_TIERS = [
  { upTo: 5, base: 120, perLevel: 55 },
  { upTo: 10, base: 400, perLevel: 80 },
] as const;
const HIGH_TIER = { base: 800, perLevel: 110, startLevel: 11 };

export const UPGRADE_DEFINITIONS: Record<UpgradeId, UpgradeDefinition> = {
  "tight-choke": {
    id: "tight-choke",
    name: "Tight Choke",
    description: "Tighter spread. Land more pellets and cleaner lane fire.",
    category: "weapon",
    rarity: "common",
    maxStacks: 3,
    powerBudget: 1,
  },
  "fast-hands": {
    id: "fast-hands",
    name: "Fast Hands",
    description: "Shorter reload windows across the full loadout.",
    category: "ammo",
    rarity: "common",
    maxStacks: 4,
    powerBudget: 1,
  },
  "overcrank": {
    id: "overcrank",
    name: "Overcrank",
    description: "Higher fire rate with slightly harsher kick.",
    category: "weapon",
    rarity: "common",
    maxStacks: 3,
    powerBudget: 1.15,
  },
  "hollow-point": {
    id: "hollow-point",
    name: "Hollow Point",
    description: "Flat weapon damage increase for every gun in the run.",
    category: "weapon",
    rarity: "common",
    maxStacks: 3,
    powerBudget: 1.2,
  },
  "fleet-step": {
    id: "fleet-step",
    name: "Fleet Step",
    description: "Faster movement and stronger air acceleration.",
    category: "mobility",
    rarity: "common",
    maxStacks: 3,
    powerBudget: 1,
  },
  "dash-capacitors": {
    id: "dash-capacitors",
    name: "Dash Capacitors",
    description: "Dash more often and carry more speed through the burst.",
    category: "mobility",
    rarity: "common",
    maxStacks: 3,
    powerBudget: 1,
  },
  "extended-mag": {
    id: "extended-mag",
    name: "Extended Mag",
    description: "Larger magazines for longer kill chains before reload.",
    category: "ammo",
    rarity: "common",
    maxStacks: 2,
    powerBudget: 1.1,
  },
  "piercing-rounds": {
    id: "piercing-rounds",
    name: "Piercing Rounds",
    description: "Hitscan shots punch through more targets.",
    category: "weapon",
    rarity: "common",
    maxStacks: 2,
    powerBudget: 1.15,
  },
  "golden-chamber": {
    id: "golden-chamber",
    name: "Golden Chamber",
    description: "The first shot after a reload becomes a gold lane-breaker.",
    category: "special",
    rarity: "rare",
    maxStacks: 1,
    minLevel: 4,
    powerBudget: 2.3,
  },
  "scatter-core": {
    id: "scatter-core",
    name: "Scatter Core",
    description: "Hitscan weapons gain a side pellet. Scattershot tightens its cone.",
    category: "special",
    rarity: "rare",
    maxStacks: 1,
    minLevel: 4,
    powerBudget: 1.9,
  },
  "blink-dash": {
    id: "blink-dash",
    name: "Blink Dash",
    description: "Dash grants a brief invulnerability pulse and partial reload.",
    category: "special",
    rarity: "rare",
    maxStacks: 1,
    minLevel: 4,
    powerBudget: 2.1,
  },
};

const OFFER_WEIGHTS = {
  common: 1,
  rare: 0.55,
} as const;

export const DEFAULT_RUNTIME_MODIFIERS: RuntimeModifiers = {
  damageMultiplier: 1,
  fireRateMultiplier: 1,
  reloadSpeedMultiplier: 1,
  spreadMultiplier: 1,
  magazineSizeMultiplier: 1,
  recoilMultiplier: 1,
  moveSpeedMultiplier: 1,
  airAccelMultiplier: 1,
  dashCooldownMultiplier: 1,
  dashSpeedMultiplier: 1,
  projectileCountBonus: 0,
  pierceBonus: 0,
  goldenChamber: false,
  scatterCore: false,
  blinkDash: false,
};

export const DEFAULT_BALANCE_SNAPSHOT: BalanceSnapshot = {
  powerScore: 0,
  enemyHealthMultiplier: 1,
  enemyFireRateMultiplier: 1,
  reinforcementIntervalMultiplier: 1,
  medalThresholdMultiplier: 1,
};

export const createInitialProgressionState = (): ProgressionState => ({
  level: 1,
  xp: 0,
  xpIntoLevel: 0,
  xpToNextLevel: getXpToNextLevel(1),
  pendingLevelUps: 0,
  powerScore: 0,
});

export const createInactiveLevelUpChoice = (): LevelUpChoiceState => ({
  active: false,
  level: 0,
  choices: [],
});

export function getXpToNextLevel(level: number): number {
  for (const tier of XP_TIERS) {
    if (level <= tier.upTo) {
      return tier.base + tier.perLevel * (level - 1);
    }
  }
  return HIGH_TIER.base + HIGH_TIER.perLevel * (level - HIGH_TIER.startLevel);
}

export function awardXp(
  state: ProgressionState,
  xpGain: number,
  powerScore: number
): ProgressionState {
  if (xpGain <= 0) {
    return {
      ...state,
      powerScore,
    };
  }

  let xp = state.xp + xpGain;
  let level = state.level;
  let pendingLevelUps = state.pendingLevelUps;
  let xpToNextLevel = getXpToNextLevel(level);

  while (xp >= xpToNextLevel) {
    xp -= xpToNextLevel;
    level += 1;
    pendingLevelUps += 1;
    xpToNextLevel = getXpToNextLevel(level);
  }

  return {
    level,
    xp: state.xp + xpGain,
    xpIntoLevel: xp,
    xpToNextLevel,
    pendingLevelUps,
    powerScore,
  };
}

export function applyUpgrade(
  activeUpgrades: AppliedUpgrade[],
  upgradeId: UpgradeId
): AppliedUpgrade[] {
  const definition = UPGRADE_DEFINITIONS[upgradeId];
  const existing = activeUpgrades.find((entry) => entry.id === upgradeId);

  if (existing) {
    if (existing.stacks >= definition.maxStacks) {
      return activeUpgrades;
    }
    return activeUpgrades.map((entry) =>
      entry.id === upgradeId
        ? {
            ...entry,
            stacks: entry.stacks + 1,
          }
        : entry
    );
  }

  return [
    ...activeUpgrades,
    {
      ...definition,
      stacks: 1,
    },
  ];
}

export function computeRuntimeModifiers(activeUpgrades: AppliedUpgrade[]): RuntimeModifiers {
  const modifiers: RuntimeModifiers = { ...DEFAULT_RUNTIME_MODIFIERS };

  for (const upgrade of activeUpgrades) {
    switch (upgrade.id) {
      case "tight-choke":
        modifiers.spreadMultiplier *= Math.pow(0.85, upgrade.stacks);
        break;
      case "fast-hands":
        modifiers.reloadSpeedMultiplier *= 1 + upgrade.stacks * 0.12;
        break;
      case "overcrank":
        modifiers.fireRateMultiplier *= 1 + upgrade.stacks * 0.1;
        modifiers.recoilMultiplier *= 1 + upgrade.stacks * 0.04;
        break;
      case "hollow-point":
        modifiers.damageMultiplier *= 1 + upgrade.stacks * 0.12;
        break;
      case "fleet-step":
        modifiers.moveSpeedMultiplier *= 1 + upgrade.stacks * 0.08;
        modifiers.airAccelMultiplier *= 1 + upgrade.stacks * 0.1;
        break;
      case "dash-capacitors":
        modifiers.dashCooldownMultiplier *= Math.max(0.35, 1 - upgrade.stacks * 0.15);
        modifiers.dashSpeedMultiplier *= 1 + upgrade.stacks * 0.08;
        break;
      case "extended-mag":
        modifiers.magazineSizeMultiplier *= 1 + upgrade.stacks * 0.2;
        break;
      case "piercing-rounds":
        modifiers.pierceBonus += upgrade.stacks;
        break;
      case "golden-chamber":
        modifiers.goldenChamber = true;
        break;
      case "scatter-core":
        modifiers.scatterCore = true;
        modifiers.projectileCountBonus += 1;
        break;
      case "blink-dash":
        modifiers.blinkDash = true;
        break;
    }
  }

  return modifiers;
}

export function computePowerScore(activeUpgrades: AppliedUpgrade[]): number {
  return Number(
    activeUpgrades
      .reduce((total, upgrade) => total + upgrade.powerBudget * upgrade.stacks, 0)
      .toFixed(2)
  );
}

export function computeBalanceSnapshot(powerScore: number): BalanceSnapshot {
  return {
    powerScore,
    enemyHealthMultiplier: Number((1 + Math.min(0.12, powerScore * 0.012)).toFixed(3)),
    enemyFireRateMultiplier: Number((1 + Math.min(0.08, powerScore * 0.008)).toFixed(3)),
    reinforcementIntervalMultiplier: Number(
      Math.max(0.88, 1 - powerScore * 0.012).toFixed(3)
    ),
    medalThresholdMultiplier: Number((1 + Math.min(0.08, powerScore * 0.01)).toFixed(3)),
  };
}

export function getAdjustedMedalThresholds(
  thresholds: MedalThresholds,
  balance: BalanceSnapshot
): MedalThresholds {
  const scale = balance.medalThresholdMultiplier;
  return {
    bronze: Math.round(thresholds.bronze * scale),
    silver: Math.round(thresholds.silver * scale),
    gold: Math.round(thresholds.gold * scale),
    s: Math.round(thresholds.s * scale),
    targetTime: thresholds.targetTime,
  };
}

export function rollLevelUpChoices(
  level: number,
  activeUpgrades: AppliedUpgrade[]
): LevelUpChoiceState {
  const available = Object.values(UPGRADE_DEFINITIONS).filter((definition) => {
    if ((definition.minLevel ?? 1) > level) return false;
    const active = activeUpgrades.find((entry) => entry.id === definition.id);
    return !active || active.stacks < definition.maxStacks;
  });

  if (available.length === 0) {
    return createInactiveLevelUpChoice();
  }

  const picked: UpgradeDefinition[] = [];
  let pool = [...available];

  while (picked.length < Math.min(2, available.length) && pool.length > 0) {
    const preferredCategories = new Set(picked.map((entry) => entry.category));
    const distinctPool =
      picked.length === 0
        ? pool
        : pool.filter((entry) => !preferredCategories.has(entry.category));
    const candidatePool = distinctPool.length > 0 ? distinctPool : pool;
    const next = pickWeighted(candidatePool);
    if (!next) break;
    picked.push(next);
    pool = pool.filter((entry) => entry.id !== next.id);
  }

  return {
    active: picked.length > 0,
    level,
    choices: picked.slice(0, 2),
  };
}

function pickWeighted(pool: UpgradeDefinition[]): UpgradeDefinition | null {
  const totalWeight = pool.reduce(
    (sum, entry) => sum + OFFER_WEIGHTS[entry.rarity],
    0
  );
  if (totalWeight <= 0) return pool[0] ?? null;

  let roll = Math.random() * totalWeight;
  for (const entry of pool) {
    roll -= OFFER_WEIGHTS[entry.rarity];
    if (roll <= 0) {
      return entry;
    }
  }

  return pool[pool.length - 1] ?? null;
}
